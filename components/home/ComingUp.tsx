'use client';

// Coming up (redesign pilot): the next two weeks from the schedule, as a list
// beside the activity feed: what happened on the left, what is coming on the
// right. Anything already past its time is shown first, in red.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, Truck, Users, Landmark, Bell, Package } from 'lucide-react';
import { listSchedule, type ScheduleItem, type ScheduleKind } from '@/lib/api';
import Panel from './Panel';

const KIND_ICON: Record<ScheduleKind, React.ReactNode> = {
  meeting: <Users />, pickup: <Package />, delivery: <Truck />, deadline: <Landmark />,
  payment_due: <Landmark />, reminder: <Bell />, other: <CalendarClock />,
};

function whenWords(d: Date): string {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - start.getTime()) / 86_400_000);
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const showTime = !(d.getHours() === 0 && d.getMinutes() === 0);
  const dayPart = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday'
    : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  return showTime ? `${dayPart}, ${time}` : dayPart;
}

export default function ComingUp() {
  const [items, setItems] = useState<ScheduleItem[] | null>(null);
  useEffect(() => {
    let alive = true;
    listSchedule(14).then((l) => { if (alive) setItems(l); }).catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, []);

  const now = Date.now();
  const rows = (items ?? [])
    .filter((i) => i.status === 'scheduled')
    .map((i) => ({ item: i, when: new Date(i.next_occurrences?.[0] ?? i.starts_at) }))
    .sort((a, b) => a.when.getTime() - b.when.getTime())
    .slice(0, 6);

  return (
    <Panel title="Coming up" labelledBy="coming-up-title"
      action={<Link href="/dashboard/schedule" className="pill pill-quiet">Schedule</Link>}>
      {items === null ? <div className="skeleton" style={{ height: 200 }} /> : rows.length === 0 ? (
        <div style={{ display: 'grid', gap: 12, justifyItems: 'start' }}>
          <p style={{ margin: 0, fontSize: 'var(--fs-body)', color: 'var(--text-3)' }}>Nothing in the next two weeks.</p>
          <Link href="/dashboard/schedule" className="pill">Add a reminder</Link>
        </div>
      ) : (
        <div>
          {rows.map(({ item, when }) => {
            const late = when.getTime() < now;
            return (
              <Link key={item.id} href="/dashboard/schedule" className="row-link">
                <span className={`avatar ${late ? 'avatar-out' : 'avatar-brand'}`} aria-hidden="true">{KIND_ICON[item.kind] ?? <CalendarClock />}</span>
                <span className="row-main">
                  <span className="row-title">{item.title}</span>
                  <span className="row-sub" style={late ? { color: 'var(--red)', fontWeight: 600 } : undefined}>
                    {late ? `Overdue, ${whenWords(when).toLowerCase()}` : whenWords(when)}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
