'use client';

// MilestoneBanner — a genuine business win, celebrated once (audit #58).
// Derived from real recorded data (lib/milestones); dismissible on-device so
// it never nags. Silent when there's nothing real to celebrate.

import { useEffect, useMemo, useState } from 'react';
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

  return (
    <div role="status" style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', marginBottom: 20,
      borderRadius: 12, border: '1px solid color-mix(in srgb, var(--cyan) 35%, transparent)',
      background: 'linear-gradient(120deg, color-mix(in srgb, var(--cyan) 10%, transparent), transparent)',
    }}>
      <span aria-hidden style={{ fontSize: '1.6rem', flexShrink: 0 }}>{milestone.emoji}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text-1)', margin: '0 0 2px' }}>{milestone.title}</p>
        <p style={{ fontSize: 'var(--fs-data)', color: 'var(--text-3)', margin: 0, lineHeight: 1.45 }}>{milestone.detail}</p>
      </div>
      <button type="button" aria-label="Dismiss" onClick={dismiss} className="touch-target"
        style={{ flexShrink: 0, width: 32, minHeight: 32, borderRadius: 8, border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer', fontSize: 'var(--fs-body)' }}>
        ×
      </button>
    </div>
  );
}
