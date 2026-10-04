// Pick a period in one tap (UI/UX audit 2026-10 C6, B12).
//
// One set of periods for every page that shows a window of time, kept in the
// address (?period=last-month) so a link or a reload keeps it. Dates are the
// owner's local days; weeks start on Monday.

'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export type PeriodKey = 'this-week' | 'this-month' | 'last-month' | 'this-year' | 'all';

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'this-week', label: 'This week' },
  { key: 'this-month', label: 'This month' },
  { key: 'last-month', label: 'Last month' },
  { key: 'this-year', label: 'This year' },
  { key: 'all', label: 'Everything' },
];

const KEYS = new Set<string>(PERIODS.map((p) => p.key));

export function parsePeriod(v: string | null | undefined, fallback: PeriodKey): PeriodKey {
  return v && KEYS.has(v) ? (v as PeriodKey) : fallback;
}

export function periodLabel(key: PeriodKey): string {
  return PERIODS.find((p) => p.key === key)?.label ?? 'Everything';
}

/** [from, to) in local time, or null for everything. */
export function periodRange(key: PeriodKey, now = new Date()): [Date, Date] | null {
  const y = now.getFullYear(), m = now.getMonth();
  switch (key) {
    case 'this-week': {
      const start = new Date(y, m, now.getDate() - ((now.getDay() + 6) % 7));
      return [start, new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7)];
    }
    case 'this-month': return [new Date(y, m, 1), new Date(y, m + 1, 1)];
    case 'last-month': return [new Date(y, m - 1, 1), new Date(y, m, 1)];
    case 'this-year': return [new Date(y, 0, 1), new Date(y + 1, 0, 1)];
    default: return null;
  }
}

export function inPeriod(iso: string, range: [Date, Date] | null): boolean {
  if (!range) return true;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t >= range[0].getTime() && t < range[1].getTime();
}

/** The period in the address, and a setter that keeps every other parameter. */
export function usePeriod(fallback: PeriodKey): [PeriodKey, (k: PeriodKey) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const period = parsePeriod(params.get('period'), fallback);
  const set = useCallback((k: PeriodKey) => {
    const next = new URLSearchParams(params.toString());
    if (k === fallback) next.delete('period'); else next.set('period', k);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [params, router, pathname, fallback]);
  return [period, set];
}
