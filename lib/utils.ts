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
export function scoreColor(score: number | null | undefined): string {
  const s = score ?? 0;
  if (s >= 75) return "var(--good)";
  if (s >= 50) return "var(--warn)";
  return "var(--crit)";
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
