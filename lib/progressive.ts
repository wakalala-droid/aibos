// lib/progressive.ts — Progressive Intelligence (Bible Ch.16 · Initiative 6).
//
// The platform reveals capability as the business matures — Observe → Understand →
// Predict → Recommend → Optimize. This is a SEPARATE axis from paid tiers
// (lib/tiers.ts): tiers gate by plan, stages gate by how much the business has
// taught AIBOS. Thresholds are grounded in real engine capability — e.g. the
// Financial engine needs >= 3 periods before a forecast is honest (engine.py
// n_periods >= 3), so "Predict" unlocks at 3 months of data, never sooner
// (SAFEGUARD §0.1: no fabricated trends).

import type { Twin } from './api';

export type StageId = 1 | 2 | 3 | 4 | 5;

export interface Stage {
  id: StageId;
  key: 'record' | 'understand' | 'predict' | 'recommend' | 'optimize';
  title: string;
  blurb: string;
  /** Number of distinct months of activity required to reach this stage. */
  monthsNeeded: number;
}

export const STAGES: Stage[] = [
  { id: 1, key: 'record',     title: 'Record',     blurb: 'Capture what happens, effortlessly.',        monthsNeeded: 0 },
  { id: 2, key: 'understand', title: 'Understand', blurb: 'See your P&L, cash and health.',             monthsNeeded: 1 },
  { id: 3, key: 'predict',    title: 'Predict',    blurb: 'Forecasts, anomalies & variance unlock.',    monthsNeeded: 3 },
  { id: 4, key: 'recommend',  title: 'Recommend',  blurb: 'AIBOS suggests actions on your numbers.',    monthsNeeded: 6 },
  { id: 5, key: 'optimize',   title: 'Optimize',   blurb: 'Continuous optimisation across the business.', monthsNeeded: 12 },
];

export interface Progress {
  stage: Stage;          // current stage reached
  next: Stage | null;    // the next stage, if any
  months: number;        // distinct months of activity recorded
  events: number;        // confirmed events folded into the twin
  pctToNext: number;     // 0..100 progress toward the next stage
  nextAction: string;    // the single next thing to do
}

/** Distinct months present in the twin's monthly bridge = data maturity. */
function monthsOf(twin: Twin | null): number {
  return twin && Array.isArray(twin.monthly) ? twin.monthly.length : 0;
}

export function computeProgress(twin: Twin | null): Progress {
  const events = twin ? Number(twin.event_count) || 0 : 0;
  const months = monthsOf(twin);

  // Highest stage whose monthsNeeded is satisfied (Stage 1 always satisfied).
  let current = STAGES[0];
  for (const s of STAGES) {
    if (months >= s.monthsNeeded && (events > 0 || s.id === 1)) current = s;
  }
  const next = STAGES.find(s => s.id === current.id + 1) ?? null;

  let pctToNext = 100;
  if (next) {
    const span = next.monthsNeeded - current.monthsNeeded || 1;
    pctToNext = Math.max(0, Math.min(100, Math.round(((months - current.monthsNeeded) / span) * 100)));
  }

  let nextAction: string;
  if (events === 0) {
    nextAction = 'Record your first business activity.';
  } else if (next) {
    const need = Math.max(0, next.monthsNeeded - months);
    nextAction = need > 0
      ? `Keep recording — ${need} more month${need === 1 ? '' : 's'} of activity unlocks ${next.title}.`
      : `You're ready for ${next.title}.`;
  } else {
    nextAction = 'Your AIBOS is fully matured — every engine is live.';
  }

  return { stage: current, next, months, events, pctToNext, nextAction };
}
