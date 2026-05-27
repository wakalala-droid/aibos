/**
 * AI-BOS — Utility Functions
 * formatCurrency auto-reads currency symbol from a simple global.
 * Set it once in FileUpload after upload; all components pick it up.
 */

// ─── Global currency symbol (set after file upload) ───────────────────────────
let _currencySymbol = '$';

export function setCurrencyGlobal(symbol: string) {
  _currencySymbol = symbol;
}

export function getCurrencySymbol(): string {
  return _currencySymbol;
}

// ─── Currency / Number Formatters ─────────────────────────────────────────────

export function formatCurrency(value: number, compact = false, symbol?: string): string {
  const sym = symbol ?? _currencySymbol;
  const num = Number(value) || 0;
  if (compact) {
    if (Math.abs(num) >= 1_000_000) return `${sym}${(num / 1_000_000).toFixed(1)}M`;
    if (Math.abs(num) >= 1_000)     return `${sym}${(num / 1_000).toFixed(0)}K`;
    return `${sym}${num.toLocaleString()}`;
  }
  return `${sym}${num.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

export function formatRunway(months: number): string {
  if (months >= 24) return `${(months / 12).toFixed(1)}yr`;
  return `${months}mo`;
}

export function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
