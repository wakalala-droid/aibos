'use client';

// LockedPreviewCard — content-layer component (component_system.md).
// Conversion pattern from conversion_psychology.md LOCKED-BUT-VISIBLE RULE:
// a real headline insight (clear), supporting detail (blurred/masked), a lock
// icon, and a one-line unlock CTA. Never hides that a feature exists.
//
// Supports all five required states (component_system.md STATE CONSISTENCY):
//   success | loading | error | empty | disabled

import Link from 'next/link';
import { Lock, AlertTriangle, Lightbulb } from 'lucide-react';

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

function LockIcon() {
  return <Lock aria-hidden="true" style={{ width: 18, height: 18 }} />;
}

// The bento surface (5 Oct 2026), monochrome: the plan tag and the round lock
// say it is locked; the colour prop is accepted from older callers.
function CardFrame({ children }: { children: React.ReactNode; colour?: string; delay?: number }) {
  return <article className="bento" style={{ gap: 12 }}>{children}</article>;
}

export default function LockedPreviewCard({
  title,
  headline,
  detail,
  ctaLabel,
  ctaHref = '/pricing',
  badge = 'Pro',
  state = 'success',
  errorMessage = 'Could not load this preview. Try again shortly.',
  emptyMessage = 'Upload more data and this insight will appear here.',
}: LockedPreviewCardProps) {

  if (state === 'loading') {
    return (
      <CardFrame>
        <div className="skeleton" style={{ height: 24, width: '40%' }} aria-hidden="true" />
        <div className="skeleton" style={{ height: 24, width: '85%' }} aria-hidden="true" />
        <div className="skeleton" style={{ height: 44, width: 180, borderRadius: 999 }} aria-hidden="true" />
        <span className="sr-only">Loading preview…</span>
      </CardFrame>
    );
  }

  const head = (icon: React.ReactNode, tag?: React.ReactNode) => (
    <div className="bento-titlerow" style={{ alignItems: 'center' }}>
      <span className="bento-icon" aria-hidden="true">{icon}</span>
      <p className="bento-title" style={{ flex: 1 }}>{title}</p>
      {tag && <span className="bento-tag">{tag}</span>}
    </div>
  );

  if (state === 'error') {
    return (
      <CardFrame>
        {head(<AlertTriangle />)}
        <p role="alert" className="bento-text" style={{ margin: 0 }}>{errorMessage}</p>
      </CardFrame>
    );
  }

  if (state === 'empty') {
    return (
      <CardFrame>
        {head(<Lightbulb />)}
        <p className="bento-text" style={{ margin: 0 }}>{emptyMessage}</p>
      </CardFrame>
    );
  }

  const disabled = state === 'disabled';

  return (
    <CardFrame>
      {head(<LockIcon />, badge)}

      {/* Real headline insight: fully visible, this is the hook. */}
      <p style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-1)', lineHeight: 1.5, margin: 0 }}>
        {headline}
      </p>

      {/* Supporting detail: blurred, and hidden from assistive tech so the
          locked content is not read aloud while the headline and button are. */}
      <div aria-hidden="true" style={{ filter: 'blur(6px)', userSelect: 'none', pointerEvents: 'none', opacity: 0.7 }}>
        <p className="bento-text" style={{ margin: 0 }}>{detail}</p>
      </div>

      <div className="bento-foot">
        {disabled ? (
          <span className="pill pill-quiet" aria-disabled="true" style={{ cursor: 'default', color: 'var(--text-3)' }}>{ctaLabel}</span>
        ) : (
          <Link href={ctaHref} className="pill pill-primary"><LockIcon />{ctaLabel}</Link>
        )}
      </div>
    </CardFrame>
  );
}
