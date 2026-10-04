'use client';

// Where your money went (UI/UX audit 2026-10 C5, B5 partition bar).
//
// One bar that splits a month's money out by what it was for, with each part
// named in words and amounts underneath, so colour is never the only signal
// and there is no legend to decode. Each line opens Activity on the entries
// behind it, for the same period. Read from the recorded entries, for the
// period picked on the chips (C6), this month unless the owner picks another.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import SectionCard from '@/components/ui/SectionCard';
import { listEvents, type BusinessEvent } from '@/lib/api';
import { cashSign, amountOf, typeLabel } from '@/components/spine/eventMeta';
import { monthName } from '@/lib/change';
import { fmt } from '@/lib/utils';
import { usePeriod, periodRange, inPeriod, periodLabel } from '@/lib/period';
import PeriodChips from '@/components/ui/PeriodChips';

// Five distinct hues (--e2 is the same orange as --orange); the rest is grey.
const COLOURS = ['var(--e1)', 'var(--orange)', 'var(--purple)', 'var(--cyan)', 'var(--amber)'];
const MAX_PARTS = 5;

function monthKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** What it was for, as the owner would say it, and where its entries are. */
function partOf(ev: BusinessEvent): { name: string; href: string } {
  const category = String(ev.payload?.category ?? '').trim();
  if (ev.event_type === 'Expense' && category) {
    return { name: title(category), href: `/dashboard/timeline?type=Expense&q=${encodeURIComponent(category)}` };
  }
  return { name: typeLabel(ev.event_type), href: `/dashboard/timeline?type=${ev.event_type}` };
}

export default function WhereMoneyWent({ sym }: { sym: string }) {
  const [events, setEvents] = useState<BusinessEvent[] | null>(null);
  const [period, setPeriod] = usePeriod('this-month');

  useEffect(() => {
    let alive = true;
    listEvents({ limit: 1000 })
      .then((evs) => { if (alive) setEvents(evs); })
      .catch(() => { if (alive) setEvents([]); });
    return () => { alive = false; };
  }, []);

  const view = useMemo(() => {
    const out = (events ?? []).filter((e) => e.status !== 'void' && cashSign(e) < 0 && amountOf(e) > 0);
    if (!out.length) return null;   // nothing ever spent: no card at all
    const range = periodRange(period);
    // "This month" and "Last month" read as the month's name.
    const label = range && (period === 'this-month' || period === 'last-month')
      ? monthName(monthKey(range[0].toISOString()))
      : periodLabel(period);
    const byPart = new Map<string, { name: string; href: string; total: number; count: number }>();
    for (const e of out) {
      if (!inPeriod(e.occurred_at, range)) continue;
      const p = partOf(e);
      const cur = byPart.get(p.name) ?? { ...p, total: 0, count: 0 };
      cur.total += amountOf(e); cur.count += 1;
      byPart.set(p.name, cur);
    }
    const parts = [...byPart.values()].sort((a, b) => b.total - a.total);
    const total = parts.reduce((t, p) => t + p.total, 0);
    const shown = parts.slice(0, MAX_PARTS);
    const rest = parts.slice(MAX_PARTS);
    if (rest.length) {
      shown.push({
        name: 'Everything else', href: '/dashboard/timeline',
        total: rest.reduce((t, p) => t + p.total, 0), count: rest.reduce((t, p) => t + p.count, 0),
      });
    }
    return { label, total, parts: shown };
  }, [events, period]);

  if (!view) return null;

  return (
    <SectionCard
      title="Where your money went"
      subtitle={`${view.label}: ${fmt(view.total, false, sym)} went out`}
      style={{ marginBottom: 20 }}
    >
      <div style={{ marginBottom: 16 }}>
        <PeriodChips value={period} onChange={setPeriod} label="Which period" />
      </div>
      {view.parts.length === 0 && (
        <p style={{ margin: 0, fontSize: 'var(--fs-body)', color: 'var(--text-3)' }}>
          Nothing has gone out in this period yet.
        </p>
      )}
      {/* The bar is a picture of the list below, which carries the figures. */}
      {view.parts.length > 0 && <div aria-hidden="true" style={{ display: 'flex', gap: 2, height: 20, borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: 16 }}>
        {view.parts.map((p, i) => (
          <span key={p.name} style={{ flexGrow: p.total, flexBasis: 0, minWidth: 4, background: p.name === 'Everything else' ? 'var(--text-4)' : COLOURS[i % COLOURS.length] }} />
        ))}
      </div>}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
        {view.parts.map((p, i) => {
          const pct = view.total > 0 ? Math.round((p.total / view.total) * 100) : 0;
          return (
            <li key={p.name}>
              <Link href={period === 'all' ? p.href : `${p.href}${p.href.includes('?') ? '&' : '?'}period=${period}`} className="tap-link"
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '6px 0', textDecoration: 'none', color: 'var(--text-1)', fontSize: 'var(--fs-body)' }}>
                <span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 3, flexShrink: 0, background: p.name === 'Everything else' ? 'var(--text-4)' : COLOURS[i % COLOURS.length] }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  {p.name}
                  <span style={{ color: 'var(--text-3)' }}> · {p.count} {p.count === 1 ? 'entry' : 'entries'}</span>
                </span>
                <span className="tnum" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(p.total, false, sym)}</span>
                <span className="tnum" style={{ color: 'var(--text-3)', width: 48, textAlign: 'right', flexShrink: 0 }}>{pct}%</span>
                <span aria-hidden="true" style={{ color: 'var(--text-3)' }}>›</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
