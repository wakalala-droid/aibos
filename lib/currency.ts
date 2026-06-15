// lib/currency.ts — canonical currency module (no external deps)

let _sym = "K";

export function setCurrencyGlobal(sym: string): void {
  if (sym) _sym = sym;
}

export function getCurrencySymbol(): string {
  return _sym;
}

export function formatCurrency(value: number | null | undefined): string {
  const sym = _sym || "K";
  const num = value ?? 0;
  if (Math.abs(num) >= 1_000_000) {
    return `${sym}${(num / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(num) >= 1_000) {
    return `${sym}${num.toLocaleString("en-ZM", { maximumFractionDigits: 0 })}`;
  }
  return `${sym}${num.toFixed(2)}`;
}

// Alias used by some existing pages
export const fmt = formatCurrency;
