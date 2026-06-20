/**
 * Seeded demo business — "Zoe's Kitchen, Lusaka" — shaped to the real store
 * types so the ACTUAL dashboard components (KPICard, RevenueChart,
 * EngineScoreCard, DataManifestCard) can render on the marketing site with
 * believable data and full interactivity. Honest, internally-consistent numbers;
 * no fabricated trends beyond this demo dataset.
 */
import type { MonthlyRow, IntelligenceScoresShape, DataManifest, ItemBreakdownRow } from '@/lib/store';

export const DEMO_BUSINESS = 'Zoe’s Kitchen · Lusaka';

export const DEMO_MONTHLY: MonthlyRow[] = [
  { Month: 'Dec', Revenue: 198000, Costs: 158400 },
  { Month: 'Jan', Revenue: 214500, Costs: 169500 },
  { Month: 'Feb', Revenue: 231000, Costs: 181400 },
  { Month: 'Mar', Revenue: 248000, Costs: 194500 },
  { Month: 'Apr', Revenue: 263000, Costs: 207000 },
  { Month: 'May', Revenue: 284500, Costs: 222700 },
];

// Cumulative cash on hand, month by month (ZMW). Dips in May → an honest
// downward trend the anomaly engine can flag.
export const DEMO_CASH: number[] = [120000, 112000, 118000, 104000, 99000, 96200];

export const DEMO_SCORES: IntelligenceScoresShape = {
  overall_score: 78,
  overall_label: 'Healthy',
  e1_score: 82,
  e2_score: 74,
  e3_score: 68,
};

export const DEMO_MANIFEST: DataManifest = {
  data_shape: 'time_series',
  columns: [
    { name: 'Month',    role: 'period',   confidence: 0.99, reason: 'Recognised month labels', sample: 'May' },
    { name: 'Revenue',  role: 'revenue',  confidence: 0.98, reason: 'Numeric income column',   sample: '284,500' },
    { name: 'Costs',    role: 'cost',     confidence: 0.97, reason: 'Numeric expense column',  sample: '222,700' },
    { name: 'Category', role: 'category', confidence: 0.92, reason: 'Repeated text labels',    sample: 'Mains' },
    { name: 'Notes',    role: 'unknown',  confidence: 1.0,  reason: 'Free text — ignored',     sample: 'staff party' },
  ],
  flags: ['No “units” column found — per-unit economics are turned off rather than guessed.'],
  unknown_columns: ['Notes'],
  grouping_column: null,
};

export const DEMO_BREAKDOWN: ItemBreakdownRow[] = [
  { item: 'Grilled Chicken Platter', revenue: 64200, costs: 41100, profit: 23100, margin: 36.0, rows: 312, units: 1840 },
  { item: 'Nshima & Stew',           revenue: 29800, costs: 16300, profit: 13500, margin: 45.3, rows: 410, units: 2050 },
  { item: 'Beef Burger',             revenue: 38400, costs: 25700, profit: 12700, margin: 33.1, rows: 240, units: 1280 },
  { item: 'Chips',                   revenue: 18600, costs: 9100,  profit: 9500,  margin: 51.1, rows: 520, units: 2600 },
  { item: 'Soft Drinks',             revenue: 14200, costs: 5600,  profit: 8600,  margin: 60.6, rows: 610, units: 3050 },
];
