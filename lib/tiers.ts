// lib/tiers.ts — AI-BOS subscription tiers + feature gating.
// Single source of truth for what each plan unlocks and how it is priced.
// Priced and billed in ZMW (Kwacha) — USD is a secondary display only, per
// conversion_psychology.md PRICING DISPLAY RULE.

export type Tier = 'free' | 'pro' | 'growth';

// Features gated across the app. Free includes Engine 1 P&L + cashflow always;
// everything below is gated.
export type Feature =
  | 'forecast'
  | 'anomaly'
  | 'variance'
  | 'breakeven'
  | 'ai_chat'
  | 'scheduled_brief'
  | 'full_history'
  | 'engine2'
  | 'engine3'
  | 'cross_engine'
  | 'multi_location';

export interface TierMeta {
  id: Tier;
  name: string;
  tagline: string;
  /** Monthly price in ZMW. 0 = free. */
  priceMonthly: number;
  /** Annual price in ZMW — billed yearly, two months free (10 × monthly). */
  priceAnnual: number;
  /** Plain-language inclusions, shown verbatim before signup. */
  inclusions: string[];
  accent: string;
}

// Rough display-only rate for the secondary USD figure. ZMW is always primary;
// this is a label, never the billed amount.
export const ZMW_PER_USD = 26;

export function usdApprox(zmw: number): number {
  return Math.round(zmw / ZMW_PER_USD);
}

export const TIERS: Record<Tier, TierMeta> = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'Prove it on your own numbers',
    priceMonthly: 0,
    priceAnnual: 0,
    accent: 'var(--text-3)',
    inclusions: [
      'Financial engine (Engine 1)',
      'Last 30 days of data',
      'Full P&L and cashflow',
      'Forecast, anomaly, variance & breakeven — preview',
      'Export your data anytime',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'The everyday CFO for one location',
    priceMonthly: 450,
    priceAnnual: 4500,
    accent: 'var(--cyan)',
    inclusions: [
      'Everything in Free',
      'Full Engine 1 — forecast, anomaly, variance, breakeven',
      'Complete history, no 30-day limit',
      'AI CFO chat — unlimited',
      'Daily or weekly AI brief to email',
      'Customer & Operations intelligence (Engines 2 & 3)',
    ],
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    tagline: 'Multiple locations, one command centre',
    priceMonthly: 1200,
    priceAnnual: 12000,
    accent: 'var(--e3)',
    inclusions: [
      'Everything in Pro',
      'Multiple locations',
      'Cross-engine composite score',
      'Unified executive brief across locations',
      'Priority support',
    ],
  },
};

export const TIER_ORDER: Tier[] = ['free', 'pro', 'growth'];

const ACCESS: Record<Tier, Feature[]> = {
  free: [],
  pro: [
    'forecast', 'anomaly', 'variance', 'breakeven',
    'ai_chat', 'scheduled_brief', 'full_history', 'engine2', 'engine3',
  ],
  growth: [
    'forecast', 'anomaly', 'variance', 'breakeven',
    'ai_chat', 'scheduled_brief', 'full_history', 'engine2', 'engine3',
    'cross_engine', 'multi_location',
  ],
};

export function canAccess(tier: Tier, feature: Feature): boolean {
  return ACCESS[tier]?.includes(feature) ?? false;
}

/** The lowest paid tier that unlocks a feature — used to label upgrade CTAs. */
export function requiredTier(feature: Feature): Tier {
  if (canAccess('pro', feature)) return 'pro';
  return 'growth';
}
