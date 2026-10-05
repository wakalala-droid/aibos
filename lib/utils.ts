// lib/utils.ts — AIBOS shared utilities

export {
  setCurrencyGlobal,
  getCurrencySymbol,
  formatCurrency,
  formatAxis,
  fmt,
} from "./currency";

/**
 * scoreColor — used by ops-brief, brief
 * Returns a CSS variable color string based on a 0–100 score.
 */
/** Every number is the same ink (owner, 5 Oct 2026: "the multiple colours
 *  are breaking the theme"). A score's band is said in words beside it, not
 *  by painting the figure. The argument is kept so callers need not change. */
export function scoreColor(_score: number | null | undefined): string {
  return "var(--text-1)";
}

export function n(v: unknown): number {
  const num = Number(v);
  return Number.isFinite(num) ? num : 0;
}

export function safeMax(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => (b > a ? b : a), arr[0]);
}

export function safeMin(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => (b < a ? b : a), arr[0]);
}

export function formatPct(value: number | null | undefined, decimals = 1): string {
  const num = value ?? 0;
  return `${num > 0 ? "+" : ""}${num.toFixed(decimals)}%`;
}

export function clamp(num: number, min: number, max: number): number {
  return Math.min(Math.max(num, min), max);
}

export function cx(...classes: (string | false | null | undefined | 0)[]): string {
  return classes.filter(Boolean).join(" ");
}
