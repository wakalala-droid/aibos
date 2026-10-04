'use client';

// Recent activity (redesign pilot): the latest entries as a statement, the
// way a bank shows transactions. Grouped by day ("Today", "Yesterday",
// "Thu 2 Oct"), each with who or what, how it moved and the amount in or out.
// A row opens that entry in Activity, where it can be fixed.

import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight, Repeat } from 'lucide-react';
import { amountOf, cashSign, whoOf, howOf, dayHeading, byDay } from '@/components/spine/eventMeta';
import { localDay } from '@/lib/moneyLine';
import { useStore } from '@/lib/store';
import { useBooksEvents } from '@/hooks/useBooksEvents';
import { openRecordSheet } from '@/lib/recordSheet';
import BigMoney from './BigMoney';
import Panel from './Panel';

export default function ActivityFeed({ limit = 8 }: { limit?: number }) {
  const sym = useStore((s) => s.currencySymbol) || 'K';
  const events = useBooksEvents();
  const todayKey = localDay(new Date());
  const latest = (events ?? [])
    .filter((e) => localDay(new Date(e.occurred_at)) <= todayKey)
    .sort((a, b) => String(b.occurred_at).localeCompare(String(a.occurred_at)))
    .slice(0, limit);

  const groups = byDay(latest);

  return (
    <Panel title="Recent activity" labelledBy="recent-activity-title"
      action={<Link href="/dashboard/timeline" className="pill pill-quiet">See all</Link>}>
      {events === null ? (
        <div className="skeleton" style={{ height: 240 }} />
      ) : latest.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <p style={{ margin: 0, fontSize: 'var(--fs-body)', color: 'var(--text-3)' }}>Nothing recorded yet. Your sales and costs will appear here as you go.</p>
          <button type="button" className="pill pill-primary" onClick={openRecordSheet}>Record something</button>
        </div>
      ) : (
        <div>
          {groups.map((g) => (
            <div key={g.key}>
              <p className="day-label">{dayHeading(g.key)}</p>
              {g.rows.map((ev) => {
                const sign = cashSign(ev);
                return (
                  <Link key={ev.id} href={`/dashboard/timeline?status=all&ids=${ev.id}`} className="row-link">
                    <span className={`avatar ${sign > 0 ? 'avatar-in' : sign < 0 ? 'avatar-out' : ''}`} aria-hidden="true">
                      {sign > 0 ? <ArrowDownLeft /> : sign < 0 ? <ArrowUpRight /> : <Repeat />}
                    </span>
                    <span className="row-main">
                      <span className="row-title">{whoOf(ev)}</span>
                      <span className="row-sub">{howOf(ev)}{ev.status === 'pending' ? ' · waiting for you' : ''}</span>
                    </span>
                    {amountOf(ev) !== 0 && <BigMoney value={amountOf(ev)} sym={sym} size="md" tone={sign > 0 ? 'in' : sign < 0 ? 'out' : undefined} />}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
