'use client';

// WhatChanged — anomaly auto-investigation (audit #13): the worst recent
// month explained from the owner's OWN events before they ask. Deterministic
// facts from /investigate; silent when there's no anomaly or not enough
// history (the honest floor is 4 recorded months).

import { useEffect, useState } from 'react';
import { monthName } from '@/lib/change';
import Link from 'next/link';
import { authHeaders } from '@/lib/api';
import { useStore } from '@/lib/store';
import { fmt } from '@/lib/utils';
import { FileSearch } from 'lucide-react';
import BentoCard from '@/components/ui/BentoCard';
import { BAD, INK } from '@/lib/tone';

interface Driver {
  label: string;
  event_type: string;
  direction: 'in' | 'out';
  amount: number;
  baseline_avg: number;
  delta: number;
  pct_change: number | null;
  count: number;
  samples: { id: string; date: string; amount: number; note?: string | null }[];
}

interface Investigation {
  ok: boolean;
  reason?: string;
  month?: string;
  summary?: string;
  baseline_months?: string[];
  drivers?: Driver[];
}

export default function WhatChanged() {
  const sym = useStore((s) => s.currencySymbol) || 'K';
  const [inv, setInv] = useState<Investigation | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/proxy/investigate', { headers: await authHeaders() });
        const data = await res.json();
        if (alive && res.ok) setInv(data.investigation as Investigation);
      } catch { /* silent — the classic anomaly view below stands on its own */ }
    })();
    return () => { alive = false; };
  }, []);

  if (!inv?.ok || !inv.drivers?.length) return null;

  // A bento card (second bento pass, 5 Oct 2026): ink figures, red only for
  // a change that went the wrong way (more spent, or less coming in).
  return (
    <div className="bento-grid" style={{ marginBottom: 20 }}>
    <BentoCard
      className="span-6"
      icon={<FileSearch />}
      title="What changed"
      tag={monthName(inv.month)}
      motion="tilt"
      text={`Against your usual ${inv.baseline_months?.length ?? 0} months, from your own entries.`}
    >
      {inv.summary && (
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-1)', fontWeight: 600, margin: '16px 0 4px', lineHeight: 1.6 }}>
          {inv.summary}
        </p>
      )}
      <div>
        {inv.drivers.slice(0, 4).map((d) => {
          const up = d.delta > 0;
          const bad = (d.direction === 'out') === up; // more spend / less income = bad
          return (
            // Drill-through (audit #31): the events behind this driver.
            <Link key={`${d.direction}-${d.label}`} className="row-link"
              href={`/dashboard/timeline?type=${encodeURIComponent(d.event_type)}`}>
              <span className="row-main">
                <span className="row-title">{d.label}</span>
                <span className="row-sub">
                  {d.count} entr{d.count === 1 ? 'y' : 'ies'}
                  {d.baseline_avg > 0 && `, usually ${fmt(d.baseline_avg, true, sym)}`}
                  {d.baseline_avg === 0 && ', new this month'}
                </span>
              </span>
              <span className="row-amount" style={{ color: bad ? BAD : INK }}>
                {up ? '+' : '\u2212'}{fmt(Math.abs(d.delta), true, sym)}
                {/* No percentage from a tiny usual amount (UI/UX audit A11). */}
                {d.pct_change !== null && Math.abs(d.pct_change) < 200 && ` (${up ? '+' : ''}${d.pct_change.toFixed(0)}%)`}
              </span>
            </Link>
          );
        })}
      </div>
    </BentoCard>
    </div>
  );
}
