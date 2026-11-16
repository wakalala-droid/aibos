'use client';
/**
 * lib/voice.ts: AIBOS speaks and listens (Jarvis, phase 1, 16 Nov 2026).
 *
 *  - speak(): the device's own voice (speechSynthesis). Free, instant, works
 *    offline, and costs none of the AI's daily requests. A British English
 *    voice first, the way the owner pictures Jarvis, then any English one.
 *  - listenOnce(): one spoken turn. The browser's speech recognition where it
 *    exists (Chrome, Edge, Safari), otherwise a recording that stops by itself
 *    when the owner stops talking and goes to /transcribe, as the Record page
 *    already does for phones without speech recognition.
 *  - speakable(): chat markdown and money in words a voice reads properly
 *    ("K1,240.50" is "1,240 kwacha 50 ngwee"), as the API's spoken_brief does.
 */
import { transcribeAudio } from '@/lib/api';

type Rec = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error?: string }) => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};

function recognitionCtor(): (new () => Rec) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

/** How this device can hear the owner: 'speech' (live), 'record' (a note to transcribe), or not at all. */
export function listenMode(): 'speech' | 'record' | null {
  if (recognitionCtor()) return 'speech';
  if (typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices && 'getUserMedia' in navigator.mediaDevices) return 'record';
  return null;
}

// ── Words for the voice ──────────────────────────────────────────────────────

function amount(sign: string, whole: string, cents: string | undefined, big: string, small: string): string {
  const c = cents ? parseInt(cents.padEnd(2, '0'), 10) : 0;
  return `${sign ? 'minus ' : ''}${whole} ${big}${c ? ` ${c} ${small}` : ''}`;
}

/** The longest an answer is read aloud; the rest stays on screen. */
export const SPOKEN_MAX = 520;

export function speakable(md: string, max = SPOKEN_MAX): string {
  let s = String(md || '');
  s = s.replace(/```[\s\S]*?```/g, ' ');
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');                 // [text](link) -> text
  s = s.replace(/^\s*\|.*\|\s*$/gm, ' ');                         // tables stay on screen
  s = s.replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, '');                // list markers
  s = s.replace(/\*\*|__|`|^#+\s*/gm, '');
  s = s.replace(/(?<![A-Za-z])(-?)K\s?(\d[\d,]*)(?:\.(\d{1,2}))?/g,
    (_m, sign: string, whole: string, cents?: string) => amount(sign, whole, cents, 'kwacha', 'ngwee'));
  s = s.replace(/(-?)\$\s?(\d[\d,]*)(?:\.(\d{1,2}))?/g,
    (_m, sign: string, whole: string, cents?: string) => amount(sign, whole, cents, 'dollars', 'cents'));
  s = s.replace(/\s*[\u00b7\u2014]\s*/g, ', ').replace(/\u2026/g, ', and more').replace(/\u2013/g, ' to ');
  s = s.replace(/\s*\n+\s*/g, '. ').replace(/\.\s*\./g, '.').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  // Whole sentences up to the limit, then point at the screen.
  const cut = s.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  return `${end > 80 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(' '))}.`} The rest is on your screen.`;
}

// ── Speaking ─────────────────────────────────────────────────────────────────

let chosen: SpeechSynthesisVoice | null | undefined;

function pickVoice(): SpeechSynthesisVoice | null {
  if (chosen !== undefined) return chosen;
  const voices = canSpeak() ? window.speechSynthesis.getVoices() : [];
  if (!voices.length) return null;                                 // not loaded yet: ask again next time
  const lang = (navigator.language || 'en-GB').toLowerCase();
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  const natural = (v: SpeechSynthesisVoice) => /natural|online|neural|premium|enhanced|google/i.test(v.name);
  const male = (v: SpeechSynthesisVoice) => /ryan|daniel|george|arthur|oliver|thomas|male|uk english male/i.test(v.name);
  const gb = english.filter((v) => /en[-_]gb/i.test(v.lang));
  chosen = (lang.startsWith('en') ? null : voices.find((v) => v.lang.toLowerCase() === lang))
    || gb.find((v) => natural(v) && male(v)) || gb.find(natural) || gb.find(male) || gb[0]
    || english.find(natural) || english[0] || voices[0] || null;
  return chosen;
}

if (canSpeak()) {
  window.speechSynthesis.addEventListener?.('voiceschanged', () => { chosen = undefined; });
}

/** Call inside a tap: some phones only let a page talk after a touch. */
export function primeSpeech(): void {
  if (!canSpeak()) return;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    window.speechSynthesis.speak(u);
  } catch { /* nothing to prime */ }
}

export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel();
}

/** Say `text`; resolves when it is finished or stopped. Long text goes a
 *  sentence at a time: Chrome cuts a single long utterance off mid-way. */
export function speak(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!canSpeak() || !text.trim()) { resolve(); return; }
    const synth = window.speechSynthesis;
    synth.cancel();
    const parts = text.match(/[^.!?]+[.!?]*\s*/g)?.map((p) => p.trim()).filter(Boolean) || [text];
    const voice = pickVoice();
    let left = parts.length;
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    parts.forEach((p) => {
      const u = new SpeechSynthesisUtterance(p);
      if (voice) { u.voice = voice; u.lang = voice.lang; }
      u.rate = 1.02;
      u.onend = () => { left -= 1; if (left <= 0) finish(); };
      u.onerror = () => finish();                                  // cancelled or failed: move on
      synth.speak(u);
    });
    // A voice that never reports its end must not hang the conversation.
    setTimeout(finish, 2500 + text.length * 90);
  });
}

// ── Listening ────────────────────────────────────────────────────────────────

export interface ListenOpts {
  onInterim?: (text: string) => void;
  signal?: AbortSignal;
}

/** One spoken turn: the words, or '' when nothing was said. */
export function listenOnce(opts: ListenOpts = {}): Promise<string> {
  return listenMode() === 'speech' ? listenLive(opts) : listenRecorded(opts);
}

function listenLive({ onInterim, signal }: ListenOpts): Promise<string> {
  return new Promise((resolve, reject) => {
    const Ctor = recognitionCtor();
    if (!Ctor) { resolve(''); return; }
    const rec = new Ctor();
    rec.lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-GB';
    rec.interimResults = true;
    rec.continuous = false;
    let heard = '';
    let failed: string | null = null;
    rec.onresult = (e) => {
      heard = Array.from(e.results).map((r) => r[0]?.transcript || '').join('').trim();
      onInterim?.(heard);
    };
    rec.onerror = (e) => { if (e.error && e.error !== 'no-speech' && e.error !== 'aborted') failed = e.error; };
    rec.onend = () => {
      if (failed === 'not-allowed' || failed === 'service-not-allowed') reject(new Error('mic'));
      else resolve(heard);
    };
    signal?.addEventListener('abort', () => { heard = ''; try { rec.abort(); } catch { /* ended */ } });
    try { rec.start(); } catch { resolve(''); }
  });
}

/** Silence detection for the recording fallback. */
const QUIET_AFTER_SPEECH_MS = 1400;
const NOTHING_SAID_MS = 7000;
const LONGEST_MS = 30000;

async function listenRecorded({ onInterim, signal }: ListenOpts): Promise<string> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    throw new Error('mic');
  }
  const rec = new MediaRecorder(stream);
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
    .AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  const ctx = AC ? new AC() : null;
  const analyser = ctx?.createAnalyser();
  if (ctx && analyser) ctx.createMediaStreamSource(stream).connect(analyser);
  const buf = new Uint8Array(analyser?.fftSize || 0);

  const stopped = new Promise<void>((res) => { rec.onstop = () => res(); });
  rec.start(250);
  const t0 = Date.now();
  let spoke = false;
  let lastLoud = t0;
  let cancelled = false;
  signal?.addEventListener('abort', () => { cancelled = true; });

  await new Promise<void>((res) => {
    const tick = () => {
      const now = Date.now();
      if (analyser) {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
        if (Math.sqrt(sum / (buf.length || 1)) > 0.04) { lastLoud = now; if (!spoke) { spoke = true; onInterim?.('…'); } }
      } else if (now - t0 > 6000) { spoke = true; }                // no analyser: a fixed six seconds
      const over = cancelled || now - t0 > LONGEST_MS
        || (spoke && now - lastLoud > QUIET_AFTER_SPEECH_MS) || (!spoke && now - t0 > NOTHING_SAID_MS);
      if (over) res(); else setTimeout(tick, 120);
    };
    tick();
  });

  if (rec.state === 'recording') rec.stop();
  await stopped;
  stream.getTracks().forEach((t) => t.stop());
  ctx?.close().catch(() => {});
  if (cancelled || !spoke || !chunks.length) return '';
  const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
  try {
    return await transcribeAudio(blob);
  } catch {
    return '';
  }
}
