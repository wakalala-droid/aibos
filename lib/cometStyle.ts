// cometStyle — config for the KPI card's own inner glow → comet behaviour.
// This is NOT a separate component/overlay: it just returns the className + CSS
// variables that the .kpi-card's own ::before/::after read (see globals.css).
// The card's existing top-right glow is what animates into the comet and back.

import type { CSSProperties } from 'react';

const BANDS = {
  warning:  { tail: 22, dur: 16 }, // 45–60
  high:     { tail: 32, dur: 13 }, // 25–44
  critical: { tail: 44, dur: 10 }, // < 25
} as const;

type Band = keyof typeof BANDS;

function bandFor(score: number | undefined): Band | null {
  if (typeof score !== 'number' || score > 60) return null; // 60 and below
  if (score >= 45) return 'warning';
  if (score >= 25) return 'high';
  return 'critical';
}

/**
 * cometProps(score, accent) → spread onto the `.kpi-card` element.
 * - accent: the card's own glow colour (e.g. its sparkline colour).
 * - score <= 60: the inner glow turns amber/red and animates into a comet.
 */
export function cometProps(score: number | undefined, accent: string): {
  className: string;
  style: CSSProperties;
} {
  const band = bandFor(score);
  const cometColor = band === 'warning' ? 'var(--warn)' : 'var(--crit)';
  const bloomBase = band ? cometColor : accent;

  const style = {
    ['--card-glow']: `color-mix(in srgb, ${bloomBase} 24%, transparent)`,
  } as CSSProperties;

  if (band) {
    Object.assign(style, {
      ['--comet-color']: cometColor,
      ['--comet-c50']: `color-mix(in srgb, ${cometColor} 55%, transparent)`,
      ['--comet-c25']: `color-mix(in srgb, ${cometColor} 28%, transparent)`,
      ['--comet-tail']: `${BANDS[band].tail}deg`,
      ['--comet-dur']: `${BANDS[band].dur}s`,
    });
  }

  return { className: band ? 'comet' : '', style };
}
