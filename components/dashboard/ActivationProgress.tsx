'use client';

// ActivationProgress — turns the retention hook into the activation goal
// (audit §10 fix #4): "record on 3 different days → your Morning Brief
// unlocks." Counts DISTINCT recording days from the event log, celebrates the
// unlock, then disappears. Silent once the goal is met and acknowledged, so it
// never nags an established user.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarCheck } from 'lucide-react';
import { listEvents, type BusinessEvent } from '@/lib/api';

const GOAL_DAYS = 3;
const DISMISS_KEY = 'aibos-activation-done-v1';

function distinctDays(events: BusinessEvent[]): number {
  const days = new Set<string>();
  for (const e of events) {
    if (e.status === 'void') continue;
    days.add(new Date(e.occurred_at).toLocaleDateString('en-CA'));
  }
  return days.size;
}

export default function ActivationProgress() {
  const [events, setEvents] = useState<BusinessEvent[] | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    listEvents({ limit: 500 }).then((e) => { if (alive) setEvents(e); }).catch(() => {});
    try { setDone(window.localStorage.getItem(DISMISS_KEY) === '1'); } catch { /* private mode */ }
    return () => { alive = false; };
  }, []);

  const days = useMemo(() => distinctDays(events ?? []), [events]);

  // Not loaded yet, or the owner has already blown past the goal and it's been
  // acknowledged → stay out of the way.
  if (events === null || done) return null;
  // A clearly-established business (well past the goal) never sees this.
  if (days > GOAL_DAYS + 2) return null;

  const reached = days >= GOAL_DAYS;
  const pct = Math.min(days / GOAL_DAYS, 1) * 100;

  // A bento card (5 Oct 2026): round mark, spaced-capital title with the day
  // count as its tag, one even bar and one next step.
  return (
    <div role="status" className="bento" style={{ marginBottom: 16 }}>
      <div className="bento-head">
        <span className="bento-icon" aria-hidden="true"><CalendarCheck /></span>
        <div className="bento-main">
          <div className="bento-titlerow">
            <p className="bento-title">{reached ? 'Your morning brief is ready' : 'Unlock your morning brief'}</p>
            <span className="bento-tag">{Math.min(days, GOAL_DAYS)} of {GOAL_DAYS} days</span>
          </div>
          <div className="progress-track" style={{ height: 8, marginTop: 12 }}>
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="bento-text">
            {reached
              ? 'Every morning AIBOS now sums up your day.'
              : `Record a sale or expense on ${GOAL_DAYS} different days. That is enough for AIBOS to spot your first patterns.`}
          </p>
        </div>
      </div>
      <div className="bento-foot">
        {reached ? (
          <>
            <Link href="/dashboard/brief" className="pill pill-primary">See it</Link>
            <button type="button" className="pill pill-quiet" onClick={() => { try { window.localStorage.setItem(DISMISS_KEY, '1'); } catch { /* private mode */ } setDone(true); }}>Dismiss</button>
          </>
        ) : (
          <>
            <Link href="/dashboard/record" className="pill pill-primary">Record now</Link>
            {days === 0 && <Link href="/dashboard/demo" className="pill pill-quiet">See a sample first</Link>}
          </>
        )}
      </div>
    </div>
  );
}
