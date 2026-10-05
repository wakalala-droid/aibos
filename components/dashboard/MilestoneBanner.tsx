'use client';

// MilestoneBanner — a genuine business win, celebrated once (audit #58).
// Derived from real recorded data (lib/milestones); dismissible on-device so
// it never nags. Silent when there's nothing real to celebrate.

import { useEffect, useMemo, useState } from 'react';
import { Trophy, Flame, TrendingUp, X } from 'lucide-react';
import { useStore } from '@/lib/store';
import { listEvents, type BusinessEvent } from '@/lib/api';
import { topMilestone } from '@/lib/milestones';

const DISMISS_KEY = 'aibos-milestone-dismissed-v1';

export default function MilestoneBanner() {
  const twin = useStore((s) => s.twin);
  const sym = useStore((s) => s.currencySymbol) || 'K';
  const [events, setEvents] = useState<BusinessEvent[]>([]);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listEvents({ limit: 500 }).then((e) => { if (alive) setEvents(e); }).catch(() => {});
    try { setDismissedId(window.localStorage.getItem(DISMISS_KEY)); } catch { /* private mode */ }
    return () => { alive = false; };
  }, []);

  const milestone = useMemo(() => topMilestone(twin, events, sym), [twin, events, sym]);

  if (!milestone || milestone.id === dismissedId) return null;

  const dismiss = () => {
    try { window.localStorage.setItem(DISMISS_KEY, milestone.id); } catch { /* private mode */ }
    setDismissedId(milestone.id);
  };

  // A bento card (5 Oct 2026): round outlined mark, the milestone as the
  // spaced-capital title, one line under it. Monochrome.
  return (
    <div role="status" className="bento" style={{ marginBottom: 16 }}>
      <div className="bento-head">
        <span className="bento-icon" aria-hidden="true">
          {milestone.icon === 'trophy' ? <Trophy /> : milestone.icon === 'streak' ? <Flame /> : <TrendingUp />}
        </span>
        <div className="bento-main">
          <div className="bento-titlerow">
            <p className="bento-title">{milestone.title}</p>
            <button type="button" aria-label="Dismiss" onClick={dismiss} className="icon-pill" style={{ marginLeft: 'auto', background: 'transparent' }}>
              <X aria-hidden="true" />
            </button>
          </div>
          <p className="bento-text">{milestone.detail}</p>
        </div>
      </div>
    </div>
  );
}
