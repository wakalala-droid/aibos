// One colour for numbers (the owner, 5 Oct 2026): every figure is ink, and
// red marks only a figure that has gone the wrong way (a loss, sales falling,
// costs rising, a measure off its target). Charts use the same rule: the
// series that matters in the brand line, the rest in greys, red for a loss.

export const INK = 'var(--text-1)';
export const BAD = 'var(--red)';

/** A change: red when it moved the wrong way, ink otherwise. */
export function trendTone(change: number, goodWhenUp = true): string {
  if (!Number.isFinite(change) || change === 0) return INK;
  return (goodWhenUp ? change < 0 : change > 0) ? BAD : INK;
}

/** A level that is bad below zero: profit, margin, the balance. */
export function signTone(value: number): string {
  return Number.isFinite(value) && value < 0 ? BAD : INK;
}

/** Chart colours, the leading series first (globals.css --chart-1 to 6). */
export const CHART_RAMP = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)',
  'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)',
];

/** The plain word for an alert's severity, and whether it is the red kind. */
export function severityWord(severity?: string): { word: string; bad: boolean } {
  if (severity === 'critical' || severity === 'high') return { word: 'Act now', bad: true };
  if (severity === 'warning' || severity === 'medium') return { word: 'Worth a look', bad: false };
  return { word: 'Good to know', bad: false };
}
