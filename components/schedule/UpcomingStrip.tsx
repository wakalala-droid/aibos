'use client';
/**
 * AIBOS — "Coming up" strip on the Overview.
 * The next three commitments + an overdue warning, one glance, one tap to the
 * Scheduler. Free for every tier — daily calendar opens are the cheapest
 * retention loop, so the habit surface is never gated (the Pro layer is
 * recurrence + reminders, not visibility). Renders nothing when empty — an
 * empty strip is visual noise (Design Constitution §5).
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listSchedule, type ScheduleItem, type ScheduleKind } from '@/lib/api';

const KIND_COLOUR: Record<ScheduleKind, string> = {
  meeting: 'var(--cyan)', pickup: 'var(--green)', delivery: 'var(--e2)',
  deadline: 'var(--red)', payment_due: 'var(--amber)', reminder: 'var(--text-3)', other: 'var(--text-3)',
};

const fmtWhen = (d: Date) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff === 0) return `Today ${time}`;
  if (diff === 1) return `Tomorrow ${time}`;
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
};

export default function UpcomingStrip() {
  const [items, setItems] = useState<ScheduleItem[]>([]);

  useEffect(() => {
    let alive = true;
    listSchedule(14).then(list => { if (alive) setItems(list); }).catch(() => { /* strip is best-effort */ });
    return () => { alive = false; };
  }, []);

  const now = Date.now();
  const scheduled = items
    .filter(i => i.status === 'scheduled')
    .map(i => ({ item: i, when: new Date(i.next_occurrences?.[0] ?? i.starts_at) }))
    .sort((a, b) => a.when.getTime() - b.when.getTime());
  const overdue = scheduled.filter(e => e.when.getTime() < now).length;
  const upcoming = scheduled.filter(e => e.when.getTime() >= now).slice(0, 3);

  if (overdue === 0 && upcoming.length === 0) return null;

  return (
    <Link href="/dashboard/schedule" aria-label="Open your schedule" style={{ textDecoration: 'none', display: 'block', marginBottom: 24 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        padding: '10px 14px', borderRadius: 10,
        border: `1px solid ${overdue ? 'color-mix(in srgb, var(--amber) 45%, transparent)' : 'var(--border)'}`,
        background: 'var(--bg-badge)',
      }}>
        <span style={{ fontSize: 'var(--fs-label)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-4)', flexShrink: 0 }}>
          Coming up
        </span>
        {overdue > 0 && (
          <span className="badge" style={{ background: 'color-mix(in srgb, var(--amber) 14%, transparent)', color: 'var(--amber)', flexShrink: 0 }}>
            {overdue} overdue
          </span>
        )}
        {upcoming.map(({ item, when }) => (
          <span key={item.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: KIND_COLOUR[item.kind], flexShrink: 0 }} />
            <span style={{ fontSize: 'var(--fs-data)', fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
              {item.title}
            </span>
            <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', whiteSpace: 'nowrap' }}>
              {item.all_day ? fmtWhen(when).replace(/ \d.*$/, '') : fmtWhen(when)}
            </span>
          </span>
        ))}
        <span style={{ fontSize: 'var(--fs-label)', color: 'var(--cyan)', marginLeft: 'auto', flexShrink: 0 }}>
          Open →
        </span>
      </div>
    </Link>
  );
}
