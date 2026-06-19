'use client';

// LockedPreviewCard — content-layer component (component_system.md).
// Conversion pattern from conversion_psychology.md LOCKED-BUT-VISIBLE RULE:
// a real headline insight (clear), supporting detail (blurred/masked), a lock
// icon, and a one-line unlock CTA. Never hides that a feature exists.
//
// Supports all five required states (component_system.md STATE CONSISTENCY):
//   success | loading | error | empty | disabled

import Link from 'next/link';
import { motion } from 'framer-motion';

export type PreviewState = 'success' | 'loading' | 'error' | 'empty' | 'disabled';

interface LockedPreviewCardProps {
  /** Title of the gated capability, e.g. "12-month Forecast". */
  title: string;
  /** Real, true headline insight derived from the user's own data — shown clearly. */
  headline: string;
  /** Supporting detail that is blurred/masked behind the lock. */
  detail: string;
  /** One-line unlock CTA, e.g. "Unlock with Pro — see the full forecast". */
  ctaLabel: string;
  ctaHref?: string;
  colour?: string;
  /** Short plan badge, e.g. "PRO". */
  badge?: string;
  state?: PreviewState;
  /** Error message, used when state="error". */
  errorMessage?: string;
  /** Empty-state guidance, used when state="empty". */
  emptyMessage?: string;
  delay?: number;
}

function LockIcon({ colour }: { colour: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" stroke={colour} strokeWidth="1.6" fill="none" />
      <path d="M8 11V7a4 4 0 018 0v4" stroke={colour} strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function CardFrame({
  children, colour, delay = 0,
}: { children: React.ReactNode; colour: string; delay?: number }) {
  return (
    <motion.div
      className="section-card"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay, ease: 'easeOut' }}
      style={{ position: 'relative', overflow: 'hidden', borderColor: `color-mix(in srgb, ${colour} 22%, var(--border))` }}
    >
      {children}
    </motion.div>
  );
}

export default function LockedPreviewCard({
  title,
  headline,
  detail,
  ctaLabel,
  ctaHref = '/pricing',
  colour = 'var(--cyan)',
  badge = 'PRO',
  state = 'success',
  errorMessage = 'Could not load this preview. Try again shortly.',
  emptyMessage = 'Upload more data and this insight will appear here.',
  delay = 0,
}: LockedPreviewCardProps) {

  // ── loading ──────────────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <CardFrame colour={colour} delay={delay}>
        <div className="skeleton" style={{ height: 14, width: '40%', marginBottom: 14 }} aria-hidden="true" />
        <div className="skeleton" style={{ height: 22, width: '85%', marginBottom: 10 }} aria-hidden="true" />
        <div className="skeleton" style={{ height: 14, width: '70%', marginBottom: 18 }} aria-hidden="true" />
        <div className="skeleton" style={{ height: 38, width: 180 }} aria-hidden="true" />
        <span className="sr-only">Loading preview…</span>
      </CardFrame>
    );
  }

  // ── error ────────────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <CardFrame colour="var(--crit)" delay={delay}>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--crit)', margin: '0 0 8px' }}>
          {title}
        </p>
        <div role="alert" style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }}>
            <circle cx="12" cy="12" r="9" stroke="var(--crit)" strokeWidth="1.6" />
            <path d="M12 7v6M12 16v.5" stroke="var(--crit)" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: 'var(--text-2)', lineHeight: 1.5, margin: 0 }}>
            {errorMessage}
          </p>
        </div>
      </CardFrame>
    );
  }

  // ── empty ────────────────────────────────────────────────────────────────
  if (state === 'empty') {
    return (
      <CardFrame colour={colour} delay={delay}>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: colour, margin: '0 0 8px' }}>
          {title}
        </p>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', color: 'var(--text-3)', lineHeight: 1.55, margin: 0 }}>
          {emptyMessage}
        </p>
      </CardFrame>
    );
  }

  const disabled = state === 'disabled';

  // ── success / disabled ─────────────────────────────────────────────────────
  return (
    <CardFrame colour={colour} delay={delay}>
      {/* Header: capability + plan badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: colour, margin: 0 }}>
          {title}
        </p>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontFamily: 'JetBrains Mono, monospace', fontSize: '0.64rem', fontWeight: 700,
          letterSpacing: '0.06em', color: disabled ? 'var(--text-4)' : colour,
          background: disabled ? 'var(--bg-badge)' : `color-mix(in srgb, ${colour} 12%, transparent)`,
          border: `1px solid ${disabled ? 'var(--border)' : `color-mix(in srgb, ${colour} 30%, transparent)`}`,
          padding: '2px 8px', borderRadius: 6,
        }}>
          <LockIcon colour={disabled ? 'var(--text-4)' : colour} />
          {badge}
        </span>
      </div>

      {/* Real headline insight — fully visible, this is the hook. */}
      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1rem', fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.4, margin: '0 0 10px', letterSpacing: '-0.01em' }}>
        {headline}
      </p>

      {/* Supporting detail — blurred/masked. Hidden from assistive tech so the
          locked content isn't read aloud, while the headline + CTA are. */}
      <div
        aria-hidden="true"
        style={{
          filter: 'blur(6px)',
          userSelect: 'none',
          pointerEvents: 'none',
          opacity: 0.7,
          marginBottom: 16,
        }}
      >
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', color: 'var(--text-2)', lineHeight: 1.55, margin: 0 }}>
          {detail}
        </p>
      </div>

      {/* Unlock CTA — single, clear, one line. */}
      {disabled ? (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: 600,
          color: 'var(--text-4)', padding: '9px 16px', borderRadius: 10,
          border: '1px solid var(--border)', background: 'var(--bg-badge)',
        }}>
          {ctaLabel}
        </span>
      ) : (
        <Link
          href={ctaHref}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: 600,
            color: '#fff', background: colour, padding: '9px 16px', borderRadius: 10,
            textDecoration: 'none',
          }}
        >
          <LockIcon colour="#fff" />
          {ctaLabel}
        </Link>
      )}
    </CardFrame>
  );
}
