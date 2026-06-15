// lib/utils.ts — AI-BOS shared utilities
// Re-exports from currency.ts PLUS backward-compat aliases for all existing pages

export {
  setCurrencyGlobal,
  getCurrencySymbol,
  formatCurrency,
  fmt,           // ← existing pages use: import { fmt } from '@/lib/utils'
} from "./currency";

/**
 * scoreColor — used by dashboard/page.tsx, brief/page.tsx, ops-brief/page.tsx
 * Returns a CSS variable color string based on a 0–100 score.
 */
export function scoreColor(score: number | null | undefined): string {
  const s = score ?? 0;
  if (s >= 75) return "var(--good)";
  if (s >= 50) return "var(--warn)";
  return "var(--crit)";
}

/**
 * Safe number coercion — 0 for null / undefined / NaN.
 */
export function n(v: unknown): number {
  const num = Number(v);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Safe array max — reduce instead of spread (no stack overflow).
 */
export function safeMax(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => (b > a ? b : a), arr[0]);
}

/**
 * Safe array min.
 */
export function safeMin(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => (b < a ? b : a), arr[0]);
}

/**
 * Format a percentage with optional sign.
 */
export function formatPct(value: number | null | undefined, decimals = 1): string {
  const num = value ?? 0;
  return `${num > 0 ? "+" : ""}${num.toFixed(decimals)}%`;
}

/**
 * Clamp a number between min and max.
 */
export function clamp(num: number, min: number, max: number): number {
  return Math.min(Math.max(num, min), max);
}

/**
 * Lightweight class-name joiner.
 */
export function cx(...classes: (string | false | null | undefined | 0)[]): string {
  return classes.filter(Boolean).join(" ");
}
