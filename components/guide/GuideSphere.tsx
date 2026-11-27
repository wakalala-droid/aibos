'use client';

// components/guide/GuideSphere.tsx
// The live guide (owner, 27 Nov 2026): a small AIBOS sphere on every page of
// the app, which the owner can put anywhere. Tap it and talk: AIBOS answers
// out loud in real time (Google's Live API, lib/guide/live.ts), reads what is
// on the screen (lib/guide/screen.ts), glides beside the thing it is talking
// about and rings it, opens pages and explains AIBOS from its own manual
// (lib/guide/manual.ts). It shows and explains; it never taps, records, sends
// or pays.
//
// Accessible as a guide must be: the sphere is one button with its name; Alt
// G starts and ends it from anywhere; the arrow keys move it while it has
// focus; everything AIBOS says is written in the bubble as it speaks (a live
// region), and what it points at is said by name; "Type" works without a
// microphone; with less motion asked for, it moves without gliding.

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import AibosSphere from '@/components/talk/AibosSphere';
import { ApiError, endLiveSession, startLiveSession } from '@/lib/api';
import { LiveGuide, type GuidePhase } from '@/lib/guide/live';
import { lookUp, PAGES } from '@/lib/guide/manual';
import { readScreen, target } from '@/lib/guide/screen';
import { startTalk } from '@/lib/talkEvent';

const SIZE = 56;
const POS_KEY = 'aibos-guide-pos-v1';
const HINT_KEY = 'aibos-guide-hint-v1';
type Pos = { x: number; y: number };
type Ring = { top: number; left: number; width: number; height: number };

const WORDS: Record<GuidePhase, string> = {
  connecting: 'Starting', listening: 'Listening', speaking: 'Speaking', thinking: 'Looking', ended: 'Live guide',
};

function homePos(): Pos {
  const w = window.innerWidth, h = window.innerHeight;
  // Clear of the chat button (bottom right) and, on a phone, the tabs.
  return { x: w - SIZE - 24, y: h - SIZE - (w < 1024 ? 168 : 104) };
}

function clamp(p: Pos): Pos {
  return {
    x: Math.min(Math.max(8, p.x), window.innerWidth - SIZE - 8),
    y: Math.min(Math.max(8, p.y), window.innerHeight - SIZE - 8),
  };
}

function still(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function pageLabel(path: string): string {
  const best = PAGES.filter((p) => path === p.path || path.startsWith(`${p.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return best?.label ?? 'AIBOS';
}

export default function GuideSphere() {
  const router = useRouter();
  const pathname = usePathname() || '';
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
  const [hint, setHint] = useState(false);
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
  const on = phase !== 'ended';

  // Where it sits: where the owner left it, or clear of the chat button.
  useEffect(() => {
    let p: Pos | null = null;
    try { const raw = localStorage.getItem(POS_KEY); if (raw) p = JSON.parse(raw) as Pos; } catch { /* private mode */ }
    setPos(clamp(p && Number.isFinite(p.x) && Number.isFinite(p.y) ? p : homePos()));
    try { if (!localStorage.getItem(HINT_KEY)) setHint(true); } catch { /* private mode */ }
    const fit = () => setPos((q) => (q ? clamp(q) : q));
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const save = (p: Pos) => { try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch { /* private mode */ } };
  const dropHint = () => { setHint(false); try { localStorage.setItem(HINT_KEY, '1'); } catch { /* private mode */ } };

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

  // A new page: the old ring means nothing there.
  useEffect(() => { setRing(null); ringEl.current = null; }, [pathname]);

  const pointAt = useCallback(async (id: string): Promise<string> => {
    const el = target(id);
    if (!el) return `There is no ${id} on screen now. Call read_screen again.`;
    const name = ((el.getAttribute('aria-label') || (el as HTMLElement).innerText || el.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 60);
    const r0 = el.getBoundingClientRect();
    if (r0.top < 72 || r0.bottom > window.innerHeight - 24) {
      el.scrollIntoView({ block: 'center', behavior: still() ? 'auto' : 'smooth' });
      await new Promise((ok) => setTimeout(ok, still() ? 60 : 420));
    }
    const r = el.getBoundingClientRect();
    ringEl.current = el;
    setRing({ top: r.top, left: r.left, width: r.width, height: r.height });
    setPointSeq((n) => n + 1);
    setPointing(name);
    // Beside it: to the right if there is room, else the left, else below.
    const gap = 14;
    let x = r.right + gap;
    let y = r.top + r.height / 2 - SIZE / 2;
    if (x + SIZE > window.innerWidth - 8) x = r.left - gap - SIZE;
    if (x < 8) { x = r.left + r.width / 2 - SIZE / 2; y = r.bottom + gap; }
    if (y + SIZE > window.innerHeight - 8) y = r.top - gap - SIZE;
    setGliding(!still());
    setPos(clamp({ x, y }));
    return `Pointing at "${name || id}". It is ringed on screen.`;
  }, []);

  const goTo = useCallback(async (page: string): Promise<string> => {
    const path = String(page || '').trim().split(/[?#]/)[0];
    const known = PAGES.find((p) => p.path === path);
    if (!known) return `There is no page ${path}. The pages are: ${PAGES.map((p) => p.path).join(', ')}.`;
    if (pathRef.current !== path) router.push(path);
    // Let the page arrive and draw before reading it.
    const t0 = Date.now();
    while (pathRef.current !== path && Date.now() - t0 < 6000) await new Promise((ok) => setTimeout(ok, 150));
    await new Promise((ok) => setTimeout(ok, 900));
    return `Now on ${known.label}. ${readScreen(known.label)}`;
  }, [router]);

  const onTool = useCallback(async (name: string, args: Record<string, unknown>): Promise<string> => {
    switch (name) {
      case 'read_screen': return readScreen(pageLabel(pathRef.current));
      case 'point_at': return pointAt(String(args.id ?? ''));
      case 'go_to': return goTo(String(args.page ?? ''));
      case 'aibos_manual': return lookUp(String(args.topic ?? ''));
      case 'end_guide': return 'Ending after your goodbye.';
      default: return 'That is not something the guide can do.';
    }
  }, [goTo, pointAt]);

  const backHome = useCallback(() => {
    setRing(null);
    ringEl.current = null;
    setPointing('');
    if (home.current) { setGliding(!still()); setPos(clamp(home.current)); }
  }, []);

  const start = useCallback(async () => {
    if (live.current) return;
    dropHint();
    setNote(null);
    setOfferTalk(false);
    setSaid('');
    setHeard('');
    setMuted(false);
    setNoMic(false);
    if (!navigator.mediaDevices?.getUserMedia || typeof WebSocket === 'undefined' || typeof AudioWorkletNode === 'undefined') {
      setNote('This browser cannot run the live guide. Chrome or Edge can. Talk works here.');
      setOfferTalk(true);
      return;
    }
    setPhase('connecting');
    home.current = pos;
    let s;
    try {
      s = await startLiveSession();
    } catch (e) {
      setPhase('ended');
      setNote(e instanceof ApiError ? e.message : 'The live guide could not start just now. Try again in a minute.');
      setOfferTalk(true);
      return;
    }
    session.current = s.session_id;
    const label = pageLabel(pathRef.current);
    const g = new LiveGuide({
      ws: s.ws, token: s.token, setup: s.setup, maxSeconds: s.max_seconds,
      opening: `(The user just tapped the live guide on the ${label} page. Greet them in one short sentence and ask what they would like help with.)`,
    }, {
      onPhase: setPhase,
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
        setTyping(false);
        backHome();
        if (why) setNote(why);
        if (id) {
          void endLiveSession(id, { seconds: g.seconds, usage, error: why })
            .then((r) => { if (!why && typeof r.minutes_left === 'number' && r.minutes_left <= 2) {
              setNote(r.minutes_left === 0 ? 'That was the last of this month\'s live guide minutes.' : `${r.minutes_left} minute${r.minutes_left === 1 ? '' : 's'} with the live guide left this month.`);
            } })
            .catch(() => { /* the reserved time stands */ });
        }
      },
    });
    live.current = g;
    try {
      const hears = await g.start();
      if (!hears) {
        // No microphone (refused, or none): carry on by typing; AIBOS still speaks.
        setMuted(true);
        setNoMic(true);
        setTyping(true);
        setHeard('Microphone off: type to AIBOS. To talk, allow the microphone for this site.');
      }
    } catch {
      g.finish('The live guide could not start on this device.');
    }
  }, [backHome, onTool, pos]);

  const end = useCallback(() => { live.current?.finish(null); }, []);

  // Alt G from anywhere; Escape ends a live guide.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (live.current) end(); else void start();
      } else if (e.key === 'Escape' && live.current && !document.querySelector('[role=dialog][aria-modal=true]')) {
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
      dropHint();
    }
  };
  const onClick = () => {
    if (dragged.current) return;
    if (live.current) end(); else void start();
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
  const showBubble = on || !!note || hint;

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
        aria-label={on ? 'End the live guide (Alt G)' : 'Live guide: talk with AIBOS about this screen (Alt G). Arrow keys move it.'}
        aria-pressed={on}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        onPointerCancel={() => { drag.current = null; }}
        onClick={onClick} onKeyDown={onKeyDown}
        onTransitionEnd={() => setGliding(false)}
      >
        <AibosSphere size={SIZE} phase={sphere} pulse={said.length} still={!on || still()} />
      </button>

      {showBubble && (
        <div className="guide-bubble" style={bubbleStyle} role="region" aria-label="Live guide">
          {on ? (
            <>
              <p className="guide-phase">{muted && !noMic ? 'Microphone off' : WORDS[phase]}{pointing && phase !== 'connecting' ? ` · pointing at ${pointing}` : ''}</p>
              <p className="guide-said" aria-live="polite">{said || (phase === 'connecting' ? 'Waking up…' : ' ')}</p>
              {heard && <p className="guide-heard">You: {heard}</p>}
              {typing ? (
                <form className="guide-type" onSubmit={(e) => { e.preventDefault(); const t = typed.trim(); if (t) { live.current?.sendText(t); setHeard(t); setTyped(''); } }}>
                  <label htmlFor="guide-typed" className="sr-only">Type to AIBOS</label>
                  <input id="guide-typed" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Ask how anything works" autoFocus />
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
                <button type="button" className="pill" onClick={end}>End</button>
              </div>
            </>
          ) : note ? (
            <>
              <p className="guide-said" role="status">{note}</p>
              <div className="guide-acts">
                {offerTalk && <button type="button" className="pill pill-primary" onClick={() => { setNote(null); setOfferTalk(false); startTalk(); }}>Talk instead</button>}
                <button type="button" className="pill pill-quiet" onClick={() => { setNote(null); setOfferTalk(false); }}>Close</button>
              </div>
            </>
          ) : (
            <>
              <p className="guide-phase">New: the live guide</p>
              <p className="guide-said">Tap me and ask how anything works. I read the screen, point and explain. Drag me anywhere.</p>
              <div className="guide-acts">
                <button type="button" className="pill pill-quiet" onClick={dropHint}>Got it</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
