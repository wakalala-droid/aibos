'use client';

// components/guide/GuideSphere.tsx
// The AI-BOS sphere: one AI-BOS on every page of the app (owner, 27 and 28 Nov
// 2026). It sits where the chat button used to, bottom right, and the owner
// can put it anywhere.
//
//  * Tap it and talk. AI-BOS answers out loud in real time (Google's Live API,
//    lib/guide/live.ts), reads what is on the screen (lib/guide/screen.ts),
//    points at things, and does things when asked: opens pages, taps, types
//    (lib/guide/act.ts). Taps that pay, send, delete, buy or sign out wait
//    for the owner's yes.
//  * It is the same AI-BOS as the chat: questions about the books, why AI-BOS
//    works something out the way it does, and jobs on the books (record a
//    sale, an invoice, a reminder) go into the chat's conversation
//    (useAiAssistant().ask), so the answer, the lookups and the yes cards are
//    the chat's own. "Chat" in the bubble opens that conversation to read or
//    type.
//  * Waiting, it helps: a hello the first time; the spoken report the first
//    time the app is opened each day when the owner has turned it on (and,
//    once, an offer to turn it on); and with tips on, a short offer to show
//    them round a page they rest on and have not seen before.
//  * Where the live guide cannot run (an old browser, no minutes, Google
//    resting) a tap opens the chat, and Talk buttons fall back to the earlier
//    Talk.
//
// Accessible as a guide must be: one button with its name; Alt G starts and
// ends a talk from anywhere; the arrow keys move it while it has focus;
// everything AI-BOS says is written in the bubble as it speaks (a live
// region); "Type" works without a microphone; with less motion asked for, it
// moves without gliding.

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import AibosSphere from '@/components/talk/AibosSphere';
import { ApiError, endLiveSession, startLiveSession } from '@/lib/api';
import { useAiAssistant, jobLine } from '@/lib/aiAssistant';
import { useAuth } from '@/hooks/useAuth';
import { LiveGuide, type GuidePhase } from '@/lib/guide/live';
import { lookUp, PAGES } from '@/lib/guide/manual';
import { readScreen, target } from '@/lib/guide/screen';
import { spoken, tap, typeInto } from '@/lib/guide/act';
import { getPrefs, loadPrefs, savePrefs, usePrefs } from '@/lib/guide/prefs';
import { GUIDE_EVENT, startBrowserTalk, type GuideMode } from '@/lib/talkEvent';

const SIZE = 56;
const POS_KEY = 'aibos-guide-pos-v2';        // v2: the sphere took the chat button's place
const HINT_KEY = 'aibos-guide-hint-v2';
const DAY_KEY = 'aibos-sphere-day-v1';       // the day the spoken report was last offered
const INVITE_KEY = 'aibos-sphere-invite-v1'; // the one offer to turn the spoken report on
const TIPS_KEY = 'aibos-sphere-tips-v1';     // pages a tip has been offered on
const IDLE_MS = 30_000;                      // resting this long on a new page brings a tip

type Pos = { x: number; y: number };
type Ring = { top: number; left: number; width: number; height: number };
type Offer = 'hint' | 'report' | 'invite' | 'tip';

const WORDS: Record<GuidePhase, string> = {
  connecting: 'Starting', listening: 'Listening', speaking: 'Speaking', thinking: 'Working on it', ended: 'AI-BOS',
};

function homePos(): Pos {
  const w = window.innerWidth, h = window.innerHeight;
  // Where the chat button was: bottom right, and on a phone just above the
  // tabs (measured, so a phone's home-bar inset is cleared too).
  const bar = document.querySelector('.mobile-tabbar')?.getBoundingClientRect();
  const tabs = bar && bar.height > 0 && bar.top < h ? bar : null;
  // On a phone it keeps the pages' 16px side gutter, and so does the chat
  // that opens above it (globals.css, .app-shell .ai-fab-wrap).
  return { x: w - SIZE - (tabs ? 16 : 24), y: h - SIZE - (tabs ? h - tabs.top + 12 : 24) };
}

function clamp(p: Pos): Pos {
  const w = window.innerWidth, h = window.innerHeight;
  // A window with no room (opened minimised, or not laid out yet): leave the
  // point be, or the sphere is pinned off screen and stays there afterwards.
  if (w < SIZE + 16 || h < SIZE + 16) return p;
  return {
    x: Math.min(Math.max(8, p.x), w - SIZE - 8),
    y: Math.min(Math.max(8, p.y), h - SIZE - 8),
  };
}

function still(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function pageOf(path: string) {
  return PAGES.filter((p) => path === p.path || path.startsWith(`${p.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0] ?? null;
}
function pageLabel(path: string): string { return pageOf(path)?.label ?? 'AI-BOS'; }

function read(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
function write(key: string, v: string) { try { localStorage.setItem(key, v); } catch { /* private mode */ } }
function today(): string { return new Date().toLocaleDateString('en-CA'); }
function partOfDay(): string { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
const pause = (ms: number) => new Promise<void>((ok) => { setTimeout(ok, ms); });

export default function GuideSphere() {
  const router = useRouter();
  const pathname = usePathname() || '';
  const chat = useAiAssistant();
  const { user } = useAuth();
  const prefs = usePrefs();
  const [pos, setPos] = useState<Pos | null>(null);
  const [phase, setPhase] = useState<GuidePhase>('ended');
  const [said, setSaid] = useState('');
  const [heard, setHeard] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [offerTalk, setOfferTalk] = useState(false);
  const [muted, setMuted] = useState(false);
  const [noMic, setNoMic] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState('');
  const [ring, setRing] = useState<Ring | null>(null);
  const [pointing, setPointing] = useState('');
  const [doing, setDoing] = useState('');
  const [offer, setOffer] = useState<Offer | null>(null);
  const [gliding, setGliding] = useState(false);
  const [pointSeq, setPointSeq] = useState(0);

  const live = useRef<LiveGuide | null>(null);
  const session = useRef<string | null>(null);
  const home = useRef<Pos | null>(null);              // where the owner put it, to go back to
  const ringEl = useRef<Element | null>(null);
  const drag = useRef<{ dx: number; dy: number; moved: boolean; id: number } | null>(null);
  const dragged = useRef(false);                       // a drag just ended: its click is not a tap
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const posRef = useRef<Pos | null>(null);
  posRef.current = pos;
  const placed = useRef(false);                        // the owner put it somewhere of their own
  const chatRef = useRef(chat);
  chatRef.current = chat;
  const on = phase !== 'ended';
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const fullName = (typeof meta.full_name === 'string' && meta.full_name) || (typeof meta.name === 'string' && meta.name) || '';
  const firstName = fullName.trim().split(/\s+/)[0] || '';

  // Where it sits: where the owner left it, or where the chat button was.
  useEffect(() => {
    let p: Pos | null = null;
    try { const raw = localStorage.getItem(POS_KEY); if (raw) p = JSON.parse(raw) as Pos; } catch { /* private mode */ }
    placed.current = !!(p && Number.isFinite(p.x) && Number.isFinite(p.y));
    setPos(clamp(placed.current && p ? p : homePos()));
    // A new window size: kept on screen where the owner put it, else back to
    // its corner (which moves with the window). Mid-talk it stays where it is.
    const fit = () => setPos((q) => (placed.current || live.current ? clamp(q ?? homePos()) : clamp(homePos())));
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const save = (p: Pos) => { placed.current = true; write(POS_KEY, JSON.stringify(p)); };

  // ── Waiting: one offer at a time, never over a talk or the open chat ───────
  // First visit: hello. Each day, with the spoken report on: "Got a moment?".
  // Once, with it off: the offer to turn it on.
  useEffect(() => {
    let gone = false;
    void loadPrefs().then(async () => {
      await pause(2500);
      // Never over a window that has the owner's attention (What's new, a confirm).
      const modal = () => !!document.querySelector('[role=dialog][aria-modal=true]');
      for (let i = 0; i < 240 && !gone && modal(); i += 1) await pause(500);
      if (gone || live.current || modal()) return;
      const p = getPrefs();
      if (!read(HINT_KEY)) { setOffer('hint'); return; }
      if (p.spoken_report && read(DAY_KEY) !== today()) { write(DAY_KEY, today()); setOffer('report'); return; }
      if (!p.spoken_report && !read(INVITE_KEY)) setOffer('invite');
    });
    return () => { gone = true; };
  }, []);

  // Tips: resting on a page not seen before brings one short offer to show it.
  useEffect(() => {
    if (!prefs.tips || on || chat.open) return;
    const page = pageOf(pathname);
    if (!page) return;
    let seen: string[] = [];
    try { seen = JSON.parse(read(TIPS_KEY) || '[]') as string[]; } catch { seen = []; }
    if (seen.includes(page.path)) return;
    let t: ReturnType<typeof setTimeout>;
    const arm = () => { clearTimeout(t); t = setTimeout(() => {
      if (live.current || document.querySelector('[role=dialog][aria-modal=true]')) return;
      setOffer((o) => o ?? 'tip');
    }, IDLE_MS); };
    const events = ['pointerdown', 'keydown', 'scroll', 'input'] as const;
    for (const e of events) window.addEventListener(e, arm, { passive: true, capture: true });
    arm();
    return () => { clearTimeout(t); for (const e of events) window.removeEventListener(e, arm, { capture: true }); };
  }, [pathname, prefs.tips, on, chat.open]);

  const dismiss = useCallback((which: Offer | null = offer) => {
    if (which === 'hint') write(HINT_KEY, '1');
    if (which === 'invite') write(INVITE_KEY, '1');
    if (which === 'tip') {
      const page = pageOf(pathRef.current);
      let seen: string[] = [];
      try { seen = JSON.parse(read(TIPS_KEY) || '[]') as string[]; } catch { seen = []; }
      if (page && !seen.includes(page.path)) write(TIPS_KEY, JSON.stringify([...seen, page.path].slice(-80)));
    }
    setOffer(null);
  }, [offer]);

  // A new page: the old ring means nothing there, and a tip was for the old page.
  useEffect(() => { setRing(null); ringEl.current = null; setOffer((o) => (o === 'tip' ? null : o)); }, [pathname]);

  // The ring follows its element while the page scrolls or moves.
  useEffect(() => {
    if (!ringEl.current) return;
    let raf = 0;
    const follow = () => {
      const el = ringEl.current;
      if (!el || !el.isConnected) { setRing(null); return; }
      const r = el.getBoundingClientRect();
      setRing((old) => (old && Math.abs(old.top - r.top) < 0.5 && Math.abs(old.left - r.left) < 0.5 && old.width === r.width
        ? old : { top: r.top, left: r.left, width: r.width, height: r.height }));
      raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    const off = setTimeout(() => { setRing(null); ringEl.current = null; }, 9000);
    return () => { cancelAnimationFrame(raf); clearTimeout(off); };
  }, [pointSeq]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Glide beside an element and ring it. */
  const showAt = useCallback(async (el: Element) => {
    const r0 = el.getBoundingClientRect();
    if (r0.top < 72 || r0.bottom > window.innerHeight - 24) {
      el.scrollIntoView({ block: 'center', behavior: still() ? 'auto' : 'smooth' });
      await pause(still() ? 60 : 420);
    }
    const r = el.getBoundingClientRect();
    ringEl.current = el;
    setRing({ top: r.top, left: r.left, width: r.width, height: r.height });
    setPointSeq((n) => n + 1);
    // Beside it: to the right if there is room, else the left, else below.
    const gap = 14;
    let x = r.right + gap;
    let y = r.top + r.height / 2 - SIZE / 2;
    if (x + SIZE > window.innerWidth - 8) x = r.left - gap - SIZE;
    if (x < 8) { x = r.left + r.width / 2 - SIZE / 2; y = r.bottom + gap; }
    if (y + SIZE > window.innerHeight - 8) y = r.top - gap - SIZE;
    setGliding(!still());
    setPos(clamp({ x, y }));
  }, []);

  const nameOf = (el: Element) => ((el.getAttribute('aria-label') || (el as HTMLElement).innerText || el.textContent || '')
    .replace(/\s+/g, ' ').trim()).slice(0, 60);

  const pointAt = useCallback(async (id: string): Promise<string> => {
    const el = target(id);
    if (!el) return `There is no ${id} on screen now. Call read_screen again.`;
    const name = nameOf(el);
    await showAt(el);
    setPointing(name);
    return `Pointing at "${name || id}". It is ringed on screen.`;
  }, [showAt]);

  const goTo = useCallback(async (page: string): Promise<string> => {
    const path = String(page || '').trim().split(/[?#]/)[0];
    const known = PAGES.find((p) => p.path === path);
    if (!known) return `There is no page ${path}. The pages are: ${PAGES.map((p) => p.path).join(', ')}.`;
    setDoing(`Opening ${known.label}`);
    if (pathRef.current !== path) router.push(path);
    // Let the page arrive and draw before reading it.
    const t0 = Date.now();
    while (pathRef.current !== path && Date.now() - t0 < 6000) await pause(150);
    await pause(900);
    return `Now on ${known.label}. ${readScreen(known.label)}`;
  }, [router]);

  const click = useCallback(async (id: string, confirmed: boolean): Promise<string> => {
    const el = target(id);
    if (el) { await showAt(el); setPointing(nameOf(el)); }
    const r = tap(id, confirmed);
    if (!r.ok) return r.said;
    setDoing(r.said.replace(/^Tapped/, 'Tapped'));
    await pause(700);
    return `${r.said} The screen now:\n${readScreen(pageLabel(pathRef.current))}`;
  }, [showAt]);

  const type = useCallback(async (id: string, text: string): Promise<string> => {
    const el = target(id);
    if (el) { await showAt(el); setPointing(nameOf(el)); }
    const r = typeInto(id, text);
    if (r.ok) setDoing(r.said);
    return r.said;
  }, [showAt]);

  // The one AI-BOS: the question or job goes into the chat's conversation.
  const askAibos = useCallback(async (request: string): Promise<string> => {
    setDoing('Checking your books');
    const a = await chatRef.current.ask(String(request || '').slice(0, 2000));
    const parts = [spoken(a.reply) || 'AI-BOS had no answer to that just now.'];
    if (a.waiting.length) {
      // A job's own message is its card's words: say them once, not twice.
      const unsaid = a.waiting.filter((j) => !a.reply.includes(j.said));
      parts.push(`${unsaid.length ? `Waiting for the user's yes: ${unsaid.map((j) => spoken(jobLine(j))).join(' Also: ')}` : 'That is waiting for the user\'s yes.'} Read it back in one sentence, ask "Shall I?", then call answer_job with their answer.`);
    }
    if (a.done.length) parts.push(`Already done (it can be undone): ${a.done.map((j) => spoken(j.did || j.said)).join('; ')}.`);
    return parts.join('\n\n');
  }, []);

  const answerJob = useCallback(async (answer: string): Promise<string> => {
    const verb = answer === 'no' ? 'no' : answer === 'undo' ? 'undo' : 'yes';
    setDoing(verb === 'yes' ? 'Doing it' : verb === 'no' ? 'Leaving it' : 'Taking it back');
    return spoken(await chatRef.current.answerLatest(verb));
  }, []);

  const onTool = useCallback(async (name: string, args: Record<string, unknown>): Promise<string> => {
    switch (name) {
      case 'read_screen': return readScreen(pageLabel(pathRef.current));
      case 'point_at': return pointAt(String(args.id ?? ''));
      case 'click': return click(String(args.id ?? ''), args.confirmed === true);
      case 'type_text': return type(String(args.id ?? ''), String(args.text ?? ''));
      case 'go_to': return goTo(String(args.page ?? ''));
      case 'ask_aibos': return askAibos(String(args.request ?? ''));
      case 'answer_job': return answerJob(String(args.answer ?? 'yes'));
      case 'aibos_manual': return lookUp(String(args.topic ?? ''));
      case 'end_guide': return 'Ending after your goodbye.';
      default: return 'That is not something the sphere can do.';
    }
  }, [goTo, pointAt, click, type, askAibos, answerJob]);

  const backHome = useCallback(() => {
    setRing(null);
    ringEl.current = null;
    setPointing('');
    setDoing('');
    if (home.current) { setGliding(!still()); setPos(clamp(home.current)); }
  }, []);

  /** Where the live guide cannot run: the chat (a tap) or the earlier Talk (a Talk button). */
  const fallBack = useCallback((why: string, via: 'tap' | 'talk') => {
    setPhase('ended');
    if (via === 'talk') { startBrowserTalk(); return; }
    setNote(why);
    setOfferTalk(true);
    chatRef.current.setOpen(true);
  }, []);

  const start = useCallback(async (mode: GuideMode = 'guide', via: 'tap' | 'talk' = 'tap', opening?: string) => {
    if (live.current) return;
    setOffer(null);
    setNote(null);
    setOfferTalk(false);
    setSaid('');
    setHeard('');
    setMuted(false);
    setNoMic(false);
    if (!navigator.mediaDevices?.getUserMedia || typeof WebSocket === 'undefined' || typeof AudioWorkletNode === 'undefined') {
      fallBack('This browser cannot talk live. Chrome or Edge can. You can type to AI-BOS here.', via);
      return;
    }
    chatRef.current.setOpen(false);
    setPhase('connecting');
    home.current = posRef.current;
    let s;
    try {
      s = await startLiveSession(firstName);
    } catch (e) {
      fallBack(e instanceof ApiError ? `${e.message} You can type to AI-BOS here.` : 'AI-BOS could not start talking just now. You can type to it here.', via);
      return;
    }
    session.current = s.session_id;
    const label = pageLabel(pathRef.current);
    const first = mode === 'report'
      ? `(spoken report) The user is on the ${label} page and said yes to hearing how the business is doing.`
      : opening ?? `(The user just tapped the AI-BOS sphere on the ${label} page. Greet them in one short sentence and ask what they would like help with.)`;
    const g = new LiveGuide({ ws: s.ws, token: s.token, setup: s.setup, maxSeconds: s.max_seconds, opening: first }, {
      onPhase: (p) => { setPhase(p); if (p === 'listening') setDoing(''); },
      onCaption: (who, text, fresh) => {
        if (who === 'aibos') setSaid((t) => (fresh ? text : t + text).slice(-400));
        else setHeard((t) => (fresh ? text : t + text).slice(-200));
      },
      onTool,
      onEnd: (why) => {
        const id = session.current;
        const usage = g.usage;
        live.current = null;
        session.current = null;
        chatRef.current.setTalking(false);
        setTyping(false);
        backHome();
        if (why) setNote(why);
        if (id) {
          void endLiveSession(id, { seconds: g.seconds, usage, error: why })
            .then((r) => { if (!why && typeof r.minutes_left === 'number' && r.minutes_left <= 2) {
              setNote(r.minutes_left === 0 ? 'That was the last of this month\'s minutes of live talk. You can still type to AI-BOS.' : `${r.minutes_left} minute${r.minutes_left === 1 ? '' : 's'} of live talk left this month.`);
            } })
            .catch(() => { /* the reserved time stands */ });
        }
      },
    });
    live.current = g;
    // Jobs asked for in a live talk are logged as spoken.
    chatRef.current.setTalking(true);
    try {
      const hears = await g.start();
      if (!hears) {
        // No microphone (refused, or none): carry on by typing; AI-BOS still speaks.
        setMuted(true);
        setNoMic(true);
        setTyping(true);
      }
    } catch {
      g.finish('AI-BOS could not start talking on this device.');
    }
  }, [backHome, onTool, fallBack, firstName]);

  const end = useCallback(() => { live.current?.finish(null); }, []);

  // Every "Talk to AI-BOS" in the app comes here (lib/talkEvent.ts).
  useEffect(() => {
    const onGuide = (e: Event) => {
      const mode = ((e as CustomEvent<{ mode?: GuideMode }>).detail?.mode) ?? 'guide';
      if (!live.current) void start(mode, 'talk');
    };
    window.addEventListener(GUIDE_EVENT, onGuide);
    return () => window.removeEventListener(GUIDE_EVENT, onGuide);
  }, [start]);

  // Alt G from anywhere; Escape ends a talk.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (live.current) end(); else void start();
      } else if (e.key === 'Escape' && live.current && !chatRef.current.open && !document.querySelector('[role=dialog][aria-modal=true]')) {
        // With the chat open, Escape closes the chat first (its own key).
        end();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [end, start]);

  // Leaving the app ends it (the microphone must not stay open).
  // Closing the tab or the app ends it too, so only the time used is counted.
  useEffect(() => {
    const bye = () => { live.current?.finish(null); };
    window.addEventListener('pagehide', bye);
    return () => { window.removeEventListener('pagehide', bye); bye(); };
  }, []);

  useEffect(() => {
    if (!note || on) return;
    const t = setTimeout(() => { setNote(null); setOfferTalk(false); }, 12000);
    return () => clearTimeout(t);
  }, [note, on]);

  if (!pos) return null;

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, moved: false, id: e.pointerId };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const next = { x: e.clientX - d.dx, y: e.clientY - d.dy };
    if (!d.moved && Math.hypot(next.x - pos.x, next.y - pos.y) < 6) return;
    if (!d.moved) { d.moved = true; e.currentTarget.setPointerCapture(e.pointerId); }
    setGliding(false);
    setPos(clamp(next));
  };
  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) {
      dragged.current = true;
      setTimeout(() => { dragged.current = false; }, 0);
      const p = clamp({ x: e.clientX - d.dx, y: e.clientY - d.dy });
      save(p);
      home.current = p;
      if (offer === 'hint') dismiss('hint');
    }
  };
  const onClick = () => {
    if (dragged.current) return;
    if (live.current) { end(); return; }
    if (chat.open) { chat.setOpen(false); return; }
    if (offer) dismiss(offer === 'report' ? null : offer);
    void start();
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const step = e.shiftKey ? 96 : 24;
    const move: Record<string, Pos> = { ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step } };
    const m = move[e.key];
    if (!m) return;
    e.preventDefault();
    setGliding(false);
    const p = clamp({ x: pos.x + m.x, y: pos.y + m.y });
    setPos(p);
    save(p);
    home.current = p;
  };

  const sphere = phase === 'speaking' ? 'speaking' : phase === 'listening' ? 'listening' : phase === 'thinking' || phase === 'connecting' ? 'thinking' : 'idle';
  // The bubble opens beside the sphere on the side with room; on a narrow
  // screen with no room either side it sits above or below it, kept on screen.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const bw = Math.min(320, vw - 32);
  const left = pos.x > vw / 2;
  const above = pos.y > vh / 2;
  let bx = left ? pos.x - 10 - bw : pos.x + SIZE + 10;
  const beside = bx >= 16 && bx + bw <= vw - 16;
  bx = Math.min(Math.max(16, bx), vw - 16 - bw);
  const bubbleStyle: React.CSSProperties = beside
    ? { left: bx, [above ? 'bottom' : 'top']: above ? vh - pos.y - SIZE : pos.y }
    : { left: bx, [above ? 'bottom' : 'top']: above ? vh - pos.y + 10 : pos.y + SIZE + 10 };
  // Never over the open chat: the chat is the same conversation, written out.
  const showBubble = !chat.open && (on || !!note || !!offer);
  const status = doing || (pointing && phase !== 'connecting' ? `Pointing at ${pointing}` : '');
  const tipPage = pageOf(pathname);

  return (
    <div data-guide-ui="" className="guide-layer">
      {ring && (
        <div className={`guide-ring${still() ? ' is-still' : ''}`} aria-hidden="true"
          style={{ top: ring.top - 6, left: ring.left - 6, width: ring.width + 12, height: ring.height + 12 }} />
      )}

      <button
        type="button"
        className={`guide-orb${on ? ' is-on' : ''}${gliding ? ' is-gliding' : ''}${on && muted ? ' is-muted' : ''}`}
        style={{ left: pos.x, top: pos.y, width: SIZE, height: SIZE }}
        aria-label={on ? 'End the talk with AI-BOS (Alt G)' : chat.open ? 'Close the chat with AI-BOS' : 'AI-BOS: tap to talk. It can show you round, answer anything and do jobs for you (Alt G). Arrow keys move it.'}
        aria-pressed={on}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        onPointerCancel={() => { drag.current = null; }}
        onClick={onClick} onKeyDown={onKeyDown}
        onTransitionEnd={() => setGliding(false)}
      >
        <AibosSphere size={SIZE} phase={sphere} pulse={said.length} still={!on || still()} />
      </button>

      {showBubble && (
        <div className="guide-bubble" style={bubbleStyle} role="region" aria-label="AI-BOS">
          {on ? (
            <>
              <p className="guide-phase">{noMic && phase === 'listening' ? 'Type your reply' : muted && !noMic ? 'Microphone off' : WORDS[phase]}{status ? ` · ${status}` : ''}</p>
              <p className="guide-said" aria-live="polite">{said || (phase === 'connecting' ? 'Waking up…' : ' ')}</p>
              {/* What they said or typed; with no microphone, until they type, how to talk out loud. */}
              {heard ? <p className="guide-heard">You: {heard}</p>
                : noMic ? <p className="guide-heard">Microphone off: type to AI-BOS. To talk out loud, allow the microphone for this site.</p> : null}
              {typing ? (
                <form className="guide-type" onSubmit={(e) => { e.preventDefault(); const t = typed.trim(); if (t) { live.current?.sendText(t); setHeard(t); setTyped(''); } }}>
                  <label htmlFor="guide-typed" className="sr-only">Type to AI-BOS</label>
                  <input id="guide-typed" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Ask or tell AI-BOS anything" autoFocus />
                  <button type="submit" className="pill pill-primary">Send</button>
                </form>
              ) : null}
              <div className="guide-acts">
                {!noMic && (
                  <button type="button" className="pill pill-quiet" onClick={() => { const m = !muted; setMuted(m); live.current?.setMuted(m); }}>
                    {muted ? 'Microphone on' : 'Mute'}
                  </button>
                )}
                <button type="button" className="pill pill-quiet" onClick={() => setTyping((t) => !t)}>{typing ? 'Hide typing' : 'Type'}</button>
                <button type="button" className="pill pill-quiet" onClick={() => chat.setOpen(true)}>Chat</button>
                <button type="button" className="pill" onClick={end}>End</button>
              </div>
            </>
          ) : note ? (
            <>
              <p className="guide-said" role="status">{note}</p>
              <div className="guide-acts">
                {offerTalk && <button type="button" className="pill pill-primary" onClick={() => { setNote(null); setOfferTalk(false); startBrowserTalk(); }}>Talk instead</button>}
                <button type="button" className="pill pill-quiet" onClick={() => { setNote(null); setOfferTalk(false); }}>Close</button>
              </div>
            </>
          ) : offer === 'report' ? (
            <>
              <p className="guide-phase">Your spoken report</p>
              <p className="guide-said">{partOfDay()}{firstName ? `, ${firstName}` : ''}. Got a moment? I can tell you how the business is looking and what I suggest next.</p>
              <div className="guide-acts">
                <button type="button" className="pill pill-primary" onClick={() => { setOffer(null); void start('report'); }}>Yes, tell me</button>
                <button type="button" className="pill pill-quiet" onClick={() => setOffer(null)}>Not now</button>
              </div>
            </>
          ) : offer === 'invite' ? (
            <>
              <p className="guide-phase">New: the spoken report</p>
              <p className="guide-said">I can tell you out loud how your business is doing, and what I suggest, each time you open AI-BOS. Want that?</p>
              <div className="guide-acts">
                <button type="button" className="pill pill-primary" onClick={() => {
                  dismiss('invite');
                  void savePrefs({ spoken_report: true }).then((n) => setNote(n ?? 'Done. I will offer it when you first open AI-BOS each day. Change it in Settings.'));
                }}>Turn it on</button>
                <button type="button" className="pill pill-quiet" onClick={() => { dismiss('invite'); void start('report'); }}>Tell me now</button>
                <button type="button" className="pill pill-quiet" onClick={() => dismiss('invite')}>No thanks</button>
              </div>
            </>
          ) : offer === 'tip' && tipPage ? (
            <>
              <p className="guide-phase">{tipPage.label}</p>
              <p className="guide-said">{tipPage.note.split(/(?<=\.)\s/)[0]} Want me to show you round?</p>
              <div className="guide-acts">
                <button type="button" className="pill pill-primary" onClick={() => {
                  dismiss('tip');
                  void start('guide', 'tap', `(The user is on the ${tipPage.label} page and said yes to being shown round it. Read the screen, then point at the two or three most useful things one by one, saying what each does in a sentence. Then ask what they would like to do here.)`);
                }}>Show me</button>
                <button type="button" className="pill pill-quiet" onClick={() => dismiss('tip')}>Not now</button>
              </div>
            </>
          ) : offer === 'hint' ? (
            <>
              <p className="guide-phase">Hello, I am AI-BOS</p>
              <p className="guide-said">Tap me and talk. I can show you round, answer anything about your business or this app, and do jobs for you. Drag me anywhere.</p>
              <div className="guide-acts">
                <button type="button" className="pill pill-primary" onClick={() => { dismiss('hint'); void start(); }}>Talk now</button>
                <button type="button" className="pill pill-quiet" onClick={() => dismiss('hint')}>Got it</button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
