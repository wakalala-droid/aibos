'use client';

// ActivationProgress — turns the retention hook into the activation goal
// (audit §10 fix #4): "record on 3 different days → your Morning Brief
// unlocks." Counts DISTINCT recording days from the event log, celebrates the
// unlock, then disappears. Silent once the goal is met and acknowledged, so it
// never nags an established user.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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

  return (
    <div role="status" style={{
      padding: '14px 16px', marginBottom: 20, borderRadius: 12,
      border: `1px solid ${reached ? 'var(--good)' : 'var(--border-md)'}`,
      background: reached ? 'color-mix(in srgb, var(--good) 8%, transparent)' : 'var(--bg-card)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text-1)' }}>
          {reached ? '🎉 Your Morning Brief is ready' : `Record on ${GOAL_DAYS} days to unlock your Morning Brief`}
        </span>
        <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
          {Math.min(days, GOAL_DAYS)} / {GOAL_DAYS} days
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-badge)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: reached ? 'var(--good)' : 'var(--cyan)', transition: 'width .5s ease' }} />
      </div>
      <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: '10px 0 0' }}>
        {reached ? (
          <>Every morning AIBOS now sums up your day. <Link href="/dashboard/brief" style={{ color: 'var(--good)', fontWeight: 600 }}>See it →</Link>{' '}
            <button type="button" onClick={() => { try { window.localStorage.setItem(DISMISS_KEY, '1'); } catch { /* */ } setDone(true); }}
              style={{ background: 'none', border: 'none', color: 'var(--text-4)', cursor: 'pointer', textDecoration: 'underline', fontSize: 'var(--fs-label)' }}>dismiss</button>
          </>
        ) : (
          <>Record a sale or expense on {GOAL_DAYS} different days — that&apos;s enough for AIBOS to spot your first patterns. <Link href="/dashboard/record" style={{ color: 'var(--cyan)', fontWeight: 600 }}>Record now →</Link></>
        )}
      </p>
    </div>
  );
}
