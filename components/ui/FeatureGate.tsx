'use client';

// FeatureGate — renders children when the current tier unlocks the feature,
// otherwise a LockedPreviewCard (conversion_psychology.md LOCKED-BUT-VISIBLE).
// The headline/detail come from the page's real data so the preview teases a
// true insight, never a fake one.

import { useStore } from '@/lib/store';
import { canAccess, requiredTier, TIERS, type Feature } from '@/lib/tiers';
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

  if (canAccess(tier, feature)) return <>{children}</>;

  const need = requiredTier(feature);
  const meta = TIERS[need];

  return (
    <LockedPreviewCard
      title={title}
      headline={headline}
      detail={detail}
      ctaLabel={`Unlock with ${meta.name} — K${meta.priceMonthly.toLocaleString()}/mo`}
      ctaHref={`/checkout?plan=${need}`}
      colour={colour}
      badge={meta.name.toUpperCase()}
      state={state}
    />
  );
}
