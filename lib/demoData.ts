/**
 * Seeded demo business — "Zoe's Kitchen, Lusaka" — shaped to the real store
 * types so the ACTUAL dashboard components (KPICard, RevenueChart,
 * EngineScoreCard, DataManifestCard) can render on the marketing site with
 * believable data and full interactivity. Honest, internally-consistent numbers;
 * no fabricated trends beyond this demo dataset.
 */
import type { MonthlyRow, IntelligenceScoresShape, DataManifest, ItemBreakdownRow, KpiShape, HealthShape, AlertRow } from '@/lib/store';

// ── Full Strategic Brief dataset (12 months, internally consistent) ──────────
// Sums exactly: revenue K3.71M, costs K2.59M, profit K1.12M, 30.2% margin.
// Best month Dec (K154k profit), worst Sep (K13k). Fed to the genuine
// StrategicBriefView so the brief derives its own recommendations — no fabrication.
const BRIEF_MONTHLY: MonthlyRow[] = [
  { Month: 'Jan', Revenue: 295000, Costs: 207000 },
  { Month: 'Feb', Revenue: 300000, Costs: 205000 },
  { Month: 'Mar', Revenue: 308000, Costs: 209000 },
  { Month: 'Apr', Revenue: 312000, Costs: 210000 },
  { Month: 'May', Revenue: 298000, Costs: 214000 },
  { Month: 'Jun', Revenue: 310000, Costs: 214000 },
  { Month: 'Jul', Revenue: 318000, Costs: 217000 },
  { Month: 'Aug', Revenue: 300000, Costs: 210000 },
  { Month: 'Sep', Revenue: 270000, Costs: 257000 },
  { Month: 'Oct', Revenue: 325000, Costs: 221000 },
  { Month: 'Nov', Revenue: 305000, Costs: 211000 },
  { Month: 'Dec', Revenue: 369000, Costs: 215000 },
];

export const DEMO_BRIEF: {
  kpi: KpiShape; health: HealthShape; monthly: MonthlyRow[]; alerts: AlertRow[];
  scores: IntelligenceScoresShape; unifiedBrief: string;
} = {
  kpi: { totalRevenue: 3710000, totalCosts: 2590000, totalProfit: 1120000, avgMargin: 30.2 },
  health: { score: 75, label: 'Excellent', bestMonth: 'December', worstMonth: 'September' },
  monthly: BRIEF_MONTHLY,
  alerts: [],
  scores: { overall_score: 75, overall_label: 'Excellent', e1_score: 75, e2_score: 0, e3_score: 60 },
  unifiedBrief: '',
};

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

// Forecast: historical (hist) + 3-month projection (fcast) with 95% band.
// The May row carries fcast too, so the dashed forecast line connects to history.
export const DEMO_FORECAST = [
  { month: 'Dec', hist: 198000 },
  { month: 'Jan', hist: 214500 },
  { month: 'Feb', hist: 231000 },
  { month: 'Mar', hist: 248000 },
  { month: 'Apr', hist: 263000 },
  { month: 'May', hist: 284500, fcast: 284500 },
  { month: 'Jun', fcast: 299500, lower: 275540, upper: 323460 },
  { month: 'Jul', fcast: 314500, lower: 289340, upper: 339660 },
  { month: 'Aug', fcast: 329500, lower: 303140, upper: 355860 },
];

// Cash position: the May dip (anomaly) then a projected recovery after action.
export const DEMO_CASH_PROJECTION = [
  { label: 'Dec', cash: 120000 },
  { label: 'Jan', cash: 112000 },
  { label: 'Feb', cash: 118000 },
  { label: 'Mar', cash: 104000 },
  { label: 'Apr', cash: 99000 },
  { label: 'May', cash: 96200 },
  { label: 'Jun', cash: 108000 },
  { label: 'Jul', cash: 121000 },
  { label: 'Aug', cash: 134000 },
];
export const DEMO_RUNWAY = 11;

// Anomaly Z-scores: a cost spike in May crosses the critical threshold.
export const DEMO_ANOMALY_Z = [
  { month: 'Dec', revZ: 0.4, costZ: 0.5 },
  { month: 'Jan', revZ: 0.6, costZ: 0.7 },
  { month: 'Feb', revZ: 0.5, costZ: 0.6 },
  { month: 'Mar', revZ: 0.8, costZ: 1.1 },
  { month: 'Apr', revZ: 0.7, costZ: 1.6 },
  { month: 'May', revZ: 0.9, costZ: 2.3 },
];

// Customer RFM segments.
export const DEMO_SEGMENTS = [
  { name: 'Champions', value: 42, colour: '#34d399' },
  { name: 'Loyal',     value: 88, colour: '#60a5fa' },
  { name: 'At Risk',   value: 31, colour: '#fbbf24' },
  { name: 'Lost',      value: 19, colour: '#f87171' },
];
export const DEMO_RETENTION = { rate: 63.4, returning: 114, firstTime: 66 };

export const DEMO_BREAKDOWN: ItemBreakdownRow[] = [
  { item: 'Grilled Chicken Platter', revenue: 64200, costs: 41100, profit: 23100, margin: 36.0, rows: 312, units: 1840 },
  { item: 'Nshima & Stew',           revenue: 29800, costs: 16300, profit: 13500, margin: 45.3, rows: 410, units: 2050 },
  { item: 'Beef Burger',             revenue: 38400, costs: 25700, profit: 12700, margin: 33.1, rows: 240, units: 1280 },
  { item: 'Chips',                   revenue: 18600, costs: 9100,  profit: 9500,  margin: 51.1, rows: 520, units: 2600 },
  { item: 'Soft Drinks',             revenue: 14200, costs: 5600,  profit: 8600,  margin: 60.6, rows: 610, units: 3050 },
];
