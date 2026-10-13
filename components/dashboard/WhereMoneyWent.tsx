'use client';

// Where your money went (UI/UX audit 2026-10 C5, B5 partition bar).
//
// One bar that splits a month's money out by what it was for, with each part
// named in words and amounts underneath, so colour is never the only signal
// and there is no legend to decode. Each line opens Activity on the entries
// behind it, for the same period. For the period picked on the chips (C6),
// this month unless the owner picks another.
//
// Added up on the server from every confirmed entry (GET /books/money-out),
// with the money figure's own rule, and read again whenever the books change.
// It used to be added up here from the newest 1,000 entries, counting entries
// still waiting for the owner, and it never refreshed.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import SectionCard from '@/components/ui/SectionCard';
import { getMoneyOut, type MoneyOutPart } from '@/lib/api';
import { typeLabel } from '@/components/spine/eventMeta';
import { monthName } from '@/lib/change';
import { fmt } from '@/lib/utils';
import { sumMoney } from '@/lib/ngwee';
import { useStore } from '@/lib/store';
import { useMoney } from '@/hooks/useMoney';
import { usePeriod, periodRange, periodLabel } from '@/lib/period';
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
function partOf(p: MoneyOutPart): { name: string; href: string } {
  const category = String(p.category ?? '').trim();
  if (p.event_type === 'Expense' && category) {
    return { name: title(category), href: `/dashboard/timeline?type=Expense&status=confirmed&q=${encodeURIComponent(category)}` };
  }
  return { name: typeLabel(p.event_type), href: `/dashboard/timeline?type=${p.event_type}&status=confirmed` };
}

export default function WhereMoneyWent({ sym }: { sym: string }) {
  const [period, setPeriod] = usePeriod('this-month');
  const version = useStore((s) => s.booksVersion);
  const [parts, setParts] = useState<MoneyOutPart[] | null>(null);
  // Has anything ever gone out? With nothing spent, there is no card at all.
  // From the same read as the money figure (hooks/useMoney).
  const money = useMoney(30);
  const ever = money ? money.months.some((m) => m.out > 0) : null;

  useEffect(() => {
    if (version === 0) return;
    let alive = true;
    const range = periodRange(period);
    getMoneyOut(range?.[0], range?.[1])
      .then((out) => { if (alive) setParts(out.parts); })
      .catch(() => { if (alive) setParts([]); });
    return () => { alive = false; };
  }, [period, version]);

  const view = useMemo(() => {
    if (!ever || parts === null) return null;
    const range = periodRange(period);
    // "This month" and "Last month" read as the month's name.
    const label = range && (period === 'this-month' || period === 'last-month')
      ? monthName(monthKey(range[0].toISOString()))
      : periodLabel(period);
    // Two kinds the server keeps apart can share a name here: one line each.
    const byPart = new Map<string, { name: string; href: string; total: number; count: number }>();
    for (const p of parts) {
      const named = partOf(p);
      const cur = byPart.get(named.name) ?? { ...named, total: 0, count: 0 };
      cur.total = sumMoney([cur.total, p.total]); cur.count += p.count;
      byPart.set(named.name, cur);
    }
    const all = [...byPart.values()].sort((a, b) => b.total - a.total);
    const total = sumMoney(all.map((p) => p.total));
    const shown = all.slice(0, MAX_PARTS);
    const rest = all.slice(MAX_PARTS);
    if (rest.length) {
      shown.push({
        name: 'Everything else', href: '/dashboard/timeline?status=confirmed',
        total: sumMoney(rest.map((p) => p.total)), count: rest.reduce((t, p) => t + p.count, 0),
      });
    }
    return { label, total, parts: shown };
  }, [ever, parts, period]);

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
                {/* Name over its count and share, amount on the right: on a
                    phone four columns left the name three lines tall. */}
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.4 }}>
                  <span style={{ overflowWrap: 'break-word' }}>{p.name}</span>
                  <span className="tnum" style={{ color: 'var(--text-3)' }}>{p.count} {p.count === 1 ? 'entry' : 'entries'} · {pct}%</span>
                </span>
                <span className="tnum" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(p.total, false, sym)}</span>
                <span aria-hidden="true" style={{ color: 'var(--text-3)' }}>›</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
