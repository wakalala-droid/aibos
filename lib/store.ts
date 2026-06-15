"use client";
// lib/store.ts — AI-BOS Zustand store v3
// KEY RULE: every INITIAL sub-object has the full nested shape so pages can
// destructure deeply at SSG time without hitting undefined.property crashes.
// Exports BOTH useStore (old) and useFinancialStore (new).

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { setCurrencyGlobal } from "./currency";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MonthlyRow {
  month: string;
  revenue: number;
  costs: number;
  profit: number;
  margin: number;
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

// ── Safe default shapes ───────────────────────────────────────────────────────
// These match the field names existing pages destructure.
// Provide BOTH camelCase and snake_case so any page convention works.

const SAFE_BRIEF = {
  // camelCase (what pages destructure)
  totalRevenue: 0,
  totalCosts: 0,
  totalProfit: 0,
  avgMargin: 0,
  healthScore: 0,
  periods: 0,
  bestMonth: "—",
  worstMonth: "—",
  // snake_case (what engine returns)
  total_revenue: 0,
  total_costs: 0,
  total_profit: 0,
  avg_margin: 0,
  health_score: 0,
  best_month: "—",
  worst_month: "—",
  forecast: {
    next_revenue: 0,
    next_costs: 0,
    next_profit: 0,
    nextRevenue: 0,
    nextCosts: 0,
    nextProfit: 0,
  },
};

const SAFE_FORECAST = {
  next_revenue: 0,
  next_costs: 0,
  next_profit: 0,
  nextRevenue: 0,
  nextCosts: 0,
  nextProfit: 0,
};

const SAFE_VARIANCE = {
  // The variance page crashes on: variance.monthly_changes.length
  monthly_changes: [] as unknown[],
  monthlyChanges: [] as unknown[],
  avg_mom_growth: 0,
  avgMomGrowth: 0,
};

const SAFE_CASHFLOW = {
  // cash/page crashes on: cashflow.totalCosts
  totalCosts: 0,
  totalRevenue: 0,
  totalProfit: 0,
  endingCash: 0,
  netOperating: 0,
  cashTrend: "positive",
  // snake_case
  total_costs: 0,
  total_revenue: 0,
  total_profit: 0,
  ending_cash: 0,
  net_operating: 0,
  cash_trend: "positive",
  monthly: [] as unknown[],
};

const SAFE_BREAKEVEN = {
  breakevenRevenue: 0,
  fixedCostsEstimate: 0,
  variableCostRatio: 0,
  contributionMarginPct: 0,
  breakeven_revenue: 0,
  fixed_costs_estimate: 0,
  variable_cost_ratio: 0,
  contribution_margin_pct: 0,
};

const SAFE_ANOMALIES: unknown[] = [];

// ── Full state shape ──────────────────────────────────────────────────────────

export interface FinancialState {
  filename: string | null;
  engine: string | null;
  currency: string;
  isUploading: boolean;
  uploadError: string | null;

  cabinetId: string | null;
  sheets: string[];
  activeSheet: string | null;
  columnsDetected: { revenue?: string; cost?: string; month?: string } | null;
  isSwitchingSheet: boolean;

  // Engine 1
  monthly: MonthlyRow[];
  forecast: Record<string, unknown>;
  anomalies: unknown[];
  variance: Record<string, unknown>;
  breakeven: Record<string, unknown>;
  cashflow: Record<string, unknown>;
  brief: Record<string, unknown>;

  // Engine 2
  customers: unknown[];
  rfm: unknown[];
  posCategories: unknown[];
  posItems: unknown[];

  // Cabinet
  cabinet: CabinetEntry[];
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

// ── INITIAL state — every nested object has its full safe shape ───────────────

const INITIAL: FinancialState = {
  filename: null,
  engine: null,
  currency: "K",
  isUploading: false,
  uploadError: null,

  cabinetId: null,
  sheets: [],
  activeSheet: null,
  columnsDetected: null,
  isSwitchingSheet: false,

  monthly: [],
  forecast: { ...SAFE_FORECAST },
  anomalies: [...SAFE_ANOMALIES],
  variance: { ...SAFE_VARIANCE },
  breakeven: { ...SAFE_BREAKEVEN },
  cashflow: { ...SAFE_CASHFLOW },
  brief: { ...SAFE_BRIEF },

  // These MUST be arrays (never undefined) — pages call .map/.filter/.slice on them
  customers: [],
  rfm: [],
  posCategories: [],
  posItems: [],

  cabinet: [],
};

// ── Helper: merge engine result into a safe shape ────────────────────────────
// Ensures that even if the engine omits a field, the safe default fills it.

function mergeBrief(raw: Record<string, unknown>): Record<string, unknown> {
  const r = raw ?? {};
  return {
    ...SAFE_BRIEF,
    ...r,
    // Normalise camelCase from snake_case
    totalRevenue:  r.totalRevenue  ?? r.total_revenue  ?? 0,
    totalCosts:    r.totalCosts    ?? r.total_costs     ?? 0,
    totalProfit:   r.totalProfit   ?? r.total_profit    ?? 0,
    avgMargin:     r.avgMargin     ?? r.avg_margin      ?? 0,
    healthScore:   r.healthScore   ?? r.health_score    ?? 0,
    periods:       r.periods       ?? 0,
    bestMonth:     r.bestMonth     ?? r.best_month      ?? "—",
    worstMonth:    r.worstMonth    ?? r.worst_month     ?? "—",
    // Keep snake_case too
    total_revenue: r.total_revenue ?? r.totalRevenue    ?? 0,
    total_costs:   r.total_costs   ?? r.totalCosts      ?? 0,
    total_profit:  r.total_profit  ?? r.totalProfit     ?? 0,
    avg_margin:    r.avg_margin    ?? r.avgMargin        ?? 0,
    health_score:  r.health_score  ?? r.healthScore      ?? 0,
    best_month:    r.best_month    ?? r.bestMonth        ?? "—",
    worst_month:   r.worst_month   ?? r.worstMonth       ?? "—",
    forecast: mergeForecast((r.forecast as Record<string, unknown>) ?? {}),
  };
}

function mergeForecast(raw: Record<string, unknown>): Record<string, unknown> {
  const r = raw ?? {};
  const nr = Number(r.next_revenue ?? r.nextRevenue ?? 0);
  const nc = Number(r.next_costs   ?? r.nextCosts   ?? 0);
  const np = Number(r.next_profit  ?? r.nextProfit  ?? nr - nc);
  return {
    ...SAFE_FORECAST,
    next_revenue: nr, next_costs: nc, next_profit: np,
    nextRevenue:  nr, nextCosts:  nc, nextProfit:  np,
  };
}

function mergeVariance(raw: Record<string, unknown>): Record<string, unknown> {
  const r = raw ?? {};
  const changes = Array.isArray(r.monthly_changes)
    ? r.monthly_changes
    : Array.isArray(r.monthlyChanges)
    ? r.monthlyChanges
    : [];
  const avg = Number(r.avg_mom_growth ?? r.avgMomGrowth ?? 0);
  return {
    ...SAFE_VARIANCE,
    monthly_changes: changes,
    monthlyChanges:  changes,
    avg_mom_growth:  avg,
    avgMomGrowth:    avg,
  };
}

function mergeCashflow(raw: Record<string, unknown>): Record<string, unknown> {
  const r = raw ?? {};
  const monthly = Array.isArray(r.monthly) ? r.monthly : [];
  const totalRev  = Number(r.total_revenue ?? r.totalRevenue ?? 0);
  const totalCost = Number(r.total_costs   ?? r.totalCosts   ?? 0);
  const totalProf = Number(r.total_profit  ?? r.totalProfit  ?? 0);
  const ending    = Number(r.ending_cash   ?? r.endingCash   ?? 0);
  const netOp     = Number(r.net_operating ?? r.netOperating ?? totalProf);
  const trend     = String(r.cash_trend    ?? r.cashTrend    ?? "positive");
  return {
    ...SAFE_CASHFLOW,
    monthly,
    totalRevenue: totalRev,  total_revenue: totalRev,
    totalCosts:   totalCost, total_costs:   totalCost,
    totalProfit:  totalProf, total_profit:  totalProf,
    endingCash:   ending,    ending_cash:   ending,
    netOperating: netOp,     net_operating: netOp,
    cashTrend:    trend,     cash_trend:    trend,
  };
}

function mergeBreakeven(raw: Record<string, unknown>): Record<string, unknown> {
  const r = raw ?? {};
  const bev = Number(r.breakeven_revenue     ?? r.breakevenRevenue     ?? 0);
  const fce = Number(r.fixed_costs_estimate  ?? r.fixedCostsEstimate   ?? 0);
  const vcr = Number(r.variable_cost_ratio   ?? r.variableCostRatio    ?? 0);
  const cmp = Number(r.contribution_margin_pct ?? r.contributionMarginPct ?? 0);
  return {
    ...SAFE_BREAKEVEN,
    breakevenRevenue:     bev, breakeven_revenue:      bev,
    fixedCostsEstimate:   fce, fixed_costs_estimate:   fce,
    variableCostRatio:    vcr, variable_cost_ratio:    vcr,
    contributionMarginPct:cmp, contribution_margin_pct:cmp,
  };
}

// ── Store ─────────────────────────────────────────────────────────────────────

const _store = create<FinancialState & FinancialActions>()(
  persist(
    (set, get) => ({
      ...INITIAL,

      setUploadResult: (result) => {
        const monthly: MonthlyRow[] = Array.isArray(result.monthly)
          ? (result.monthly as MonthlyRow[])
          : [];

        const sym =
          typeof result.currency === "string" && result.currency
            ? result.currency
            : "K";
        setCurrencyGlobal(sym);

        const cabId =
          typeof result.cabinet_id === "string" ? result.cabinet_id : null;
        const fname =
          typeof result.filename === "string" ? result.filename : null;
        const sheetsArr: string[] = Array.isArray(result.sheets)
          ? (result.sheets as string[])
          : [];

        // Upsert cabinet entry
        if (cabId && fname) {
          const cab = get().cabinet;
          if (!cab.some((e) => e.id === cabId)) {
            const entry: CabinetEntry = {
              id: cabId,
              name: fname,
              fileType:
                typeof result.file_type === "string"
                  ? result.file_type
                  : "unknown",
              engine:
                typeof result.engine === "string" ? result.engine : "engine1",
              sheets: sheetsArr,
              activeSheet:
                typeof result.active_sheet === "string"
                  ? result.active_sheet
                  : null,
              uploadedAt: Date.now(),
            };
            set((s) => ({ cabinet: [entry, ...s.cabinet].slice(0, 20) }));
          }
        }

        const rawBrief    = (result.brief      ?? {}) as Record<string, unknown>;
        const rawForecast = (result.forecast   ?? {}) as Record<string, unknown>;
        const rawVariance = (result.variance   ?? {}) as Record<string, unknown>;
        const rawCashflow = (result.cashflow   ?? {}) as Record<string, unknown>;
        const rawBreakeven= (result.breakeven  ?? {}) as Record<string, unknown>;

        set({
          filename: fname,
          cabinetId: cabId,
          engine: typeof result.engine === "string" ? result.engine : null,
          sheets: sheetsArr,
          activeSheet:
            typeof result.active_sheet === "string" ? result.active_sheet : null,
          columnsDetected:
            result.columns_detected != null
              ? (result.columns_detected as FinancialState["columnsDetected"])
              : null,
          currency: sym,
          monthly,

          // Each sub-object merged through its safe-shape normaliser
          brief:     mergeBrief({ ...rawBrief, ...rawForecast }),
          forecast:  mergeForecast(rawForecast),
          variance:  mergeVariance(rawVariance),
          cashflow:  mergeCashflow(rawCashflow),
          breakeven: mergeBreakeven(rawBreakeven),
          anomalies: Array.isArray(result.anomalies) ? result.anomalies : [],

          // E2 / E3 arrays — always arrays, never undefined
          customers:     Array.isArray(result.customers)     ? result.customers     : [],
          rfm:           Array.isArray(result.rfm)           ? result.rfm           : [],
          posCategories: Array.isArray(result.categories)    ? result.categories    :
                         Array.isArray(result.posCategories) ? result.posCategories : [],
          posItems:      Array.isArray(result.items)         ? result.items         :
                         Array.isArray(result.posItems)      ? result.posItems      : [],

          uploadError: null,
        });
      },

      setUploading: (v) => set({ isUploading: v }),
      setUploadError: (err) => set({ uploadError: err }),

      setCurrency: (sym) => {
        setCurrencyGlobal(sym);
        set({ currency: sym });
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
            const err = (await res.json().catch(() => ({}))) as {
              detail?: string;
            };
            throw new Error(err.detail ?? "Sheet switch failed");
          }
          const data = (await res.json()) as Record<string, unknown>;
          get().setUploadResult({
            ...data,
            filename: get().filename ?? undefined,
          });
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
      name: "aibos-store-v3",
      partialize: (s) => ({
        cabinet: s.cabinet,
        currency: s.currency,
      }),
    }
  )
);

// ── Named exports — both old and new hook names ────────────────────────────────

/** New name — used by files introduced in this session */
export const useFinancialStore = _store;

/** Old name — ALL existing dashboard pages import { useStore } from '@/lib/store' */
export const useStore = _store;
