// lib/tiers.ts — AI-BOS subscription tiers + feature gating.
// Single source of truth for what each plan unlocks and how it is priced.
// Priced and billed in ZMW (Kwacha) — USD is a secondary display only, per
// conversion_psychology.md PRICING DISPLAY RULE.

export type Tier = 'free' | 'pro' | 'proplus' | 'growth';

// Features gated across the app. Free includes Engine 1 P&L + cashflow always
// AND the full recording spine (events, twin, Simple home, local assistant
// answers) — recording is how AIBOS learns a business, so it is never gated.
// Everything below is gated.
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
  | 'schedule'         // recurrence + reminders on the Scheduler (core CRUD is free, like recording)
  // Pro+ — "AIBOS runs your day": the assistant acts, not just answers.
  | 'morning_brief'    // in-app daily digest composed from the twin
  | 'chat_actions'     // record sales/expenses straight from the chat
  | 'deliveries'       // expected-delivery tracking (pending receipts due)
  | 'automation'       // future: auto reorder drafts, churn follow-up lists
  // Growth — every location, one brain.
  | 'cross_engine'
  | 'multi_location'
  | 'api_access';      // future: embed AIBOS intelligence via API

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
      'Schedule — meetings, pick-ups & deadlines',
      'Export your data anytime',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'The everyday CFO for one location',
    priceMonthly: 500,
    priceAnnual: 5000,
    accent: 'var(--cyan)',
    inclusions: [
      'Everything in Free',
      'Full Engine 1 — forecast, anomaly, variance, breakeven',
      'Complete history, no 30-day limit',
      'AI CFO chat — unlimited',
      'Recurring schedule & reminders — NAPSA, ZRA, rent',
      'Daily or weekly AI brief to email',
      'Customer & Operations intelligence (Engines 2 & 3)',
    ],
  },
  proplus: {
    id: 'proplus',
    name: 'Pro+',
    tagline: 'AIBOS runs your day, you run the business',
    priceMonthly: 750,
    priceAnnual: 7500,
    accent: 'var(--e2)',
    inclusions: [
      'Everything in Pro',
      'Morning Brief — your day, ready before you ask',
      'Brief delivered to WhatsApp every morning',
      'Record sales & expenses straight from the chat',
      'Expected deliveries — know what’s arriving and when',
      'One-tap reorder drafts when stock runs low',
      'Low-stock alerts in your brief',
    ],
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    tagline: 'Multiple locations, one command centre',
    priceMonthly: 1499,
    priceAnnual: 14990,
    accent: 'var(--e3)',
    inclusions: [
      'Everything in Pro+',
      'Multiple locations',
      'Cross-engine composite score',
      'Unified executive brief across locations',
      'API access — rolling out',
      'Priority support',
    ],
  },
};

export const TIER_ORDER: Tier[] = ['free', 'pro', 'proplus', 'growth'];

// Each paid tier is a strict superset of the one below — supersets are built
// by spreading so a feature can never accidentally vanish when upgrading.
const PRO: Feature[] = [
  'forecast', 'anomaly', 'variance', 'breakeven',
  'ai_chat', 'scheduled_brief', 'full_history', 'engine2', 'engine3',
  'schedule',
];
const PROPLUS: Feature[] = [
  ...PRO,
  'morning_brief', 'chat_actions', 'deliveries', 'automation',
];
const GROWTH: Feature[] = [
  ...PROPLUS,
  'cross_engine', 'multi_location', 'api_access',
];

const ACCESS: Record<Tier, Feature[]> = {
  free: [],
  pro: PRO,
  proplus: PROPLUS,
  growth: GROWTH,
};

export function canAccess(tier: Tier, feature: Feature): boolean {
  return ACCESS[tier]?.includes(feature) ?? false;
}

/** The lowest paid tier that unlocks a feature — used to label upgrade CTAs. */
export function requiredTier(feature: Feature): Tier {
  for (const t of TIER_ORDER) {
    if (t !== 'free' && canAccess(t, feature)) return t;
  }
  return 'growth';
}
