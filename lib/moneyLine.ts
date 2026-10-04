// The money line: cash at the end of each day, worked back from today.
//
// The twin knows the cash right now. Every recorded entry moved cash in or out
// on its day (cashSign in eventMeta, the same rule the books use), so the
// balance at the end of any earlier day is today's cash minus everything that
// moved after it. No estimate, no smoothing: each point is what the books said
// that evening.

import type { BusinessEvent } from '@/lib/api';
import { amountOf, cashSign } from '@/components/spine/eventMeta';

export interface MoneyPoint {
  /** Local day, YYYY-MM-DD. */
  day: string;
  balance: number;
  moneyIn: number;
  moneyOut: number;
}

export interface MoneyLine {
  points: MoneyPoint[];
  moneyIn: number;
  moneyOut: number;
  /** Days inside the window on which cash moved. */
  activeDays: number;
}

export const localDay = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function moneyLine(events: BusinessEvent[], cashNow: number, days: number, today = new Date()): MoneyLine {
  const flows = new Map<string, { in: number; out: number }>();
  for (const ev of events) {
    const sign = cashSign(ev);
    const amt = amountOf(ev);
    if (!sign || !amt) continue;
    const d = new Date(ev.occurred_at);
    if (Number.isNaN(d.getTime())) continue;
    const key = localDay(d);
    const f = flows.get(key) ?? { in: 0, out: 0 };
    if (sign > 0) f.in += amt; else f.out += amt;
    flows.set(key, f);
  }

  const todayKey = localDay(today);

  // Everything that moved after each day, walking back from today's cash.
  // Entries dated in the future (a delivery due next week) are left out of
  // the line but already sit in today's cash, so they are taken back first.
  let balance = cashNow;
  for (const [key, f] of flows) if (key > todayKey) balance -= f.in - f.out;

  const points: MoneyPoint[] = [];
  let moneyIn = 0, moneyOut = 0, activeDays = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = localDay(d);
    const f = flows.get(key) ?? { in: 0, out: 0 };
    points.push({ day: key, balance, moneyIn: f.in, moneyOut: f.out });
    moneyIn += f.in; moneyOut += f.out;
    if (f.in || f.out) activeDays += 1;
    balance -= f.in - f.out;           // the evening before this day
  }
  points.reverse();
  return { points, moneyIn, moneyOut, activeDays };
}

/** "Sat 4 Oct" for a local day key. */
export function dayWords(key: string, withWeekday = true): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  return date.toLocaleDateString('en-GB', withWeekday
    ? { weekday: 'short', day: 'numeric', month: 'short' }
    : { day: 'numeric', month: 'short' });
}
