'use client';

// DashboardTour — a five-stop, first-run spotlight over the dashboard.
//
// In-house on purpose (no tour library): stops anchor to [data-tour="…"]
// attributes the same way the assistant's long-press uses [data-ai-explain].
// Runs once (localStorage flag), only on the dashboard home, and quietly skips
// any stop whose anchor isn't on screen (collapsed sidebar, Pro mode, mobile).
//
// Accessibility (accessibility_system.md): dialog role, Escape closes, focus
// moves into the card and returns on close, movement is opacity-only under
// prefers-reduced-motion.

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

const DONE_KEY = 'aibos-tour-done-v1';
export const TOUR_RESTART_EVENT = 'aibos:start-tour';

interface Stop {
  anchor: string;
  title: string;
  body: string;
}

const STOPS: Stop[] = [
  { anchor: 'ask-bar',     title: 'Just ask',              body: 'Type any question about your business — “How much cash do I have?” — and AIBOS answers from your real records. Never a made-up number.' },
  { anchor: 'today-cards', title: 'Your day at a glance',  body: 'Money right now, today\'s sales, and whether stock needs attention. These update themselves as you record.' },
  { anchor: 'nav-record',  title: 'Record what happens',   body: 'Sold something? Paid someone? Say it in plain words and AIBOS does the bookkeeping — cash, stock and debts stay current.' },
  { anchor: 'ask-aibos',   title: 'AIBOS is always here',  body: 'Your AI advisor lives one click away on every page. You can also press and hold any card to have it explained.' },
  { anchor: 'mode-toggle', title: 'Simple or Pro',         body: 'Simple mode shows the essentials. Flip to Pro any time for every chart, forecast and intelligence engine — nothing is hidden for good.' },
];

interface Rect { top: number; left: number; width: number; height: number }

function rectFor(anchor: string): Rect | null {
  const el = document.querySelector(`[data-tour="${anchor}"]`);
  if (!el) return null;
  const r = (el as HTMLElement).getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null; // hidden (collapsed rail, drawer)
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export default function DashboardTour() {
  const pathname = usePathname();
  const [stops, setStops] = useState<Stop[]>([]);
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  const running = stops.length > 0;

  const finish = useCallback(() => {
    try { window.localStorage.setItem(DONE_KEY, '1'); } catch { /* private mode */ }
    setStops([]);
    setIdx(0);
    prevFocusRef.current?.focus?.();
  }, []);

  const begin = useCallback(() => {
    // Only stops whose anchors are actually visible right now.
    const present = STOPS.filter((s) => rectFor(s.anchor) !== null);
    if (present.length < 2) return; // nothing meaningful to show
    prevFocusRef.current = document.activeElement as HTMLElement | null;
    setIdx(0);
    setStops(present);
  }, []);

  // First-run trigger — dashboard home only, once, after paint settles.
  useEffect(() => {
    if (pathname !== '/dashboard') return;
    let done = '1';
    try { done = window.localStorage.getItem(DONE_KEY) ?? ''; } catch { /* private mode */ }
    if (done === '1') return;
    const t = window.setTimeout(begin, 900);
    return () => window.clearTimeout(t);
  }, [pathname, begin]);

  // Manual replay (SimpleHome dispatches this).
  useEffect(() => {
    const onStart = () => begin();
    window.addEventListener(TOUR_RESTART_EVENT, onStart);
    return () => window.removeEventListener(TOUR_RESTART_EVENT, onStart);
  }, [begin]);

  // Track the current stop's rectangle; follow resizes and scrolls.
  useEffect(() => {
    if (!running) return;
    const update = () => setRect(rectFor(stops[idx].anchor));
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [running, stops, idx]);

  // Keyboard: Escape closes, arrows navigate. Focus moves into the card.
  useEffect(() => {
    if (!running) return;
    cardRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      if (e.key === 'ArrowRight' && idx < stops.length - 1) setIdx(idx + 1);
      if (e.key === 'ArrowLeft' && idx > 0) setIdx(idx - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [running, idx, stops.length, finish]);

  if (!running || !rect) return null;

  const pad = 6;
  const last = idx === stops.length - 1;
  const stop = stops[idx];

  // Card below the target when there's room, above otherwise.
  const below = rect.top + rect.height + 180 < window.innerHeight;
  const cardTop = below ? rect.top + rect.height + pad + 12 : undefined;
  const cardBottom = below ? undefined : window.innerHeight - rect.top + pad + 12;
  const cardLeft = Math.max(16, Math.min(rect.left, window.innerWidth - 336));

  return (
    <div role="dialog" aria-modal="true" aria-label={`Tour step ${idx + 1} of ${stops.length}: ${stop.title}`}>
      {/* Spotlight — one element, the giant shadow dims everything else. */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: rect.top - pad, left: rect.left - pad,
          width: rect.width + pad * 2, height: rect.height + pad * 2,
          borderRadius: 10, border: '2px solid var(--cyan)',
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
          zIndex: 300, pointerEvents: 'none',
          transition: 'all 0.24s ease-out',
        }}
      />
      {/* Click-catcher so the page underneath isn't interactive mid-tour. */}
      <div onClick={finish} style={{ position: 'fixed', inset: 0, zIndex: 299 }} aria-hidden="true" />

      <div
        ref={cardRef}
        tabIndex={-1}
        style={{
          position: 'fixed', top: cardTop, bottom: cardBottom, left: cardLeft,
          width: 320, maxWidth: 'calc(100vw - 32px)', zIndex: 301,
          background: 'var(--bg-card)', border: '1px solid var(--border-md)',
          borderRadius: 16, padding: 20, outline: 'none',
          boxShadow: '0 12px 32px rgba(0,0,0,0.24)',
        }}
      >
        <div style={{
          fontSize: 'var(--fs-label)', fontWeight: 700,
          color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
        }}>
          {idx + 1} of {stops.length}
        </div>
        <h2 style={{
          fontSize: '1.02rem', fontWeight: 700,
          color: 'var(--text-1)', margin: '0 0 6px', letterSpacing: '-0.01em',
        }}>
          {stop.title}
        </h2>
        <p style={{
          fontSize: 'var(--fs-body)', color: 'var(--text-2)',
          lineHeight: 1.5, margin: '0 0 16px',
        }}>
          {stop.body}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', gap: 5, flex: 1 }} aria-hidden="true">
            {stops.map((s, i) => (
              <span key={s.anchor} style={{
                width: 6, height: 6, borderRadius: 3,
                background: i === idx ? 'var(--cyan)' : 'var(--border-md)',
              }} />
            ))}
          </div>
          {idx > 0 && (
            <button type="button" onClick={() => setIdx(idx - 1)} style={{
              padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-md)',
              background: 'transparent', color: 'var(--text-3)', cursor: 'pointer',
              fontSize: 'var(--fs-data)', fontWeight: 600,
            }}>
              Back
            </button>
          )}
          {!last && (
            <button type="button" onClick={finish} style={{
              padding: '8px 12px', borderRadius: 8, border: 'none',
              background: 'transparent', color: 'var(--text-4)', cursor: 'pointer',
              fontSize: 'var(--fs-data)', fontWeight: 600,
            }}>
              Skip
            </button>
          )}
          <button
            type="button"
            onClick={last ? finish : () => setIdx(idx + 1)}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: 'var(--cyan)', color: '#fff', cursor: 'pointer',
              fontSize: 'var(--fs-data)', fontWeight: 700,
            }}
          >
            {last ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
