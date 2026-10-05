'use client';

// FeatureGate — renders children when the current tier unlocks the feature,
// otherwise a LockedPreviewCard (conversion_psychology.md LOCKED-BUT-VISIBLE).
// The headline/detail come from the page's real data so the preview teases a
// true insight, never a fake one.

import Link from 'next/link';
import { useStore } from '@/lib/store';
import { canAccess, requiredTier, tasterLimit, TIERS, type Feature } from '@/lib/tiers';
import { usePlanPricing } from '@/lib/planPrice';
import LockedPreviewCard, { type PreviewState } from './LockedPreviewCard';

interface FeatureGateProps {
  feature: Feature;
  title: string;
  headline: string;
  detail: string;
  colour?: string;
  state?: PreviewState;
  children: React.ReactNode;
}

export default function FeatureGate({
  feature, title, headline, detail, colour, state, children,
}: FeatureGateProps) {
  const tier = useStore((s) => s.tier);
  // In US dollars, or in Kwacha if the owner chose that on the pricing page.
  const { perMonth } = usePlanPricing(undefined, false);

  if (canAccess(tier, feature)) return <>{children}</>;

  const need = requiredTier(feature);
  const meta = TIERS[need];

  // Tasted features are NOT locked for Free (audit #24): the server grants a
  // few uses a day and 402s when they're spent, and the chat's own reply counts
  // them down. Showing a locked card here would hide an allowance the backend
  // already honours — so render the real thing behind an honest note. Let them
  // feel the product work; the upgrade argument makes itself.
  const taster = tasterLimit(feature);
  if (taster) {
    return (
      <>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          padding: '8px 8px 8px 16px', marginBottom: 12, borderRadius: 999,
          border: '1px solid var(--border-md)', background: 'var(--bg-card)',
        }}>
          <span className="bento-tag" style={{ marginLeft: 0 }}>Free</span>
          <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-2)' }}>
            {taster.perDay} {taster.noun}s a day, included.
          </span>
          <Link className="pill pill-quiet" href={`/checkout?plan=${need}`} style={{ marginLeft: 'auto' }}>
            Unlimited with {meta.name}: {perMonth(meta.priceMonthly)}
          </Link>
        </div>
        {children}
      </>
    );
  }

  return (
    <LockedPreviewCard
      title={title}
      headline={headline}
      detail={detail}
      ctaLabel={`Unlock with ${meta.name}: ${perMonth(meta.priceMonthly)}`}
      ctaHref={`/checkout?plan=${need}`}
      colour={colour}
      badge={meta.name}
      state={state}
    />
  );
}
