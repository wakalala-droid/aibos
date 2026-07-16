// The five AIBOS engines, as presented on the marketing surface.
// "Five expert departments reporting to one AI command centre."
// Sprites live in public/marketing/engines/ (placeholder glass cores — the
// owner replaces these with AI-generated WebP/MP4 renders per BRIEF §11b).

export interface MarketingEngine {
  id: 'financial' | 'customer' | 'operations' | 'forecasting' | 'decision';
  name: string;
  role: string;          // department metaphor
  value: string;         // one-line outcome
  accentVar: string;     // CSS var used for the marketing-light frame
  sprite: string;
}

export const ENGINES: MarketingEngine[] = [
  {
    id: 'financial',
    name: 'Financial Intelligence',
    role: 'Your AI CFO',
    value: 'Knows your cash, profit and runway to the day — and tells you before it bites.',
    accentVar: 'var(--e-fin)',
    sprite: '/marketing/engines/engine-financial.svg',
  },
  {
    id: 'customer',
    name: 'Customer Intelligence',
    role: 'Your AI analyst',
    value: 'Sees who really pays you, who is slipping away, and what to do about it.',
    accentVar: 'var(--e-cust)',
    sprite: '/marketing/engines/engine-customer.svg',
  },
  {
    id: 'operations',
    name: 'Operations Intelligence',
    role: 'Your AI floor manager',
    value: 'Watches stock, sales and throughput so nothing quietly leaks margin.',
    accentVar: 'var(--e-ops)',
    sprite: '/marketing/engines/engine-operations.svg',
  },
  {
    id: 'forecasting',
    name: 'Forecasting',
    role: 'Your AI planner',
    value: 'Projects the months ahead from your own numbers — never invented trends.',
    accentVar: 'var(--e-fore)',
    sprite: '/marketing/engines/engine-forecasting.svg',
  },
  {
    id: 'decision',
    name: 'Decision Intelligence',
    role: 'Your AI consultant',
    value: 'Turns every signal into one clear, ranked next move you can act on today.',
    accentVar: 'var(--e-dec)',
    sprite: '/marketing/engines/engine-decision.svg',
  },
];
