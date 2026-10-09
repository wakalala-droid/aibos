// lib/tiers.ts — AIBOS subscription tiers + feature gating.
// Single source of truth for what each plan unlocks and how it is priced.
// Priced and billed in US dollars by card, renewing automatically, since
// 25 September 2026 (the owner's decision, replacing the Kwacha-first rule in
// conversion_psychology.md). Kwacha is a guide only: see PRICE_CURRENCY below.

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
  | 'payroll'          // run a pay period: PAYE/NAPSA/net-pay engine + posting Salary events (register is free)
  | 'hospitality'      // PROVISIONAL: short-let PMS vertical (properties/units/bookings). Whole module gated: moves to its own add-on SKU later
  // Pro+ — "AIBOS runs your day": the assistant acts, not just answers.
  | 'morning_brief'    // in-app daily digest composed from the twin
  | 'chat_actions'     // record sales/expenses straight from the chat
  | 'deliveries'       // expected-delivery tracking (pending receipts due)
  | 'automation'       // future: auto reorder drafts, churn follow-up lists
  // Growth — every venture, one brain.
  | 'cross_engine'
  | 'multi_business'   // run several businesses under one login (audit #16)
  | 'multi_location'   // UNBUILT: flag reserved; never list as a live inclusion (audit 2026-07)
  | 'api_access';      // UNBUILT: flag reserved; never list as a live inclusion (audit 2026-07)

export interface TierMeta {
  id: Tier;
  name: string;
  tagline: string;
  /** Monthly price in US dollars (PRICE_CURRENCY). 0 = free. */
  priceMonthly: number;
  /** Annual price in US dollars: billed yearly, two months free (10 × monthly). */
  priceAnnual: number;
  /** Plain-language inclusions, shown verbatim before signup. */
  inclusions: string[];
  accent: string;
}

// Every plan is priced and charged in US dollars, by card through Paddle, and
// renews automatically (owner's decision, 25 September 2026; Paddle cannot
// charge in Kwacha). A Kwacha figure is only ever a conversion shown for
// reference (lib/planPrice.ts), never what is charged. These numbers must match
// aibos-api tier_contract.json and paddle.py CARD_PRICES_USD.
export const PRICE_CURRENCY = 'USD';

export const TIERS: Record<Tier, TierMeta> = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'Prove it on your own numbers',
    priceMonthly: 0,
    priceAnnual: 0,
    accent: 'var(--text-3)',
    // What each plan unlocks today (8 Oct 2026). Every line is live and
    // matches ACCESS below and entitlements.py: recording, uploads and
    // receipts, invoices with payment links, customers, stock, the staff
    // register, the schedule and team invites are never gated. Anything not
    // live yet says so in brackets.
    inclusions: [
      'Record sales and expenses, or upload a spreadsheet or receipt',
      'Profit and cash in full for your last 30 days',
      'Invoices with a mobile money payment link',
      'Customers, stock and a staff register',
      'A schedule for meetings, pick-ups and deadlines',
      'Ask AIBOS: 3 questions a day',
      'A preview of forecasts, warnings and breakeven',
      'Invite your staff and your accountant',
      'Export your data any time',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'The everyday CFO for one business',
    priceMonthly: 25,
    priceAnnual: 250,
    accent: 'var(--cyan)',
    inclusions: [
      'Everything in Free',
      'Your whole history, no 30-day limit',
      'Unlimited Ask AIBOS that remembers the conversation',
      'Forecasts, unusual-spending warnings, breakeven and month by month',
      'Best customers, quiet customers and till sales reports',
      'A morning brief at 06:30 by email and on your phone',
      'Reminders on your phone for NAPSA, ZRA, rent and meetings',
      'Payroll with PAYE, NAPSA, NHIMA and take-home pay worked out',
      'Rooms & Stays: bookings, deposits and guest payment links',
    ],
  },
  proplus: {
    id: 'proplus',
    name: 'Pro+',
    tagline: 'AIBOS runs your day, you run the business',
    priceMonthly: 39,
    priceAnnual: 390,
    accent: 'var(--e2)',
    inclusions: [
      'Everything in Pro',
      'The Morning Brief on Home: your day, ready before you ask',
      'The brief on WhatsApp every morning (rolling out)',
      'Record sales and expenses just by telling AIBOS',
      'Expected deliveries: what is arriving and when',
      'Reorder drafts when stock runs low, approved in one tap',
    ],
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    tagline: 'Every business you run, one command centre',
    priceMonthly: 79,
    priceAnnual: 790,
    accent: 'var(--e3)',
    inclusions: [
      'Everything in Pro+',
      'Run several businesses under one login, each with its own books',
      'One health score across money, customers and operations',
      'Priority support',
      'First in line to connect your other software (in development)',
    ],
  },
};

export const TIER_ORDER: Tier[] = ['free', 'pro', 'proplus', 'growth'];

/**
 * Runtime guard for a value claiming to be a Tier — DERIVED from TIER_ORDER, so
 * adding a tier can never leave a caller behind.
 *
 * Use this instead of spelling the tiers out again. Hand-written tier lists are
 * how Pro+ shipped broken: profile.tsx's normaliseTier() listed 'pro' and
 * 'growth' and fell through to 'free' for anything else, so when Pro+ was added
 * every proplus customer was silently downgraded to Free on page load while the
 * API went on honouring what they'd paid for.
 */
export function isTier(v: unknown): v is Tier {
  return TIER_ORDER.includes(v as Tier);
}

/** The tiers you can actually pay for, in ladder order. */
export type PaidTier = Exclude<Tier, 'free'>;

export const PAID_TIERS: PaidTier[] = TIER_ORDER.filter((t): t is PaidTier => t !== 'free');

export function isPaidTier(v: unknown): v is PaidTier {
  return PAID_TIERS.includes(v as PaidTier);
}

// Each paid tier is a strict superset of the one below — supersets are built
// by spreading so a feature can never accidentally vanish when upgrading.
const PRO: Feature[] = [
  'forecast', 'anomaly', 'variance', 'breakeven',
  'ai_chat', 'scheduled_brief', 'full_history', 'engine2', 'engine3',
  'schedule', 'payroll',
  // PROVISIONAL — parked in Pro so the v1 client can use it; moves to its own
  // add-on SKU later (keep in lock-step with entitlements.py _PRO).
  'hospitality',
];
const PROPLUS: Feature[] = [
  ...PRO,
  'morning_brief', 'chat_actions', 'deliveries', 'automation',
];
const GROWTH: Feature[] = [
  ...PROPLUS,
  // 'multi_business' is the Growth anchor (audit #16) and entitlements.py grants
  // it — omitting it here locked paying Growth owners out of the business
  // switcher the backend would have allowed. Lock-step is the whole point.
  'cross_engine', 'multi_business', 'multi_location', 'api_access',
];

const ACCESS: Record<Tier, Feature[]> = {
  free: [],
  pro: PRO,
  proplus: PROPLUS,
  growth: GROWTH,
};

/**
 * Flags reserved for features that DO NOT EXIST YET. They stay in the ladder
 * above so the plan structure lives in one place, but they grant nothing —
 * canAccess() denies them to every tier, Growth included.
 *
 * Before this, canAccess('growth', 'multi_location') returned true. Nothing
 * consumed it, so nothing was broken; but the first gate wired on one of these
 * would have shown a paying Growth customer a feature with no implementation
 * behind it. Failing closed makes that impossible, and the opposite mistake —
 * building it and forgetting to unlist it — is caught loudly by
 * scripts/check_unbuilt_features.py, which goes red as soon as any UI file
 * mentions a flag still listed here.
 *
 * Keep in lock-step with entitlements.py _UNBUILT and tier_contract.json
 * "unbuilt" (checked by scripts/check_tier_contract.py).
 */
export const UNBUILT: Feature[] = ['multi_location', 'api_access'];

export function canAccess(tier: Tier, feature: Feature): boolean {
  if (UNBUILT.includes(feature)) return false;
  return ACCESS[tier]?.includes(feature) ?? false;
}

/**
 * Free "taste of the flagship" allowances (audit #24): capabilities a Free
 * account may use a few times a day rather than not at all.
 *
 * The SERVER is authoritative — entitlements.py counts each use in usage_events
 * and 402s once they're spent, and its reply says how many are left. This map
 * exists so the UI OFFERS what the backend already grants: without it a tasted
 * feature renders as a locked upsell card and the allowance is unreachable,
 * which is exactly the drift that shipped. Keep the numbers in lock-step with
 * entitlements.py CHAT_TASTER_PER_DAY.
 */
export const FREE_TASTER: Partial<Record<Feature, { perDay: number; noun: string }>> = {
  ai_chat: { perDay: 3, noun: 'question' },
};

/** The Free daily allowance for `feature`, or undefined if it has none. */
export function tasterLimit(feature: Feature): { perDay: number; noun: string } | undefined {
  return FREE_TASTER[feature];
}

/** The lowest paid tier that unlocks a feature — used to label upgrade CTAs. */
export function requiredTier(feature: Feature): Tier {
  for (const t of TIER_ORDER) {
    if (t !== 'free' && canAccess(t, feature)) return t;
  }
  return 'growth';
}
