"use client";
// lib/store.ts — AI-BOS Zustand store v3
// Exports BOTH the new name (useFinancialStore) AND the old name (useStore)
// so every existing page continues to work without modification.

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

export interface FinancialState {
  // Core — existed in all prior versions
  filename: string | null;
  engine: string | null;
  currency: string;
  isUploading: boolean;
  uploadError: string | null;

  // New cabinet / sheet fields
  cabinetId: string | null;
  sheets: string[];
  activeSheet: string | null;
  columnsDetected: { revenue?: string; cost?: string; month?: string } | null;
  isSwitchingSheet: boolean;

  // Engine 1 financial data
  monthly: MonthlyRow[];
  forecast: Record<string, unknown>;
  anomalies: unknown[];
  variance: Record<string, unknown>;
  breakeven: Record<string, unknown>;
  cashflow: Record<string, unknown>;
  brief: Record<string, unknown>;

  // Engine 2 / 3
  customers: unknown[];
  rfm: unknown[];
  posCategories: unknown[];
  posItems: unknown[];

  // Cabinet list (persisted across sessions)
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

// ── Initial state ──────────────────────────────────────────────────────────────

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
};

// ── Store factory ──────────────────────────────────────────────────────────────

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

        set({
          filename: fname,
          cabinetId: cabId,
          engine:
            typeof result.engine === "string" ? result.engine : null,
          sheets: sheetsArr,
          activeSheet:
            typeof result.active_sheet === "string"
              ? result.active_sheet
              : null,
          columnsDetected:
            result.columns_detected != null
              ? (result.columns_detected as FinancialState["columnsDetected"])
              : null,
          currency: sym,
          monthly,
          forecast:
            result.forecast != null
              ? (result.forecast as Record<string, unknown>)
              : {},
          anomalies: Array.isArray(result.anomalies) ? result.anomalies : [],
          variance:
            result.variance != null
              ? (result.variance as Record<string, unknown>)
              : {},
          breakeven:
            result.breakeven != null
              ? (result.breakeven as Record<string, unknown>)
              : {},
          cashflow:
            result.cashflow != null
              ? (result.cashflow as Record<string, unknown>)
              : {},
          brief:
            result.brief != null
              ? (result.brief as Record<string, unknown>)
              : {},
          customers: Array.isArray(result.customers) ? result.customers : [],
          rfm: Array.isArray(result.rfm) ? result.rfm : [],
          posCategories: Array.isArray(result.categories)
            ? result.categories
            : [],
          posItems: Array.isArray(result.items) ? result.items : [],
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

// ── Exports ────────────────────────────────────────────────────────────────────

// New name (used by files I wrote)
export const useFinancialStore = _store;

// Old name — ALL existing dashboard pages import { useStore } from '@/lib/store'
// This alias makes them work without touching any page file.
export const useStore = _store;
