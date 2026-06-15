// lib/utils.ts — AI-BOS shared utilities
// formatCurrency and setCurrencyGlobal imported from currency.ts

export { setCurrencyGlobal, getCurrencySymbol, formatCurrency } from "./currency";

/**
 * Safe number coercion — returns 0 for null / undefined / NaN.
 * Use this in page components instead of Number(v) to avoid NaN crashes.
 */
export function n(v: unknown): number {
  const num = Number(v);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Safe array max — uses reduce, never spread (avoids stack overflow).
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
 * Format a percentage with optional sign prefix.
 */
export function formatPct(value: number | null | undefined, decimals = 1): string {
  const num = value ?? 0;
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toFixed(decimals)}%`;
}

/**
 * Clamp a number.
 */
export function clamp(num: number, min: number, max: number): number {
  return Math.min(Math.max(num, min), max);
}

/**
 * Lightweight class-name joiner (avoids clsx dependency).
 */
export function cx(
  ...classes: (string | false | null | undefined | 0)[]
): string {
  return classes.filter(Boolean).join(" ");
}
