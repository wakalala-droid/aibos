// lib/currency.ts — canonical currency module
// fmt(value, compact, symbolOverride) — matches every page call site exactly:
//   fmt(kpi.totalRevenue, true, sym)
//   fmt(row.revenue, false, sym)

// ── Universal currency catalog ────────────────────────────────────────────────
// Single source of truth for the currency-format selector, onboarding, and the
// business profile. Display formatting only — AIBOS never converts amounts.

export interface CurrencyDef {
  code: string;   // ISO 4217
  symbol: string; // display symbol used across every page
  name: string;
}

export const CURRENCIES: CurrencyDef[] = [
  { code: "ZMW", symbol: "K",   name: "Zambian Kwacha" },
  { code: "USD", symbol: "$",   name: "US Dollar" },
  { code: "EUR", symbol: "€",   name: "Euro" },
  { code: "GBP", symbol: "£",   name: "British Pound" },
  { code: "ZAR", symbol: "R",   name: "South African Rand" },
  { code: "NGN", symbol: "₦",   name: "Nigerian Naira" },
  { code: "KES", symbol: "KSh", name: "Kenyan Shilling" },
  { code: "TZS", symbol: "TSh", name: "Tanzanian Shilling" },
  { code: "UGX", symbol: "USh", name: "Ugandan Shilling" },
  { code: "MWK", symbol: "MK",  name: "Malawian Kwacha" },
  { code: "BWP", symbol: "P",   name: "Botswana Pula" },
  { code: "GHS", symbol: "GH₵", name: "Ghanaian Cedi" },
  { code: "CNY", symbol: "¥",   name: "Chinese Yuan" },
  { code: "INR", symbol: "₹",   name: "Indian Rupee" },
];

/** Resolve a symbol or ISO code ("ZMW", "K", "$") to a catalog entry. */
export function currencyForToken(token: string | null | undefined): CurrencyDef | null {
  if (!token) return null;
  const t = token.trim();
  if (!t) return null;
  return (
    CURRENCIES.find((c) => c.code.toLowerCase() === t.toLowerCase()) ??
    CURRENCIES.find((c) => c.symbol === t) ??
    null
  );
}

/** Display symbol for a symbol-or-code token; unknown tokens pass through. */
export function symbolForToken(token: string | null | undefined): string {
  const hit = currencyForToken(token);
  return hit ? hit.symbol : (token ?? "").trim();
}

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

/**
 * formatAxis(value) — compact tick label for chart axes.
 * No currency symbol (the axis already lives in a currency context and the
 * tooltip shows the full amount). Thousands → "80k", "450k"; millions → "1.2M".
 */
export function formatAxis(value: number | null | undefined): string {
  const num = Number(value) || 0;
  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num);

  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}${(m < 10 ? m.toFixed(1) : m.toFixed(0)).replace(/\.0$/, "")}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${Math.round(abs / 1_000)}k`;
  }
  return `${sign}${Math.round(abs)}`;
}
