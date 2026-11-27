// lib/guide/live.ts
// The live guide's conversation with Google's Live API (27 Nov 2026), straight
// from the browser over a WebSocket with a one-use token the API minted
// (aibos-api live_guide.py). The microphone goes up as 16 kHz 16-bit PCM in
// small pieces; AIBOS's voice comes back as 24 kHz PCM and is played in order.
// When the owner talks over it, Google says "interrupted" and what was still
// to play is dropped, so AIBOS stops at once, as a person would.
//
// Tools are answered here (read_screen, point_at, go_to, aibos_manual,
// end_guide) by whoever made the session (GuideSphere). Google's own token
// counts (usageMetadata) are added up by modality and sent back when the
// session ends, so the cost a minute is measured, not guessed.

export type GuidePhase = 'connecting' | 'listening' | 'speaking' | 'thinking' | 'ended';

export interface GuideUsage { prompt: Record<string, number>; response: Record<string, number>; reports: number; turns: number }

export interface GuideCallbacks {
  onPhase: (p: GuidePhase) => void;
  /** Words as they are heard ('you') or said ('aibos'); `fresh` starts a new line. */
  onCaption: (who: 'you' | 'aibos', text: string, fresh: boolean) => void;
  onTool: (name: string, args: Record<string, unknown>) => Promise<string>;
  /** The session is over: `why` says why when it was not the owner's choice. */
  onEnd: (why: string | null) => void;
}

// The microphone processor runs in the audio thread: public/guide-mic-worklet.js.
const WORKLET_URL = '/guide-mic-worklet.js';

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(b64: string): ArrayBuffer {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out.buffer;
}

export class LiveGuide {
  private ws: WebSocket | null = null;
  private mic: MediaStream | null = null;
  private inCtx: AudioContext | null = null;
  private outCtx: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private playing = new Set<AudioBufferSourceNode>();
  private playAt = 0;
  private ready = false;
  private muted = false;
  private over = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private started = 0;
  private heardFresh = true;
  private saidFresh = true;
  private closeWhy: string | null = null;
  readonly usage: GuideUsage = { prompt: {}, response: {}, reports: 0, turns: 0 };

  constructor(private opts: { ws: string; token: string; setup: Record<string, unknown>; maxSeconds: number; opening: string },
    private cb: GuideCallbacks) {}

  /** Seconds since the conversation began. */
  get seconds(): number { return this.started ? Math.round((Date.now() - this.started) / 1000) : 0; }

  /** Start: call from a tap (browsers only allow sound and the microphone
   *  after one). Resolves to false when there is no microphone (refused or
   *  none): the guide still runs, and the owner types while AIBOS speaks. */
  async start(): Promise<boolean> {
    this.cb.onPhase('connecting');
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.outCtx = new AC({ sampleRate: 24000 });
    void this.outCtx.resume();
    let hears = true;
    try {
      this.mic = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      this.inCtx = new AC();
      await this.inCtx.audioWorklet.addModule(WORKLET_URL);
      const src = this.inCtx.createMediaStreamSource(this.mic);
      this.node = new AudioWorkletNode(this.inCtx, 'aibos-down');
      this.node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
        if (!this.ready || this.muted || this.ws?.readyState !== WebSocket.OPEN) return;
        this.send({ realtimeInput: { audio: { data: toBase64(e.data), mimeType: 'audio/pcm;rate=16000' } } });
      };
      src.connect(this.node);
    } catch {
      hears = false;
      this.mic?.getTracks().forEach((t) => t.stop());
      this.mic = null;
    }
    if (this.over) return hears;

    const ws = new WebSocket(`${this.opts.ws}?access_token=${encodeURIComponent(this.opts.token)}`);
    this.ws = ws;
    ws.onopen = () => this.send({ setup: this.opts.setup });
    // Never stuck on "Starting": no answer from Google in 12 seconds ends it, saying so.
    setTimeout(() => { if (!this.ready && !this.over) this.finish('The live guide could not reach Google just now. Try again in a minute.'); }, 12000);
    ws.onmessage = (e) => { void this.onMessage(e.data); };
    ws.onerror = () => { this.closeWhy = this.closeWhy ?? 'The live guide lost its connection.'; };
    ws.onclose = (e) => {
      if (this.over) return;
      const why = this.ready
        ? (e.code === 1000 ? null : 'The live guide lost its connection. Tap the sphere to carry on.')
        : `The live guide could not start (${e.code}${e.reason ? `: ${e.reason.slice(0, 120)}` : ''}).`;
      this.finish(this.closeWhy && !this.ready ? `${this.closeWhy} (${e.code}${e.reason ? `: ${e.reason.slice(0, 120)}` : ''})` : why);
    };
    return hears;
  }

  private send(m: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  setMuted(m: boolean) { this.muted = m; }

  /** Say something to AIBOS in writing (Type instead). */
  sendText(text: string) {
    if (!this.ready) return;
    this.flush();
    this.send({ realtimeInput: { text } });
  }

  private async onMessage(raw: unknown) {
    const text = typeof raw === 'string' ? raw : raw instanceof Blob ? await raw.text() : '';
    let m: Record<string, any>;
    try { m = JSON.parse(text); } catch { return; }

    if (m.setupComplete) {
      this.ready = true;
      this.started = Date.now();
      this.timer = setTimeout(() => this.finish('That is ten minutes, the most for one go. Tap the sphere to carry on.'),
        Math.max(15, this.opts.maxSeconds) * 1000);
      this.cb.onPhase('listening');
      this.send({ realtimeInput: { text: this.opts.opening } });
    }
    if (m.usageMetadata) this.count(m.usageMetadata);
    if (m.goAway) this.finish('The live guide has to start again. Tap the sphere to carry on.');

    const sc = m.serverContent;
    if (sc) {
      if (sc.interrupted) { this.flush(); this.saidFresh = true; }
      const heard = sc.inputTranscription?.text;
      if (heard) { this.cb.onCaption('you', heard, this.heardFresh); this.heardFresh = false; this.saidFresh = true; }
      const said = sc.outputTranscription?.text;
      if (said) { this.cb.onCaption('aibos', said, this.saidFresh); this.saidFresh = false; this.heardFresh = true; }
      for (const p of sc.modelTurn?.parts ?? []) {
        const data = p.inlineData?.data;
        if (data && String(p.inlineData?.mimeType ?? 'audio/pcm').startsWith('audio')) this.play(data);
      }
      if (sc.turnComplete) { this.usage.turns += 1; this.saidFresh = true; this.heardFresh = true; }
    }

    const calls = m.toolCall?.functionCalls as { id?: string; name: string; args?: Record<string, unknown> }[] | undefined;
    if (calls?.length) {
      this.cb.onPhase('thinking');
      let ending = false;
      const functionResponses = [];
      for (const c of calls) {
        let result = 'Done.';
        try { result = await this.cb.onTool(c.name, c.args ?? {}); } catch { result = 'That did not work on this screen.'; }
        if (c.name === 'end_guide') ending = true;
        functionResponses.push({ id: c.id, name: c.name, response: { result } });
      }
      this.send({ toolResponse: { functionResponses } });
      this.cb.onPhase(this.playing.size ? 'speaking' : 'listening');
      if (ending) this.endWhenQuiet();
    }
  }

  private count(u: Record<string, any>) {
    this.usage.reports += 1;
    const add = (side: 'prompt' | 'response', details: unknown, total: unknown) => {
      const list = Array.isArray(details) ? details as { modality?: string; tokenCount?: number }[] : [];
      if (list.length) {
        for (const d of list) {
          const k = String(d.modality || 'TEXT').toUpperCase();
          this.usage[side][k] = (this.usage[side][k] ?? 0) + (Number(d.tokenCount) || 0);
        }
      } else if (Number(total) > 0) {
        this.usage[side].TEXT = (this.usage[side].TEXT ?? 0) + Number(total);
      }
    };
    add('prompt', u.promptTokensDetails, u.promptTokenCount);
    add('response', u.responseTokensDetails, u.responseTokenCount);
  }

  private play(b64: string) {
    const ctx = this.outCtx;
    if (!ctx) return;
    const pcm = new Int16Array(fromBase64(b64));
    if (!pcm.length) return;
    const buf = ctx.createBuffer(1, pcm.length, 24000);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 0x8000;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    this.playAt = Math.max(this.playAt, ctx.currentTime + 0.03);
    src.start(this.playAt);
    this.playAt += buf.duration;
    this.playing.add(src);
    this.cb.onPhase('speaking');
    src.onended = () => {
      this.playing.delete(src);
      if (!this.playing.size && !this.over) this.cb.onPhase('listening');
    };
  }

  /** Stop what is still to play (the owner talked over AIBOS). */
  private flush() {
    for (const s of this.playing) { try { s.stop(); } catch { /* already done */ } }
    this.playing.clear();
    this.playAt = 0;
    if (!this.over) this.cb.onPhase('listening');
  }

  private endWhenQuiet() {
    const started = Date.now();
    const wait = () => {
      if (this.over) return;
      if (!this.playing.size || Date.now() - started > 8000) { this.finish(null); return; }
      setTimeout(wait, 250);
    };
    setTimeout(wait, 600);
  }

  /** End the session (the owner's choice when `why` is null). */
  finish(why: string | null = null) {
    if (this.over) return;
    this.over = true;
    if (this.timer) clearTimeout(this.timer);
    for (const s of this.playing) { try { s.stop(); } catch { /* done */ } }
    this.playing.clear();
    this.node?.port.close();
    this.node?.disconnect();
    this.mic?.getTracks().forEach((t) => t.stop());
    void this.inCtx?.close().catch(() => {});
    void this.outCtx?.close().catch(() => {});
    try { this.ws?.close(1000); } catch { /* closed */ }
    this.cb.onPhase('ended');
    this.cb.onEnd(why);
  }
}
