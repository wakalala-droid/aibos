// bloomProps — the KPI card's severity-aware inner glow (static).
// The card's top-right bloom (`.kpi-card.glow-inner::before`, see globals.css)
// takes its colour from --card-glow: the card's own accent normally, shifting
// to amber/red when the score drops to warning/critical bands. The old orbiting
// "comet" loop was removed 2026-07-11 — motion_governance.md bans auto-playing
// decorative loops; the severity signal is carried by colour alone.

import type { CSSProperties } from 'react';

function bandFor(score: number | undefined): 'warning' | 'critical' | null {
  if (typeof score !== 'number' || score > 60) return null;
  if (score >= 45) return 'warning';
  return 'critical';
}

/**
 * bloomProps(score, accent) → spread `style` onto the `.kpi-card` element.
 * - accent: the card's own glow colour (e.g. its sparkline colour).
 * - score ≤ 60: the inner glow tints amber (45–60) or red (< 45).
 */
export function bloomProps(score: number | undefined, accent: string): {
  style: CSSProperties;
} {
  const band = bandFor(score);
  const bloomBase = band === 'warning' ? 'var(--warn)' : band === 'critical' ? 'var(--crit)' : accent;
  return {
    style: { ['--card-glow']: `color-mix(in srgb, ${bloomBase} 24%, transparent)` } as CSSProperties,
  };
}
