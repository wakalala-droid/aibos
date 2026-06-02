// AI-BOS — shared utilities

// ---------------------------------------------------------------------------
// Currency — always Kwacha for AI-BOS Zambia
// ---------------------------------------------------------------------------

const DEFAULT_SYM = 'K';

/**
 * Format a number as Zambian Kwacha.
 * @param value       The numeric value
 * @param compact     Use abbreviated form (K215k) for large numbers
 * @param sym         Currency symbol — defaults to 'K'
 */
export function formatCurrency(
  value: number,
  compact = false,
  sym: string = DEFAULT_SYM,
): string {
  if (!isFinite(value)) return `${sym}0`;

  if (compact) {
    if (Math.abs(value) >= 1_000_000)
      return `${sym}${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000)
      return `${sym}${(value / 1_000).toFixed(1)}k`;
  }

  return `${sym}${value.toLocaleString('en-ZM', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format percentage value.
 */
export function formatPct(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Backward-compatible alias used across dashboard pages.
 */
export function formatPercent(value: number, decimals = 1): string {
  return formatPct(value, decimals);
}

/**
 * Clamp a number between min and max.
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

/**
 * Kept for backward compat — no-op, currency is always K.
 */
export function setCurrencyGlobal(_sym: string) {}

// ---------------------------------------------------------------------------
// CSS variable reader — used in chart tick formatters to avoid hardcoded '$'
// ---------------------------------------------------------------------------

/**
 * Returns the current currency symbol from store.
 * Used in Recharts tick formatters which can't use hooks.
 * Reads from a global singleton set by the store.
 */
let _globalSym = DEFAULT_SYM;

export function getGlobalSym(): string {
  return _globalSym;
}

export function setGlobalSym(sym: string) {
  _globalSym = sym;
}

/**
 * Ease-out curve for animated counters and chart labels.
 */
export function easeOutQuart(t: number): number {
  const clamped = clamp(t, 0, 1);
  return 1 - Math.pow(1 - clamped, 4);
}

// ---------------------------------------------------------------------------
// Theme CSS variable helpers
// ---------------------------------------------------------------------------

export const tokens = {
  e1:      'var(--e1)',
  e2:      'var(--e2)',
  e3:      'var(--e3)',
  good:    'var(--good)',
  warn:    'var(--warn)',
  crit:    'var(--crit)',
  info:    'var(--info)',
  purple:  'var(--purple)',

  bgBase:    'var(--bg-base)',
  bgSurface: 'var(--bg-surface)',
  bgSurface2:'var(--bg-surface-2)',
  bgHover:   'var(--bg-hover)',

  border:    'var(--border-subtle)',
  borderMd:  'var(--border-medium)',
  borderStr: 'var(--border-strong)',

  shimmer:   'var(--shimmer)',

  textPrimary:   'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  textMuted:     'var(--text-muted)',
  textFaint:     'var(--text-faint)',

  shadow:    'var(--shadow-card)',
  blur:      'var(--blur)',
  lockBg:    'var(--lock-overlay)',

  tooltipBg:     'var(--tooltip-bg)',
  tooltipBorder: 'var(--tooltip-border)',

  tableHover:  'var(--table-hover)',
  tableBorder: 'var(--table-border)',
  tableHead:   'var(--table-head)',
} as const;
