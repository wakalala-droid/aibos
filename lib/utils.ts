export const SYM = 'K';

export function fmt(value: number, compact = false, sym = SYM): string {
  if (!isFinite(value)) return `${sym}0`;
  if (compact) {
    if (Math.abs(value) >= 1_000_000) return `${sym}${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000)     return `${sym}${(value / 1_000).toFixed(1)}k`;
  }
  return `${sym}${value.toLocaleString('en-ZM', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function pct(v: number, d = 1) { return `${v.toFixed(d)}%`; }

export function scoreColor(s: number) {
  if (s >= 80) return 'var(--good)';
  if (s >= 60) return 'var(--blue)';
  if (s >= 40) return 'var(--warn)';
  return 'var(--crit)';
}

// Kept for back-compat
export function formatCurrency(v: number, compact = false, sym = SYM) { return fmt(v, compact, sym); }
export function setCurrencyGlobal(_s: string) {}
