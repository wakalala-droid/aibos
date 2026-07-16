/**
 * AIBOS — useCurrencyFormatter hook
 * Returns a formatCurrency function pre-bound to the current currency symbol
 * from Zustand. Any component using this hook will automatically re-render
 * when the currency changes after file upload.
 *
 * Usage:
 *   const fmt = useCurrencyFormatter();
 *   fmt(12345)        // → "K12,345" (or "$12,345" etc.)
 *   fmt(12345, true)  // → "K12K"
 */

import { useStore } from '@/lib/store';

export function useCurrencyFormatter() {
  const sym = useStore(s => s.currencySymbol);

  return function fmt(value: number, compact = false): string {
    const num = Number(value) || 0;
    if (compact) {
      if (Math.abs(num) >= 1_000_000) return `${sym}${(num / 1_000_000).toFixed(1)}M`;
      if (Math.abs(num) >= 1_000)     return `${sym}${(num / 1_000).toFixed(0)}K`;
      return `${sym}${num.toLocaleString()}`;
    }
    return `${sym}${num.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };
}
