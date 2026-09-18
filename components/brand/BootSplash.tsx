'use client';

/**
 * The AIBOS opening screen: the white mark, and under it the name in full,
 * ARTIFICIAL INTELLIGENCE / BUSINESS OPERATING SYSTEM, between two brass rules.
 *
 * It covers the app from the first paint until the owner's account has been
 * read, so nobody sees a sidebar saying "Checking…" over empty cards. It is
 * rendered on the server too, and it sits on the app's own dark colour (the
 * manifest's background_color), so an installed app goes from the phone's
 * splash to this one without a flash. The tagline is real text, not the
 * lockup PNG, whose tagline reads "ARTFICIAL" and "OPERATIING".
 *
 * Shown once per open of the app, never on a move between pages. If the page's
 * scripts never run, CSS lifts it after eight seconds on its own.
 */

import { useEffect, useRef, useState } from 'react';
import { useProfile } from '@/lib/profile';

/** Long enough not to flicker, short enough not to be a delay. */
const MIN_MS = 700;
/** Never hold the app hostage to one slow request. */
const MAX_MS = 6000;

export const BRAND_BG = '#0a0e1a';
const BRASS = '#d3bc8f';

/** The mark and the name. Used by the opening screen and the sign-in page. */
export function BrandLockup({ markSize = 196 }: { markSize?: number }) {
  return (
    <div className="brand-lockup" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- the one brand mark, preloaded, nothing to optimise */}
      <img
        src="/brand/aibos-mark-white-glyph.png"
        alt="AIBOS"
        width={markSize}
        height={markSize}
        style={{ display: 'block', width: markSize, height: markSize }}
      />
      <div
        style={{
          display: 'inline-flex', flexDirection: 'column', alignItems: 'stretch',
          marginTop: Math.round(markSize * 0.16), color: '#e8ecf3',
          fontFamily: "'Geist', system-ui, sans-serif", fontWeight: 500,
          fontSize: 'clamp(14px, 3.9vw, 18px)', lineHeight: 1.5,
          letterSpacing: 'clamp(0.14em, 0.9vw, 0.3em)', textTransform: 'uppercase',
        }}
      >
        {/* The first line sits between two brass rules that run out past the
            second, as on the printed lockup. */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.6em', margin: '0 -1.4em' }}>
          <span className="brand-rule" aria-hidden="true" style={{ flex: 1, height: 1, marginBottom: '0.3em', background: BRASS }} />
          <span style={{ whiteSpace: 'nowrap', marginRight: '-0.3em' }}>Artificial Intelligence</span>
          <span className="brand-rule" aria-hidden="true" style={{ flex: 1, height: 1, marginBottom: '0.3em', background: BRASS }} />
        </div>
        <span style={{ whiteSpace: 'nowrap', textAlign: 'center', marginRight: '-0.3em' }}>Business Operating System</span>
      </div>
    </div>
  );
}

export default function BootSplash() {
  const { loading } = useProfile();
  const openedAt = useRef(Date.now());
  const [phase, setPhase] = useState<'on' | 'leaving' | 'gone'>('on');

  useEffect(() => {
    if (phase !== 'on') return;
    const leave = () => setPhase('leaving');
    const cap = window.setTimeout(leave, MAX_MS - (Date.now() - openedAt.current));
    if (!loading) {
      const wait = Math.max(0, MIN_MS - (Date.now() - openedAt.current));
      const t = window.setTimeout(leave, wait);
      return () => { window.clearTimeout(t); window.clearTimeout(cap); };
    }
    return () => window.clearTimeout(cap);
  }, [loading, phase]);

  useEffect(() => {
    if (phase !== 'leaving') return;
    const t = window.setTimeout(() => setPhase('gone'), 420);
    return () => window.clearTimeout(t);
  }, [phase]);

  if (phase === 'gone') return null;

  return (
    <div
      className={`boot-splash${phase === 'leaving' ? ' boot-splash--leaving' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Opening AIBOS"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999, background: BRAND_BG,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <BrandLockup />
    </div>
  );
}
