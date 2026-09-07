'use client';

/**
 * The welcome an owner sees after their account is upgraded.
 *
 * Until now an upgrade was silent. The locks came off and the customer had to
 * notice on their own, which means a plan they are paying for reads as no
 * different from the one they were on. This says what they now have, in their
 * words, and points at where each thing lives.
 *
 * IT STAYS UNTIL THEY CLOSE IT. Not a toast, not a badge, not something that
 * disappears on a refresh: the state lives on their profile row
 * (welcome_seen_tier, migration 0028), so it survives a reload, a new device
 * and a different browser, and closing it is a decision they made rather than
 * something they missed.
 *
 * Storing the TIER they closed, rather than a flag, is what makes a second
 * upgrade work. Pro today and Growth in a year each get their own welcome, and
 * a downgrade stays quiet.
 *
 * The panel is a separate, pure component from the thing that decides whether
 * to show it. That split is what lets the design be looked at without an
 * account on every plan to log into.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import BorderGlow from '@/components/ui/BorderGlow';
import { useProfile } from '@/lib/profile';
import { useStore } from '@/lib/store';
import { isPaidTier, TIERS, type Tier } from '@/lib/tiers';
import { tourFor } from '@/lib/tourStops';

/** Fired when the welcome leaves the screen, so anything that was waiting for
 *  it can start. Listened for by DashboardTour. */
export const WELCOME_CLOSED_EVENT = 'aibos:welcome-closed';

const CURSOR_GLOW = '190 95 62';
const MESH = ['#22d3ee', '#60a5fa', '#a78bfa'];

const primary: React.CSSProperties = {
  padding: '12px 24px', minHeight: 48, borderRadius: 10, border: 'none',
  color: '#fff', fontSize: 17, fontWeight: 700, cursor: 'pointer',
};

const ghost: React.CSSProperties = {
  padding: '12px 20px', minHeight: 48, borderRadius: 10,
  background: 'transparent', border: '1px solid var(--border-md)',
  color: 'var(--text-2)', fontSize: 17, fontWeight: 600, cursor: 'pointer',
};

// ── The panel ───────────────────────────────────────────────────────────────

export interface WelcomeTourPanelProps {
  tier: Tier;
  step: number;
  onStep: (next: number) => void;
  onClose: () => void;
  closing?: boolean;
}

export function WelcomeTourPanel({ tier, step, onStep, onClose, closing = false }: WelcomeTourPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusTo = useRef<Element | null>(null);

  const chapters = useMemo(() => tourFor(tier), [tier]);
  // Welcome first, then a chapter each. There is no closing screen: the last
  // chapter's button finishes it, because an extra "you're all set" page is a
  // click that tells nobody anything.
  const total = chapters.length + 1;
  const meta = TIERS[tier];

  // Escape closes. A click on the backdrop does NOT: this is worth reading, and
  // losing it to a stray click on the way to the page behind is the one way it
  // would fail at its whole job.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Hold the page still underneath, and put focus where the reading starts.
  //
  // The flag on <body> is how the first-run DashboardTour knows to wait. A new
  // customer who signs up already paying would otherwise get both at once: a
  // spotlight cutting holes in a page they cannot see, behind a panel telling
  // them about their plan.
  useEffect(() => {
    returnFocusTo.current = document.activeElement;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.dataset.welcomeTour = 'open';
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      delete document.body.dataset.welcomeTour;
      window.dispatchEvent(new CustomEvent(WELCOME_CLOSED_EVENT));
      (returnFocusTo.current as HTMLElement | null)?.focus?.();
    };
  }, []);

  const isWelcome = step === 0;
  const chapter = isWelcome ? null : chapters[step - 1];
  const last = step === total - 1;
  const count = chapters.reduce((n, c) => n + c.items.length, 0);

  return (
    <AnimatePresence>
      <motion.div
        key="welcome-tour"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16, overflowY: 'auto',
          background: 'color-mix(in srgb, var(--bg-page) 82%, transparent)',
          backdropFilter: 'blur(6px)',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          style={{ width: '100%', maxWidth: 640, margin: 'auto' }}
        >
          <BorderGlow
            glowColor={CURSOR_GLOW}
            backgroundColor="var(--bg-card)"
            borderRadius={16}
            glowRadius={48}
            glowIntensity={1.2}
            coneSpread={12}
            colors={MESH}
          >
            <div
              ref={panelRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby="welcome-tour-heading"
              className="section-card glow-inner"
              // Roomy on a desktop, tighter on a phone, where a chapter of five
              // items is already 1200px of scrolling before the padding.
              style={{ padding: 'clamp(20px, 4vw, 32px)', outline: 'none' }}
            >
              <span className="bento-tex" aria-hidden="true" />

              {/* Progress. A 2px line, per the design system: never a thick ribbon. */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
                {Array.from({ length: total }, (_, i) => (
                  <span
                    key={i}
                    aria-hidden
                    style={{
                      flex: 1, height: 2, borderRadius: 2,
                      background: i <= step ? meta.accent : 'var(--border)',
                      transition: 'background 0.3s ease',
                    }}
                  />
                ))}
              </div>

              {isWelcome ? (
                <>
                  <span
                    className="badge"
                    style={{ color: meta.accent, borderColor: meta.accent, marginBottom: 16, display: 'inline-block' }}
                  >
                    {meta.name.toUpperCase()}
                  </span>
                  <h2
                    id="welcome-tour-heading"
                    style={{ margin: '0 0 12px', fontSize: 28, lineHeight: 1.2, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-1)' }}
                  >
                    You are on {meta.name}.
                  </h2>
                  <p style={{ margin: '0 0 8px', fontSize: 18, lineHeight: 1.6, fontWeight: 400, color: 'var(--text-2)' }}>
                    {meta.tagline}. {count} {count === 1 ? 'thing is' : 'things are'} open to you
                    now that were not before, and everything you have already recorded works with
                    all of them straight away.
                  </p>
                  <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6, fontWeight: 400, color: 'var(--text-3)' }}>
                    Take a minute and we will show you where each one lives.
                  </p>
                </>
              ) : chapter ? (
                <>
                  <h2
                    id="welcome-tour-heading"
                    style={{ margin: '0 0 8px', fontSize: 24, lineHeight: 1.25, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-1)' }}
                  >
                    {chapter.heading}
                  </h2>
                  <p style={{ margin: '0 0 24px', fontSize: 18, lineHeight: 1.6, fontWeight: 400, color: 'var(--text-3)' }}>
                    {chapter.lead}
                  </p>

                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 16 }}>
                    {chapter.items.map((item) => (
                      <li
                        key={item.feature}
                        style={{ display: 'grid', gap: 4, paddingLeft: 16, borderLeft: `2px solid ${meta.accent}` }}
                      >
                        <span style={{ fontSize: 18, lineHeight: 1.4, fontWeight: 700, color: 'var(--text-1)' }}>
                          {item.title}
                        </span>
                        <span style={{ fontSize: 18, lineHeight: 1.6, fontWeight: 400, color: 'var(--text-3)' }}>
                          {item.body}
                        </span>
                        {item.href ? (
                          <Link
                            href={item.href}
                            onClick={onClose}
                            style={{ fontSize: 17, fontWeight: 600, color: meta.accent, textDecoration: 'none', justifySelf: 'start' }}
                          >
                            Take me there →
                          </Link>
                        ) : (
                          <span style={{ fontSize: 17, lineHeight: 1.6, fontWeight: 400, color: 'var(--text-4)' }}>
                            {item.where}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {/* Stuck to the bottom of the viewport while the card scrolls. On a
                  phone the longest chapter runs well past a screen, and Next
                  sitting at the far end of that reads as no Next at all. */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                  marginTop: 32, position: 'sticky', bottom: 0,
                  paddingTop: 16, marginBottom: -8, paddingBottom: 8,
                  background: 'var(--bg-card)',
                  borderTop: '1px solid var(--border)',
                }}
              >
                {step > 0 && (
                  <button type="button" onClick={() => onStep(Math.max(0, step - 1))} style={ghost}>
                    Back
                  </button>
                )}

                <button
                  type="button"
                  disabled={closing}
                  onClick={() => (last ? onClose() : onStep(step + 1))}
                  style={{ ...primary, background: meta.accent, opacity: closing ? 0.6 : 1 }}
                >
                  {last ? (closing ? 'Closing…' : 'Start using it') : 'Next'}
                </button>

                {!last && (
                  <button
                    type="button"
                    onClick={onClose}
                    style={{ ...ghost, border: 'none', color: 'var(--text-4)', marginLeft: 'auto' }}
                  >
                    I will explore on my own
                  </button>
                )}
              </div>
            </div>
          </BorderGlow>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Whether to show it at all ───────────────────────────────────────────────

export default function WelcomeTour() {
  const { profile, loading, refresh } = useProfile();
  const storeTier = useStore((s) => s.tier);

  const [step, setStep] = useState(0);
  const [closing, setClosing] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // The plan on the profile row is what was paid for. The store's copy is a
  // cache and can be a step behind a fresh grant, so the row wins here.
  const tier = (profile?.tier ?? storeTier) as Tier;
  const seen = profile?.welcome_seen_tier ?? null;

  const open = !loading && !dismissed && Boolean(profile) && isPaidTier(tier) && seen !== tier;

  const close = useCallback(async () => {
    setClosing(true);
    setDismissed(true);          // off the screen at once, not after a round trip
    try {
      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ welcome_seen_tier: tier }),
      });
      await refresh();
    } catch {
      // If it did not save it comes back next time they open the dashboard.
      // Showing a welcome twice is a small cost; swallowing a click they made
      // is not, so the panel closes either way.
    } finally {
      setClosing(false);
    }
  }, [tier, refresh]);

  if (!open) return null;

  return (
    <WelcomeTourPanel
      tier={tier}
      step={step}
      onStep={setStep}
      onClose={() => void close()}
      closing={closing}
    />
  );
}
