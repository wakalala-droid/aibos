// lib/milestones.ts — meaningful business wins, from real data (audit #58).
//
// The audit's rule: "meaningful, not gimmicky." Every milestone here is a
// genuine fact derived from the recorded twin/events — a best month, a
// revenue threshold crossed, a recording streak — never confetti for nothing.
// One at a time, most impressive first, dismissible on-device so it never
// nags. This is the "business wins" delight the audit asked for.

import type { Twin, BusinessEvent } from './api';
import { fmt } from './utils';

export interface Milestone {
  id: string;               // stable key for on-device dismissal
  emoji: string;
  title: string;
  detail: string;
}

const THRESHOLDS = [10_000, 50_000, 100_000, 250_000, 500_000, 1_000_000];

function recordingStreak(events: BusinessEvent[]): number {
  // Distinct local days recorded, counting back from today/yesterday without a gap.
  const days = new Set<string>();
  for (const e of events) {
    if (e.status === 'void') continue;
    days.add(new Date(e.occurred_at).toLocaleDateString('en-CA')); // YYYY-MM-DD local
  }
  let streak = 0;
  const cursor = new Date();
  // Allow the streak to start today OR yesterday (recording hasn't happened yet today).
  if (!days.has(cursor.toLocaleDateString('en-CA'))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(cursor.toLocaleDateString('en-CA'))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** The most impressive current milestone, or null. `sym` is the currency symbol. */
export function topMilestone(twin: Twin | null, events: BusinessEvent[], sym: string): Milestone | null {
  const out: Milestone[] = [];
  const monthly = twin?.monthly ?? [];

  // Best month ever (needs ≥2 completed months to be a real "best").
  if (monthly.length >= 2) {
    const withProfit = monthly.map((m) => ({ month: m.month, profit: (m.revenue || 0) - (m.costs || 0) }));
    const best = withProfit.reduce((a, b) => (b.profit > a.profit ? b : a));
    const latest = withProfit[withProfit.length - 1];
    if (best.month === latest.month && best.profit > 0) {
      out.push({
        id: `best-month-${best.month}`, emoji: '🏆',
        title: 'Best month yet',
        detail: `${best.month} is your strongest month on record — ${fmt(best.profit, true, sym)} profit.`,
      });
    }
  }

  // Revenue threshold crossed (highest crossed).
  const rev = Number(twin?.total_revenue) || 0;
  const crossed = THRESHOLDS.filter((t) => rev >= t).pop();
  if (crossed) {
    out.push({
      id: `revenue-${crossed}`, emoji: '🎉',
      title: `${fmt(crossed, true, sym)} in recorded revenue`,
      detail: `You've passed ${fmt(crossed, true, sym)} in total recorded sales. Every one of them is in your books.`,
    });
  }

  // Recording streak (the habit that makes everything else work).
  const streak = recordingStreak(events);
  if (streak >= 3) {
    out.push({
      id: `streak-${streak}`, emoji: '🔥',
      title: `${streak}-day recording streak`,
      detail: streak >= 7
        ? `${streak} days in a row — your forecasts and briefs are sharper for it.`
        : `${streak} days in a row. Keep it up and your first weekly patterns unlock.`,
    });
  }

  // Most impressive first: best-month > threshold > streak (array order).
  return out[0] ?? null;
}
