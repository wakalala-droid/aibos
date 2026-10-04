'use client';

// Recent activity (redesign pilot): the latest entries as a statement, the
// way a bank shows transactions. Grouped by day ("Today", "Yesterday",
// "Thu 2 Oct"), each with who or what, how it moved and the amount in or out.
// A row opens that entry in Activity, where it can be fixed.

import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight, Repeat } from 'lucide-react';
import type { BusinessEvent } from '@/lib/api';
import { amountOf, cashSign, typeLabel } from '@/components/spine/eventMeta';
import { localDay, dayWords } from '@/lib/moneyLine';
import { useStore } from '@/lib/store';
import { useBooksEvents } from '@/hooks/useBooksEvents';
import { openRecordSheet } from '@/lib/recordSheet';
import BigMoney from './BigMoney';
import Panel from './Panel';

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function who(ev: BusinessEvent): string {
  const p = (ev.payload ?? {}) as Record<string, unknown>;
  const name = [p.customer, p.supplier, p.employee, p.item, p.category, p.asset_name]
    .map((v) => String(v ?? '').trim()).find(Boolean);
  return name ? title(name) : typeLabel(ev.event_type);
}

function how(ev: BusinessEvent): string {
  const method = String(ev.payload?.payment_method ?? '').replace(/_/g, ' ');
  const time = new Date(ev.occurred_at);
  // Imported and fixed entries carry no real time: they are stored at
  // midnight or noon UTC (EntryEditor), which would read as "02:00" or "14:00".
  const noTime = Number.isNaN(time.getTime())
    || (time.getUTCMinutes() === 0 && time.getUTCSeconds() === 0 && (time.getUTCHours() === 0 || time.getUTCHours() === 12));
  const clock = noTime ? '' : time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return [typeLabel(ev.event_type), method && method !== 'credit' ? method : method === 'credit' ? 'on credit' : '', clock]
    .filter(Boolean).join(' · ');
}

function dayHeading(key: string): string {
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (key === localDay(today)) return 'Today';
  if (key === localDay(yesterday)) return 'Yesterday';
  return dayWords(key);
}

export default function ActivityFeed({ limit = 8 }: { limit?: number }) {
  const sym = useStore((s) => s.currencySymbol) || 'K';
  const events = useBooksEvents();
  const todayKey = localDay(new Date());
  const latest = (events ?? [])
    .filter((e) => localDay(new Date(e.occurred_at)) <= todayKey)
    .sort((a, b) => String(b.occurred_at).localeCompare(String(a.occurred_at)))
    .slice(0, limit);

  const groups: { key: string; rows: BusinessEvent[] }[] = [];
  for (const ev of latest) {
    const key = localDay(new Date(ev.occurred_at));
    const g = groups[groups.length - 1];
    if (g && g.key === key) g.rows.push(ev); else groups.push({ key, rows: [ev] });
  }

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
                      <span className="row-title">{who(ev)}</span>
                      <span className="row-sub">{how(ev)}{ev.status === 'pending' ? ' · waiting for you' : ''}</span>
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
