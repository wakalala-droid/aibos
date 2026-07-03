"use client";
// lib/store.ts — AI-BOS Zustand store
// Field names verified against actual page source at commit c72bfd2.
// monthly[] uses PascalCase keys (Month, Revenue, Costs) — every page reads m.Revenue, m.Costs, m.Month.
// kpi and health are DIRECTLY destructured and accessed (kpi.avgMargin, health.score) with
// no optional chaining in several pages — they must always be real objects, never undefined.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { setCurrencyGlobal } from "./currency";
import type { Tier } from "./tiers";
import { getTwin, getTwinFinancials, authHeaders, type Twin, type BusinessEvent } from "./api";

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
  intervention?: string;
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
  // Engine 1 actually returns these (cumulative operating cash):
  ending_cash?: number;
  net_operating?: number;
  cash_trend?: string;
  monthly?: Array<{ month?: string; net_cash?: number; cumulative_cash?: number }>;
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

// Read-fidelity manifest (SAFEGUARD.md Layer 1) — how AI-BOS read the file.
export interface ManifestColumn {
  name: string;
  role: string;
  confidence: number;
  reason: string;
  sample: string;
}
export interface DataManifest {
  data_shape: string;            // 'time_series' | 'cross_sectional'
  columns: ManifestColumn[];
  flags: string[];
  unknown_columns: string[];
  grouping_column: string | null;
}
export interface ItemBreakdownRow {
  item: string;
  revenue: number;
  costs: number;
  profit: number;
  margin: number;
  rows: number;
  units?: number;
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
  uploadedFile: string | null;
  cabinetId: string | null;
  sheets: string[];
  activeSheet: string | null;
  isUploading: boolean;
  uploadError: string | null;
  isSwitchingSheet: boolean;
  cabinet: CabinetEntry[];
  // Persisted analysis payload per cabinet id, so files reload after a page
  // refresh even when the backend's in-memory store has been wiped by a restart.
  cabinetData: Record<string, Record<string, unknown>>;

  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  // Simple mode shows the owner-language surface (Home, Record, Stock, Money);
  // technical mode shows every engine tab. Persisted — it's a standing choice.
  uiMode: 'simple' | 'technical';

  // Billing / subscription
  tier: Tier;
  locations: string[];

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

  manifest: DataManifest | null;
  breakdown: ItemBreakdownRow[];
  dataShape: string | null;

  unifiedBrief: string;
  opsIntelBrief: string;
  customerIntelBrief: string;

  // ── Evolution spine — Digital Twin (derived from Business Events) ────────────
  twin: Twin | null;
  recentEvents: BusinessEvent[];
  twinLoading: boolean;
}

interface FinancialActions {
  setUploadResult: (result: Record<string, unknown>) => void;
  setUploading: (v: boolean) => void;
  setUploadError: (err: string | null) => void;
  setCurrency: (sym: string) => void;
  toggleSidebar: () => void;
  setMobileNav: (v: boolean) => void;
  toggleMobileNav: () => void;
  setUiMode: (m: 'simple' | 'technical') => void;
  setTier: (t: Tier) => void;
  addLocation: (name: string) => void;
  switchSheet: (sheetName: string) => Promise<void>;
  loadFromCabinet: (id: string) => Promise<void>;
  removeFromCabinet: (id: string) => void;
  refreshTwin: () => Promise<void>;
  setRecentEvents: (events: BusinessEvent[]) => void;
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
  uploadedFile: null,
  cabinetId: null,
  sheets: [],
  activeSheet: null,
  isUploading: false,
  uploadError: null,
  isSwitchingSheet: false,
  cabinet: [],
  cabinetData: {},

  sidebarCollapsed: false,
  mobileNavOpen: false,
  uiMode: 'simple' as const,

  tier: "free",
  locations: [],

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

  manifest: null,
  breakdown: [],
  dataShape: null,

  unifiedBrief: "",
  opsIntelBrief: "",
  customerIntelBrief: "",

  twin: null,
  recentEvents: [],
  twinLoading: false,
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

const _clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

// Heuristic per-engine + overall health scores, derived from whatever engines
// are currently loaded. Lets the Overview hero reflect a true multi-engine
// state instead of staying blank when E2/E3 data is merged in.
function deriveIntelligence(s: FinancialState): IntelligenceScoresShape | null {
  const present: number[] = [];
  let e1 = 0, e2 = 0, e3 = 0;

  const hasE1 = s.monthly.length > 0;
  const hasE2 = s.hasEngine2Data || s.rfm.length > 0;
  const hasE3 = s.hasEngine3Data || !!s.posGrandTotals;

  if (hasE1) {
    e1 = _clamp(Math.round((s.kpi?.avgMargin ?? 0) * 2.5), 0, 100);
    present.push(e1);
  }
  if (hasE2) {
    const ret = s.retention?.retention_rate ?? 0;
    const champions = s.rfm.filter((r) => r.segment === "Champion").length;
    const champPct = s.rfm.length ? (champions / s.rfm.length) * 100 : 0;
    e2 = _clamp(Math.round((ret + champPct) / 2), 0, 100);
    present.push(e2);
  }
  if (hasE3) {
    const bench = Array.isArray(s.benchmarks) ? s.benchmarks : [];
    const good = bench.filter((b) => b.status === "good").length;
    const benchScore = bench.length ? (good / bench.length) * 100 : 0;
    const drink = Math.min(s.attachRates?.drink_attach_pct ?? 0, 100);
    e3 = bench.length
      ? _clamp(Math.round((benchScore + drink) / 2), 0, 100)
      : _clamp(Math.round(drink), 0, 100);
    present.push(e3);
  }

  if (!present.length) return null;
  const overall = Math.round(present.reduce((a, b) => a + b, 0) / present.length);
  const label =
    overall >= 75 ? "Excellent" : overall >= 50 ? "Healthy" : overall >= 25 ? "At Risk" : "Critical";
  return {
    overall_score: overall,
    overall_label: label,
    e1_score: e1,
    e2_score: e2,
    e3_score: e3,
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
        const prev = get();

        const sym =
          typeof result.currencySymbol === "string" && result.currencySymbol
            ? result.currencySymbol
            : typeof result.currency === "string" && result.currency
            ? result.currency
            : prev.currencySymbol || "K";
        setCurrencyGlobal(sym);

        const cabId = typeof result.cabinet_id === "string" ? result.cabinet_id : null;
        const fname = typeof result.filename === "string" ? result.filename : null;
        const sheetsArr = asArray<string>(result.sheets);
        const engine = typeof result.engine === "string" ? result.engine : "";

        // Add to cabinet (unchanged behaviour)
        if (cabId && fname && !prev.cabinet.some((e) => e.id === cabId)) {
          const entry: CabinetEntry = {
            id: cabId,
            name: fname,
            fileType: typeof result.file_type === "string" ? result.file_type : "unknown",
            engine: engine || "engine1",
            sheets: sheetsArr,
            activeSheet:
              typeof result.active_sheet === "string" ? result.active_sheet : null,
            uploadedAt: Date.now(),
          };
          set((s) => ({ cabinet: [entry, ...s.cabinet].slice(0, 20) }));
        }

        // Cache the full analysis payload so this file can be reloaded after a
        // page refresh without the backend (whose store is in-memory and wiped
        // on restart). Bounded to the most recent 10 cabinet ids to cap size.
        if (cabId) {
          set((s) => {
            const merged = { ...s.cabinetData, [cabId]: result };
            const keep = new Set([cabId, ...s.cabinet.map((e) => e.id)].slice(0, 10));
            const pruned: Record<string, Record<string, unknown>> = {};
            for (const k of Object.keys(merged)) if (keep.has(k)) pruned[k] = merged[k];
            return { cabinetData: pruned };
          });
        }

        // ── Which engine(s) does THIS upload carry? ──────────────────────────
        // Detect by the declared engine and by the data slices present, so each
        // upload updates only its own engine — other engines already in the
        // store are preserved (set() shallow-merges), giving true multi-engine
        // sessions instead of each file wiping the others.
        const hasMonthly = Array.isArray(result.monthly) && (result.monthly as unknown[]).length > 0;
        const hasRfm = Array.isArray(result.rfm) && (result.rfm as unknown[]).length > 0;
        const hasPos = !!result.posGrandTotals || !!(result as { grand_totals?: unknown }).grand_totals;
        const isE1 = engine === "engine1" || hasMonthly;
        const isE2 = engine === "engine2" || hasRfm || Boolean(result.hasEngine2Data);
        const isE3 = engine === "engine3" || hasPos || Boolean(result.hasEngine3Data);

        const patch: Partial<FinancialState> = {
          filename: fname,
          uploadedFile: fname,
          cabinetId: cabId,
          sheets: sheetsArr,
          activeSheet: typeof result.active_sheet === "string" ? result.active_sheet : null,
          currencySymbol: sym,
          uploadError: null,
        };

        // ── Engine 1 · Financial ─────────────────────────────────────────────
        if (isE1) {
          const monthly = toMonthlyRows(result.monthly);
          patch.monthly = monthly;
          patch.kpi = deriveKpi(monthly, result.kpi as Record<string, unknown>);
          patch.health = deriveHealth(monthly, result.health as Record<string, unknown>);
          patch.alerts = asArray<AlertRow>(result.alerts);
          patch.anomalies = asArray<unknown>(result.anomalies);
          patch.cashflow = asObjOrNull<CashflowShape>(result.cashflow);
          patch.breakeven = asObjOrNull<BreakevenShape>(result.breakeven);
        }

        // ── Engine 2 · Customer Intelligence ─────────────────────────────────
        if (isE2) {
          patch.rfm = asArray<RfmRow>(result.rfm);
          patch.segments = asArray<SegmentRow>(result.segments);
          patch.clvTiers = asArray<ClvTierRow>(result.clvTiers);
          patch.productsE2 = asArray<ProductRow>(result.productsE2);
          patch.basketPairs = asArray<BasketPairRow>(result.basketPairs);
          patch.retention = asObjOrNull<RetentionShape>(result.retention);
          patch.customerIntelBrief =
            typeof result.customerIntelBrief === "string"
              ? result.customerIntelBrief
              : prev.customerIntelBrief;
        }

        // ── Engine 3 · Operations / POS ──────────────────────────────────────
        if (isE3) {
          patch.posGrandTotals = asObjOrNull<PosGrandTotalsShape>(result.posGrandTotals);
          patch.categories = asArray<CategoryRow>(result.categories);
          patch.topItems = asArray<TopItemRow>(result.topItems);
          patch.benchmarks = asArray<BenchmarkRow>(result.benchmarks);
          patch.menuGaps = asArray<MenuGapRow>(result.menuGaps);
          patch.attachRates = asObjOrNull<AttachRatesShape>(result.attachRates);
          patch.posBusinessName =
            typeof result.posBusinessName === "string" ? result.posBusinessName : "";
          patch.posPeriod = typeof result.posPeriod === "string" ? result.posPeriod : "";
          patch.opsIntelBrief =
            typeof result.opsIntelBrief === "string" ? result.opsIntelBrief : prev.opsIntelBrief;
        }

        // ── Accumulate engine flags across uploads ───────────────────────────
        const pf = prev.engineFlags ?? {};
        const flags: EngineFlagsShape = {
          e1: Boolean(pf.e1) || isE1,
          e2: Boolean(pf.e2) || isE2,
          e3: Boolean(pf.e3) || isE3,
        };
        patch.engineFlags = flags;
        patch.hasEngine2Data = flags.e2;
        patch.hasEngine3Data = flags.e3;

        // Read-fidelity manifest + per-item breakdown (SAFEGUARD.md Layer 1).
        if (result.manifest && typeof result.manifest === "object") {
          patch.manifest = result.manifest as DataManifest;
        }
        if (Array.isArray(result.breakdown)) {
          patch.breakdown = asArray<ItemBreakdownRow>(result.breakdown);
        }
        if (typeof result.dataShape === "string") {
          patch.dataShape = result.dataShape;
        }

        // Cross-engine: keep backend-provided values when present, else preserve.
        if (Array.isArray(result.crossInsights)) {
          patch.crossInsights = asArray<CrossInsightRow>(result.crossInsights);
        }
        if (typeof result.unifiedBrief === "string" && result.unifiedBrief) {
          patch.unifiedBrief = result.unifiedBrief;
        }

        // Recompute health scores over the MERGED multi-engine state.
        patch.intelligenceScores = deriveIntelligence({ ...prev, ...patch } as FinancialState);

        set(patch);
      },

      setUploading: (v) => set({ isUploading: v }),
      setUploadError: (err) => set({ uploadError: err }),

      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      setMobileNav: (v) => set({ mobileNavOpen: v }),
      toggleMobileNav: () => set((s) => ({ mobileNavOpen: !s.mobileNavOpen })),

      setUiMode: (m) => set({ uiMode: m }),

      setTier: (t) => set({ tier: t }),
      addLocation: (name) =>
        set((s) => (s.locations.includes(name) ? {} : { locations: [...s.locations, name] })),

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
            { method: "POST", headers: await authHeaders() }
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
        // Prefer the locally-cached payload so reloads work instantly and even
        // when the backend has forgotten this file. Then refresh in the
        // background if the server still has it.
        const cached = get().cabinetData[id];
        if (cached) {
          get().setUploadResult({ ...cached, cabinet_id: id });
          authHeaders()
            .then((h) => fetch(`/api/proxy/cabinet/${id}`, { headers: h }))
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
              if (d) get().setUploadResult({ ...(d as Record<string, unknown>), cabinet_id: id });
            })
            .catch(() => {});
          return;
        }

        set({ isUploading: true, uploadError: null });
        try {
          const res = await fetch(`/api/proxy/cabinet/${id}`, { headers: await authHeaders() });
          if (!res.ok) {
            throw new Error(
              "This file isn't on the server anymore (the analysis service restarted). Re-upload it to refresh the cabinet."
            );
          }
          const data = (await res.json()) as Record<string, unknown>;
          get().setUploadResult({ ...data, cabinet_id: id });
        } catch (e) {
          set({ uploadError: (e as Error).message });
        } finally {
          set({ isUploading: false });
        }
      },

      removeFromCabinet: (id) =>
        set((s) => {
          const rest = { ...s.cabinetData };
          delete rest[id];
          return { cabinet: s.cabinet.filter((e) => e.id !== id), cabinetData: rest };
        }),

      // ── Evolution spine ──────────────────────────────────────────────────────
      // Pull the Digital Twin and, when the user has recorded activity but has NOT
      // loaded an uploaded file this session, light up the EXISTING dashboards from
      // the twin via setUploadResult (Initiative 9 — feed richer data, no redesign).
      // Guarded by `uploadedFile` so a real upload is never clobbered.
      refreshTwin: async () => {
        set({ twinLoading: true });
        try {
          const [twin, fin] = await Promise.all([
            getTwin().catch(() => null),
            getTwinFinancials().catch(() => null),
          ]);
          if (twin) set({ twin });
          const hasEvents = !!twin && Number(twin.event_count) > 0;
          const monthly = fin && Array.isArray(fin.monthly) ? (fin.monthly as unknown[]) : [];
          if (hasEvents && monthly.length && !get().uploadedFile) {
            get().setUploadResult({ ...(fin as Record<string, unknown>), engine: "engine1" });
          }
        } catch {
          // Spine may be unconfigured (503) or the user signed out — stay silent.
        } finally {
          set({ twinLoading: false });
        }
      },

      setRecentEvents: (events) => set({ recentEvents: events }),

      reset: () => set({ ...INITIAL, cabinet: get().cabinet, cabinetData: get().cabinetData }),
    }),
    {
      name: "aibos-store-v4",
      partialize: (s) => ({
        cabinet: s.cabinet,
        cabinetData: s.cabinetData,
        currencySymbol: s.currencySymbol,
        sidebarCollapsed: s.sidebarCollapsed,
        uiMode: s.uiMode,
        tier: s.tier,
        locations: s.locations,
      }),
    }
  )
);

// ── Exports ────────────────────────────────────────────────────────────────────

export const useFinancialStore = _store;
export const useStore = _store;
