// Honest month-on-month change (UI/UX audit 2026-10, A11 and A25).
//
// A percentage worked out from a tiny first month reads as broken ("Revenue
// ▲ 1423.5%", "margin expanded 360.1 pts") and an owner who sees one broken
// number stops trusting every other number on the page. So a percentage is
// shown only against a sensible base: at least three months recorded, and the
// month before was positive and at least a tenth of this one. Otherwise the
// change is given in money: "K44,000 more than August".

import { fmt } from './utils';

/** Months of records before a percentage change or a health score means anything. */
export const MIN_MONTHS = 3;

export interface MonthChange {
  /** This month minus the month before, in money (or points for a margin). */
  diff: number;
  /** Percentage change, only when the base is sensible. */
  pct?: number;
}

export function monthChange(cur: number, prev: number | undefined, monthsRecorded: number): MonthChange | undefined {
  if (prev === undefined || !Number.isFinite(cur) || !Number.isFinite(prev)) return undefined;
  const diff = cur - prev;
  const sensible = monthsRecorded >= MIN_MONTHS && prev > 0 && prev >= Math.abs(cur) * 0.1;
  return { diff, pct: sensible ? (diff / prev) * 100 : undefined };
}

/** Whether the books hold enough months for a percentage or a score. */
export const enoughHistory = (monthsRecorded: number): boolean => monthsRecorded >= MIN_MONTHS;

const LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * "2026-07" or "2026-07-01" as "July" (or "Jul"), with the year added when it
 * is not this year. Anything that is not a year-month passes through untouched,
 * so uploaded labels like "Week 3" still read as the owner wrote them.
 */
export function monthName(raw: unknown, style: 'long' | 'short' = 'long'): string {
  const s = String(raw ?? '').trim();
  const m = /^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/.exec(s);
  if (!m) return s;
  const idx = Number(m[2]) - 1;
  if (idx < 0 || idx > 11) return s;
  const name = style === 'short' ? LONG[idx].slice(0, 3) : LONG[idx];
  const year = Number(m[1]);
  return year === new Date().getFullYear() ? name : `${name} ${style === 'short' ? `'${String(year).slice(2)}` : year}`;
}

/** Chart axis label: "Jul". */
export const monthTick = (raw: unknown): string => monthName(raw, 'short');

/** "K44,000 more than August", "K3,200 less than August", "the same as August". */
export function moneyChangeText(diff: number, sym: string, prevMonth: string): string {
  const before = monthName(prevMonth) || 'the month before';
  if (Math.round(diff) === 0) return `the same as ${before}`;
  return `${fmt(Math.abs(diff), false, sym)} ${diff > 0 ? 'more' : 'less'} than ${before}`;
}
