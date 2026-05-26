/**
 * AI-BOS — Zustand Global Store
 * All financial state, UI state, and mock data lives here.
 * React Query handles server cache; Zustand handles UI + derived state.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MonthlyRecord {
  month: string;
  revenue: number;
  costs: number;
  profit: number;
  margin: number;
}

export interface KPIData {
  totalRevenue: number;
  totalCosts: number;
  netProfit: number;
  avgMargin: number;
  varianceAlerts: number;
  cashRunway: number;
  revenueDelta: number;
  costsDelta: number;
  profitDelta: number;
  marginDelta: number;
}

export interface HealthScore {
  score: number;
  label: 'Excellent' | 'Healthy' | 'At Risk' | 'Critical';
  colour: string;
  bestMonth: string;
  bestValue: number;
  worstMonth: string;
  worstValue: number;
}

export interface Alert {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  month?: string;
  value?: number;
  expected?: number;
}

export interface Anomaly {
  id: string;
  month: string;
  field: string;
  value: number;
  expected: number;
  zScore: number;
  severity: 'critical' | 'high' | 'medium';
}

export interface ForecastMonth {
  month: string;
  historical?: number;
  forecast?: number;
  lower?: number;
  upper?: number;
}

export interface BreakevenData {
  breakevenRevenue: number;
  currentRevenue: number;
  fixedCosts: number;
  variableCosts: number;
  contributionMargin: number;
  status: 'above' | 'below';
  gap: number;
}

export interface CashFlowData {
  runway: number;
  currentCash: number;
  monthlyBurn: number;
  projections: { month: string; cash: number; inflow: number; outflow: number }[];
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_MONTHLY: MonthlyRecord[] = [
  { month: 'Jan', revenue: 142000, costs: 98000,  profit: 44000,  margin: 30.9 },
  { month: 'Feb', revenue: 158000, costs: 104000, profit: 54000,  margin: 34.2 },
  { month: 'Mar', revenue: 171000, costs: 112000, profit: 59000,  margin: 34.5 },
  { month: 'Apr', revenue: 163000, costs: 118000, profit: 45000,  margin: 27.6 },
  { month: 'May', revenue: 189000, costs: 121000, profit: 68000,  margin: 36.0 },
  { month: 'Jun', revenue: 176000, costs: 130000, profit: 46000,  margin: 26.1 },
  { month: 'Jul', revenue: 204000, costs: 138000, profit: 66000,  margin: 32.4 },
  { month: 'Aug', revenue: 218000, costs: 145000, profit: 73000,  margin: 33.5 },
  { month: 'Sep', revenue: 197000, costs: 152000, profit: 45000,  margin: 22.8 },
  { month: 'Oct', revenue: 231000, costs: 148000, profit: 83000,  margin: 35.9 },
  { month: 'Nov', revenue: 245000, costs: 162000, profit: 83000,  margin: 33.9 },
  { month: 'Dec', revenue: 267000, costs: 171000, profit: 96000,  margin: 35.9 },
];

const MOCK_KPI: KPIData = {
  totalRevenue:  2461000,
  totalCosts:    1599000,
  netProfit:      862000,
  avgMargin:       32.4,
  varianceAlerts:     6,
  cashRunway:        14,
  revenueDelta:    18.4,
  costsDelta:      12.1,
  profitDelta:     24.7,
  marginDelta:      2.3,
};

const MOCK_HEALTH: HealthScore = {
  score:      78,
  label:      'Healthy',
  colour:     '#3b82f6',
  bestMonth:  'December',
  bestValue:  96000,
  worstMonth: 'January',
  worstValue: 44000,
};

const MOCK_ALERTS: Alert[] = [
  { id: 'a1', severity: 'critical', title: 'Cost spike detected', description: 'Operating costs exceeded forecast by 34% in September', month: 'Sep', value: 152000, expected: 113000 },
  { id: 'a2', severity: 'high',     title: 'Margin compression', description: 'Q3 avg margin 27.1% vs Q2 32.2% — 5.1pp decline', month: 'Q3' },
  { id: 'a3', severity: 'medium',   title: 'Revenue plateau',    description: 'June revenue declined 7% MoM after 3 months of growth' },
  { id: 'a4', severity: 'medium',   title: 'Cash runway risk',   description: 'At current burn rate, runway is 14 months — below 18mo target' },
  { id: 'a5', severity: 'low',      title: 'Positive trend',     description: 'Q4 revenue tracking +18.4% YoY — strongest quarter yet' },
  { id: 'a6', severity: 'info',     title: 'Forecast updated',   description: 'Revenue forecast revised upward by 12% based on Q4 trajectory' },
];

const MOCK_ANOMALIES: Anomaly[] = [
  { id: 'an1', month: 'Sep', field: 'Operating Costs', value: 152000, expected: 113000, zScore: 3.8, severity: 'critical' },
  { id: 'an2', month: 'Jun', field: 'Revenue',         value: 176000, expected: 205000, zScore: 2.9, severity: 'high' },
  { id: 'an3', month: 'Apr', field: 'Net Margin',      value: 27.6,   expected: 33.5,   zScore: 2.4, severity: 'high' },
  { id: 'an4', month: 'Feb', field: 'Costs',           value: 104000, expected: 88000,  zScore: 2.1, severity: 'medium' },
];

const MOCK_FORECAST: ForecastMonth[] = [
  ...MOCK_MONTHLY.map(m => ({ month: m.month, historical: m.revenue })),
  { month: 'Jan+1', forecast: 281000, lower: 255000, upper: 307000 },
  { month: 'Feb+1', forecast: 296000, lower: 268000, upper: 324000 },
  { month: 'Mar+1', forecast: 314000, lower: 282000, upper: 346000 },
];

const MOCK_BREAKEVEN: BreakevenData = {
  breakevenRevenue:  148000,
  currentRevenue:    267000,
  fixedCosts:         89000,
  variableCosts:      82000,
  contributionMargin: 60.3,
  status:            'above',
  gap:               119000,
};

const MOCK_CASHFLOW: CashFlowData = {
  runway:       14,
  currentCash:  890000,
  monthlyBurn:   63500,
  projections: [
    { month: 'Jan', cash: 890000, inflow: 281000, outflow: 171000 },
    { month: 'Feb', cash: 1000000, inflow: 296000, outflow: 181000 },
    { month: 'Mar', cash: 1115000, inflow: 314000, outflow: 192000 },
    { month: 'Apr', cash: 1237000, inflow: 298000, outflow: 176000 },
    { month: 'May', cash: 1359000, inflow: 311000, outflow: 189000 },
    { month: 'Jun', cash: 1481000, inflow: 325000, outflow: 203000 },
  ],
};

// ─── Store Interface ──────────────────────────────────────────────────────────

interface AppStore {
  // Data
  monthly:    MonthlyRecord[];
  kpi:        KPIData;
  health:     HealthScore;
  alerts:     Alert[];
  anomalies:  Anomaly[];
  forecast:   ForecastMonth[];
  breakeven:  BreakevenData;
  cashflow:   CashFlowData;

  // Currency
  currency: string;
  currencySymbol: string;

  // UI state
  sidebarCollapsed: boolean;
  activeTab:        string;
  uploadedFile:     string | null;
  isLoading:        boolean;

  // Actions
  setSidebarCollapsed: (v: boolean) => void;
  toggleSidebar:       () => void;
  setActiveTab:        (tab: string) => void;
  setUploadedFile:     (name: string | null) => void;
  setLoading:          (v: boolean) => void;
  setCurrency:         (c: string, s: string) => void;
  updateData:          (data: Partial<Pick<AppStore, 'monthly' | 'kpi' | 'health' | 'alerts' | 'anomalies' | 'forecast' | 'breakeven' | 'cashflow'>>) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useStore = create<AppStore>()(
  persist(
    (set) => ({
      // Initial data (mock)
      monthly:   MOCK_MONTHLY,
      kpi:       MOCK_KPI,
      health:    MOCK_HEALTH,
      alerts:    MOCK_ALERTS,
      anomalies: MOCK_ANOMALIES,
      forecast:  MOCK_FORECAST,
      breakeven: MOCK_BREAKEVEN,
      cashflow:  MOCK_CASHFLOW,

      // Currency
      currency:       'USD',
      currencySymbol: '$',

      // UI
      sidebarCollapsed: false,
      activeTab:        'overview',
      uploadedFile:     null,
      isLoading:        false,

      // Actions
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      toggleSidebar:       () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setActiveTab:        (tab) => set({ activeTab: tab }),
      setUploadedFile:     (name) => set({ uploadedFile: name }),
      setLoading:          (v) => set({ isLoading: v }),
      setCurrency:         (c, s) => set({ currency: c, currencySymbol: s }),
      updateData:          (data) => set(data),
    }),
    {
      name: 'aibos-store',
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }),
    }
  )
);

// ─── Selectors ────────────────────────────────────────────────────────────────

export const healthColour = (score: number) => {
  if (score >= 80) return '#10b981'; // green — Excellent
  if (score >= 60) return '#3b82f6'; // blue  — Healthy
  if (score >= 40) return '#f59e0b'; // amber — At Risk
  return '#ef4444';                  // red   — Critical
};

export const healthLabel = (score: number): HealthScore['label'] => {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Healthy';
  if (score >= 40) return 'At Risk';
  return 'Critical';
};

export const severityConfig = {
  critical: { colour: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.35)',   label: 'Critical' },
  high:     { colour: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)',  label: 'High'     },
  medium:   { colour: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.35)',  label: 'Medium'   },
  low:      { colour: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.35)',  label: 'Low'      },
  info:     { colour: '#06b6d4', bg: 'rgba(6,182,212,0.12)',   border: 'rgba(6,182,212,0.35)',   label: 'Info'     },
};
