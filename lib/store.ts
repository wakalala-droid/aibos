"use client";
// lib/store.ts — AI-BOS Zustand store
// Field names verified against actual page source at commit c72bfd2.
// monthly[] uses PascalCase keys (Month, Revenue, Costs) — every page reads m.Revenue, m.Costs, m.Month.
// kpi and health are DIRECTLY destructured and accessed (kpi.avgMargin, health.score) with
// no optional chaining in several pages — they must always be real objects, never undefined.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { setCurrencyGlobal } from "./currency";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MonthlyRow {
  Month: string;
  Revenue: number;
  Costs: number;
  [key: string]: unknown;
}

export interface AlertRow {
  id?: string;
  severity: string;
  title: string;
  description: string;
}

export interface RfmRow {
  customer_id: string;
  segment: string;
  recency_days: number;
  frequency: number;
  monetary: number;
  rfm_score: number;
  clv: number;
  churn_risk: number;
}

export interface SegmentRow {
  segment: string;
  count: number;
  avg_spend: number;
  total_revenue: number;
}

export interface ClvTierRow {
  tier: string;
  count: number;
  total_clv: number;
}

export interface ProductRow {
  product: string;
  total_revenue: number;
  bcg_class: string;
  [key: string]: unknown;
}

export interface BasketPairRow {
  product_a: string;
  product_b: string;
  times_together: number;
}

export interface CategoryRow {
  category: string;
  revenue: number;
  units: number;
  pct_of_total: number;
}

export interface TopItemRow {
  sku: string;
  name: string;
  category: string;
  units_sold: number;
  revenue: number;
  velocity_rank: string;
}

export interface BenchmarkRow {
  metric: string;
  label: string;
  actual: number;
  benchmark: number;
  unit: string;
  status: string;
  gap: number;
}

export interface MenuGapRow {
  name: string;
  category: string;
  issue: string;
  opportunity: string;
  sku: string;
}

export interface CrossInsightRow {
  insight: string;
  action: string;
  priority: string;
  source_engines?: string[];
}

export interface KpiShape {
  totalRevenue: number;
  totalCosts: number;
  totalProfit: number;
  avgMargin: number;
}

export interface HealthShape {
  score: number;
  label: string;
  bestMonth: string;
  worstMonth: string;
}

export interface CashflowShape {
  currentCash?: number;
  runway?: number;
  projections?: Array<{
    month_ahead?: number;
    projected_cash?: number;
    inflow?: number;
    outflow?: number;
  }>;
}

export interface BreakevenShape {
  fixedCosts?: number;
  variableCosts?: number;
  contributionMargin?: number;
  breakevenRevenue?: number;
  currentRevenue?: number;
}

export interface RetentionShape {
  total_customers?: number;
  retention_rate?: number;
  returning_customers?: number;
}

export interface AttachRatesShape {
  drink_attach_pct?: number;
  side_attach_pct?: number;
}

export interface PosGrandTotalsShape {
  gross_revenue?: number;
  net_revenue?: number;
  units_sold?: number;
  discount_value?: number;
}

export interface IntelligenceScoresShape {
  overall_score: number;
  overall_label: string;
  e1_score: number;
  e2_score: number;
  e3_score: number;
}

export interface EngineFlagsShape {
  e1?: boolean;
  e2?: boolean;
  e3?: boolean;
}

export interface CabinetEntry {
  id: string;
  name: string;
  fileType: string;
  engine: string;
  sheets: string[];
  activeSheet: string | null;
  uploadedAt: number;
}

// ── Full state shape — matches real page destructuring exactly ────────────────

export interface FinancialState {
  filename: string | null;
  cabinetId: string | null;
  sheets: string[];
  activeSheet: string | null;
  isUploading: boolean;
  uploadError: string | null;
  isSwitchingSheet: boolean;
  cabinet: CabinetEntry[];

  currencySymbol: string;
  hasEngine2Data: boolean;
  hasEngine3Data: boolean;
  posBusinessName: string;
  posPeriod: string;

  monthly: MonthlyRow[];
  alerts: AlertRow[];
  anomalies: unknown[];
  rfm: RfmRow[];
  segments: SegmentRow[];
  clvTiers: ClvTierRow[];
  productsE2: ProductRow[];
  basketPairs: BasketPairRow[];
  categories: CategoryRow[];
  topItems: TopItemRow[];
  benchmarks: BenchmarkRow[];
  menuGaps: MenuGapRow[];
  crossInsights: CrossInsightRow[];

  kpi: KpiShape;
  health: HealthShape;

  cashflow: CashflowShape | null;
  breakeven: BreakevenShape | null;
  retention: RetentionShape | null;
  attachRates: AttachRatesShape | null;
  posGrandTotals: PosGrandTotalsShape | null;
  intelligenceScores: IntelligenceScoresShape | null;
  engineFlags: EngineFlagsShape | null;

  unifiedBrief: string;
  opsIntelBrief: string;
  customerIntelBrief: string;
}

interface FinancialActions {
  setUploadResult: (result: Record<string, unknown>) => void;
  setUploading: (v: boolean) => void;
  setUploadError: (err: string | null) => void;
  setCurrency: (sym: string) => void;
  switchSheet: (sheetName: string) => Promise<void>;
  loadFromCabinet: (id: string) => Promise<void>;
  removeFromCabinet: (id: string) => void;
  reset: () => void;
}

// ── INITIAL state ───────────────────────────────────────────────────────────

const INITIAL_KPI: KpiShape = {
  totalRevenue: 0,
  totalCosts: 0,
  totalProfit: 0,
  avgMargin: 0,
};

const INITIAL_HEALTH: HealthShape = {
  score: 0,
  label: "No Data",
  bestMonth: "—",
  worstMonth: "—",
};

const INITIAL: FinancialState = {
  filename: null,
  cabinetId: null,
  sheets: [],
  activeSheet: null,
  isUploading: false,
  uploadError: null,
  isSwitchingSheet: false,
  cabinet: [],

  currencySymbol: "K",
  hasEngine2Data: false,
  hasEngine3Data: false,
  posBusinessName: "",
  posPeriod: "",

  monthly: [],
  alerts: [],
  anomalies: [],
  rfm: [],
  segments: [],
  clvTiers: [],
  productsE2: [],
  basketPairs: [],
  categories: [],
  topItems: [],
  benchmarks: [],
  menuGaps: [],
  crossInsights: [],

  kpi: { ...INITIAL_KPI },
  health: { ...INITIAL_HEALTH },

  cashflow: null,
  breakeven: null,
  retention: null,
  attachRates: null,
  posGrandTotals: null,
  intelligenceScores: null,
  engineFlags: null,

  unifiedBrief: "",
  opsIntelBrief: "",
  customerIntelBrief: "",
};

// ── Helpers: derive kpi/health from monthly[] when backend doesn't supply them ─

function deriveKpi(monthly: MonthlyRow[], rawKpi?: Record<string, unknown>): KpiShape {
  if (rawKpi && typeof rawKpi.totalRevenue === "number") {
    return {
      totalRevenue: Number(rawKpi.totalRevenue) || 0,
      totalCosts: Number(rawKpi.totalCosts) || 0,
      totalProfit: Number(rawKpi.totalProfit) || 0,
      avgMargin: Number(rawKpi.avgMargin) || 0,
    };
  }
  if (!monthly.length) return { ...INITIAL_KPI };

  const totalRevenue = monthly.reduce((s, m) => s + (Number(m.Revenue) || 0), 0);
  const totalCosts = monthly.reduce((s, m) => s + (Number(m.Costs) || 0), 0);
  const totalProfit = totalRevenue - totalCosts;
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  return { totalRevenue, totalCosts, totalProfit, avgMargin };
}

function deriveHealth(monthly: MonthlyRow[], rawHealth?: Record<string, unknown>): HealthShape {
  if (rawHealth && typeof rawHealth.score === "number") {
    return {
      score: Number(rawHealth.score) || 0,
      label: String(rawHealth.label ?? "—"),
      bestMonth: String(rawHealth.bestMonth ?? "—"),
      worstMonth: String(rawHealth.worstMonth ?? "—"),
    };
  }
  if (!monthly.length) return { ...INITIAL_HEALTH };

  const withProfit = monthly.map((m) => ({
    month: String(m.Month),
    profit: (Number(m.Revenue) || 0) - (Number(m.Costs) || 0),
  }));

  const best = withProfit.reduce((a, b) => (b.profit > a.profit ? b : a), withProfit[0]);
  const worst = withProfit.reduce((a, b) => (b.profit < a.profit ? b : a), withProfit[0]);

  const totalRevenue = monthly.reduce((s, m) => s + (Number(m.Revenue) || 0), 0);
  const totalCosts = monthly.reduce((s, m) => s + (Number(m.Costs) || 0), 0);
  const avgMargin = totalRevenue > 0 ? ((totalRevenue - totalCosts) / totalRevenue) * 100 : 0;

  const score = Math.max(0, Math.min(100, Math.round(avgMargin * 2.5)));
  const label =
    score >= 75 ? "Excellent" : score >= 50 ? "Healthy" : score >= 25 ? "At Risk" : "Critical";

  return {
    score,
    label,
    bestMonth: best.month,
    worstMonth: worst.month,
  };
}

function toMonthlyRows(raw: unknown): MonthlyRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((m) => {
    const row = (m ?? {}) as Record<string, unknown>;
    return {
      Month: String(row.Month ?? row.month ?? "—"),
      Revenue: Number(row.Revenue ?? row.revenue ?? 0) || 0,
      Costs: Number(row.Costs ?? row.costs ?? 0) || 0,
      ...row,
    } as MonthlyRow;
  });
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function asObjOrNull<T>(v: unknown): T | null {
  return v && typeof v === "object" ? (v as T) : null;
}

// ── Store ─────────────────────────────────────────────────────────────────────

const _store = create<FinancialState & FinancialActions>()(
  persist(
    (set, get) => ({
      ...INITIAL,

      setUploadResult: (result) => {
        const monthly = toMonthlyRows(result.monthly);

        const sym =
          typeof result.currencySymbol === "string" && result.currencySymbol
            ? result.currencySymbol
            : typeof result.currency === "string" && result.currency
            ? result.currency
            : "K";
        setCurrencyGlobal(sym);

        const cabId = typeof result.cabinet_id === "string" ? result.cabinet_id : null;
        const fname = typeof result.filename === "string" ? result.filename : null;
        const sheetsArr = asArray<string>(result.sheets);

        if (cabId && fname) {
          const cab = get().cabinet;
          if (!cab.some((e) => e.id === cabId)) {
            const entry: CabinetEntry = {
              id: cabId,
              name: fname,
              fileType: typeof result.file_type === "string" ? result.file_type : "unknown",
              engine: typeof result.engine === "string" ? result.engine : "engine1",
              sheets: sheetsArr,
              activeSheet:
                typeof result.active_sheet === "string" ? result.active_sheet : null,
              uploadedAt: Date.now(),
            };
            set((s) => ({ cabinet: [entry, ...s.cabinet].slice(0, 20) }));
          }
        }

        set({
          filename: fname,
          cabinetId: cabId,
          sheets: sheetsArr,
          activeSheet: typeof result.active_sheet === "string" ? result.active_sheet : null,
          currencySymbol: sym,

          hasEngine2Data: Boolean(result.hasEngine2Data),
          hasEngine3Data: Boolean(result.hasEngine3Data),
          posBusinessName:
            typeof result.posBusinessName === "string" ? result.posBusinessName : "",
          posPeriod: typeof result.posPeriod === "string" ? result.posPeriod : "",

          monthly,
          alerts: asArray<AlertRow>(result.alerts),
          anomalies: asArray<unknown>(result.anomalies),
          rfm: asArray<RfmRow>(result.rfm),
          segments: asArray<SegmentRow>(result.segments),
          clvTiers: asArray<ClvTierRow>(result.clvTiers),
          productsE2: asArray<ProductRow>(result.productsE2),
          basketPairs: asArray<BasketPairRow>(result.basketPairs),
          categories: asArray<CategoryRow>(result.categories),
          topItems: asArray<TopItemRow>(result.topItems),
          benchmarks: asArray<BenchmarkRow>(result.benchmarks),
          menuGaps: asArray<MenuGapRow>(result.menuGaps),
          crossInsights: asArray<CrossInsightRow>(result.crossInsights),

          kpi: deriveKpi(monthly, result.kpi as Record<string, unknown>),
          health: deriveHealth(monthly, result.health as Record<string, unknown>),

          cashflow: asObjOrNull<CashflowShape>(result.cashflow),
          breakeven: asObjOrNull<BreakevenShape>(result.breakeven),
          retention: asObjOrNull<RetentionShape>(result.retention),
          attachRates: asObjOrNull<AttachRatesShape>(result.attachRates),
          posGrandTotals: asObjOrNull<PosGrandTotalsShape>(result.posGrandTotals),
          intelligenceScores: asObjOrNull<IntelligenceScoresShape>(result.intelligenceScores),
          engineFlags: asObjOrNull<EngineFlagsShape>(result.engineFlags),

          unifiedBrief: typeof result.unifiedBrief === "string" ? result.unifiedBrief : "",
          opsIntelBrief: typeof result.opsIntelBrief === "string" ? result.opsIntelBrief : "",
          customerIntelBrief:
            typeof result.customerIntelBrief === "string" ? result.customerIntelBrief : "",

          uploadError: null,
        });
      },

      setUploading: (v) => set({ isUploading: v }),
      setUploadError: (err) => set({ uploadError: err }),

      setCurrency: (sym) => {
        setCurrencyGlobal(sym);
        set({ currencySymbol: sym });
      },

      switchSheet: async (sheetName) => {
        const { cabinetId } = get();
        if (!cabinetId) return;
        set({ isSwitchingSheet: true, uploadError: null });
        try {
          const res = await fetch(
            `/api/proxy/upload/switch-sheet?cabinet_id=${encodeURIComponent(
              cabinetId
            )}&sheet_name=${encodeURIComponent(sheetName)}`,
            { method: "POST" }
          );
          if (!res.ok) {
            const err = (await res.json().catch(() => ({}))) as { detail?: string };
            throw new Error(err.detail ?? "Sheet switch failed");
          }
          const data = (await res.json()) as Record<string, unknown>;
          get().setUploadResult({ ...data, filename: get().filename ?? undefined });
        } catch (e) {
          set({ uploadError: (e as Error).message });
        } finally {
          set({ isSwitchingSheet: false });
        }
      },

      loadFromCabinet: async (id) => {
        set({ isUploading: true, uploadError: null });
        try {
          const res = await fetch(`/api/proxy/cabinet/${id}`);
          if (!res.ok) throw new Error("Could not load from cabinet");
          const data = (await res.json()) as Record<string, unknown>;
          get().setUploadResult({ ...data, cabinet_id: id });
        } catch (e) {
          set({ uploadError: (e as Error).message });
        } finally {
          set({ isUploading: false });
        }
      },

      removeFromCabinet: (id) =>
        set((s) => ({ cabinet: s.cabinet.filter((e) => e.id !== id) })),

      reset: () => set({ ...INITIAL, cabinet: get().cabinet }),
    }),
    {
      name: "aibos-store-v4",
      partialize: (s) => ({
        cabinet: s.cabinet,
        currencySymbol: s.currencySymbol,
      }),
    }
  )
);

// ── Exports ────────────────────────────────────────────────────────────────────

export const useFinancialStore = _store;
export const useStore = _store;
