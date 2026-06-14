// lib/store.ts — AI-BOS Zustand store v3
// Adds: cabinet state, sheet switching, rich AI context, currency propagation

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { setCurrencyGlobal } from "./utils";

// ─── Types ────────────────────────────────────────────────────────────────────

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

export interface FinancialState {
  // Upload meta
  filename: string | null;
  cabinetId: string | null;
  engine: string | null;
  sheets: string[];
  activeSheet: string | null;
  columnsDetected: { revenue?: string; cost?: string; month?: string } | null;
  currency: string;

  // Engine 1 data
  monthly: MonthlyRow[];
  forecast: Record<string, unknown>;
  anomalies: unknown[];
  variance: Record<string, unknown>;
  breakeven: Record<string, unknown>;
  cashflow: Record<string, unknown>;
  brief: Record<string, unknown>;

  // Engine 2/3 data
  customers: unknown[];
  rfm: unknown[];
  posCategories: unknown[];
  posItems: unknown[];

  // Cabinet (persisted list)
  cabinet: CabinetEntry[];

  // Status
  isUploading: boolean;
  uploadError: string | null;
  isSwitchingSheet: boolean;
}

interface FinancialActions {
  // Upload
  setUploadResult: (result: Record<string, unknown>) => void;
  setUploading: (v: boolean) => void;
  setUploadError: (err: string | null) => void;

  // Sheet switching
  switchSheet: (sheetName: string) => Promise<void>;

  // Cabinet
  addToCabinet: (entry: CabinetEntry) => void;
  removeFromCabinet: (id: string) => void;
  loadFromCabinet: (id: string) => Promise<void>;

  // Currency
  setCurrency: (sym: string) => void;

  // Reset
  reset: () => void;
}

// ─── Initial state ─────────────────────────────────────────────────────────

const INITIAL: FinancialState = {
  filename: null,
  cabinetId: null,
  engine: null,
  sheets: [],
  activeSheet: null,
  columnsDetected: null,
  currency: "K",

  monthly: [],
  forecast: {},
  anomalies: [],
  variance: {},
  breakeven: {},
  cashflow: {},
  brief: {},

  customers: [],
  rfm: [],
  posCategories: [],
  posItems: [],

  cabinet: [],

  isUploading: false,
  uploadError: null,
  isSwitchingSheet: false,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useFinancialStore = create<FinancialState & FinancialActions>()(
  persist(
    (set, get) => ({
      ...INITIAL,

      // ── Upload result handler ──────────────────────────────────────────────
      setUploadResult: (result) => {
        const monthly = Array.isArray(result.monthly)
          ? (result.monthly as MonthlyRow[])
          : [];

        // Propagate currency
        const sym = (result.currency as string) || "K";
        setCurrencyGlobal(sym);

        // Update cabinet list
        const cabId = result.cabinet_id as string | undefined;
        const filename = result.filename as string | undefined;
        if (cabId && filename) {
          const existing = get().cabinet;
          const alreadyExists = existing.some((e) => e.id === cabId);
          if (!alreadyExists) {
            const entry: CabinetEntry = {
              id: cabId,
              name: filename,
              fileType: (result.file_type as string) || "unknown",
              engine: (result.engine as string) || "engine1",
              sheets: Array.isArray(result.sheets) ? (result.sheets as string[]) : [],
              activeSheet: (result.active_sheet as string) || null,
              uploadedAt: Date.now(),
            };
            set((s) => ({ cabinet: [entry, ...s.cabinet].slice(0, 20) }));
          }
        }

        set({
          filename: filename || null,
          cabinetId: cabId || null,
          engine: (result.engine as string) || null,
          sheets: Array.isArray(result.sheets) ? (result.sheets as string[]) : [],
          activeSheet: (result.active_sheet as string) || null,
          columnsDetected:
            (result.columns_detected as FinancialState["columnsDetected"]) || null,
          currency: sym,
          monthly,
          forecast: (result.forecast as Record<string, unknown>) || {},
          anomalies: Array.isArray(result.anomalies) ? result.anomalies : [],
          variance: (result.variance as Record<string, unknown>) || {},
          breakeven: (result.breakeven as Record<string, unknown>) || {},
          cashflow: (result.cashflow as Record<string, unknown>) || {},
          brief: (result.brief as Record<string, unknown>) || {},
          customers: Array.isArray(result.customers) ? result.customers : [],
          rfm: Array.isArray(result.rfm) ? result.rfm : [],
          posCategories: Array.isArray(result.categories) ? result.categories : [],
          posItems: Array.isArray(result.items) ? result.items : [],
          uploadError: null,
        });
      },

      setUploading: (v) => set({ isUploading: v }),
      setUploadError: (err) => set({ uploadError: err }),

      // ── Sheet switching ───────────────────────────────────────────────────
      switchSheet: async (sheetName) => {
        const { cabinetId } = get();
        if (!cabinetId) return;

        set({ isSwitchingSheet: true });
        try {
          const res = await fetch(
            `/api/proxy/upload/switch-sheet?cabinet_id=${cabinetId}&sheet_name=${encodeURIComponent(sheetName)}`,
            { method: "POST" }
          );
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Sheet switch failed");
          }
          const data = await res.json();
          get().setUploadResult({ ...data, filename: get().filename });
        } catch (e) {
          set({ uploadError: (e as Error).message });
        } finally {
          set({ isSwitchingSheet: false });
        }
      },

      // ── Cabinet ───────────────────────────────────────────────────────────
      addToCabinet: (entry) =>
        set((s) => ({
          cabinet: [entry, ...s.cabinet.filter((e) => e.id !== entry.id)].slice(0, 20),
        })),

      removeFromCabinet: (id) =>
        set((s) => ({ cabinet: s.cabinet.filter((e) => e.id !== id) })),

      loadFromCabinet: async (id) => {
        set({ isUploading: true, uploadError: null });
        try {
          const res = await fetch(`/api/proxy/cabinet/${id}`);
          if (!res.ok) throw new Error("Could not load from cabinet");
          const data = await res.json();
          get().setUploadResult({ ...data, filename: data.filename, cabinet_id: id });
        } catch (e) {
          set({ uploadError: (e as Error).message });
        } finally {
          set({ isUploading: false });
        }
      },

      setCurrency: (sym) => {
        setCurrencyGlobal(sym);
        set({ currency: sym });
      },

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
