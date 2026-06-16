// lib/currency.ts — canonical currency module
// fmt(value, compact, symbolOverride) — matches every page call site exactly:
//   fmt(kpi.totalRevenue, true, sym)
//   fmt(row.revenue, false, sym)

let _sym = "K";

export function setCurrencyGlobal(sym: string): void {
  if (sym) _sym = sym;
}

export function getCurrencySymbol(): string {
  return _sym;
}

/**
 * formatCurrency(value, compact?, symbolOverride?)
 * - compact=true  → abbreviate large numbers (1.2M, 450K)
 * - compact=false/omitted → full formatted number
 * - symbolOverride → use this symbol instead of the global one (pages pass `sym` explicitly)
 */
export function formatCurrency(
  value: number | null | undefined,
  compact = false,
  symbolOverride?: string
): string {
  const sym = symbolOverride || _sym || "K";
  const num = value ?? 0;
  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num);

  if (compact) {
    if (abs >= 1_000_000) return `${sign}${sym}${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${sign}${sym}${(abs / 1_000).toFixed(1)}K`;
    return `${sign}${sym}${abs.toFixed(0)}`;
  }

  return `${sign}${sym}${abs.toLocaleString("en-ZM", { maximumFractionDigits: 0 })}`;
}

/** Alias used by every page: import { fmt } from '@/lib/utils' */
export const fmt = formatCurrency;
