'use client';

// WhatChanged — anomaly auto-investigation (audit #13): the worst recent
// month explained from the owner's OWN events before they ask. Deterministic
// facts from /investigate; silent when there's no anomaly or not enough
// history (the honest floor is 4 recorded months).

import { useEffect, useState } from 'react';
import { authHeaders } from '@/lib/api';
import { useStore } from '@/lib/store';
import { fmt } from '@/lib/utils';
import SectionCard from '@/components/ui/SectionCard';

interface Driver {
  label: string;
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

  return (
    <SectionCard
      title="What changed"
      subtitle={`${inv.month} vs your ${inv.baseline_months?.length ?? 0}-month baseline — from your recorded events`}
      style={{ marginBottom: 20 }}
    >
      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-1)', fontWeight: 600, margin: '0 0 12px' }}>
        {inv.summary}
      </p>
      <div style={{ display: 'grid', gap: 8 }}>
        {inv.drivers.slice(0, 4).map((d) => {
          const up = d.delta > 0;
          const bad = (d.direction === 'out') === up; // more spend / less income = bad
          const colour = bad ? 'var(--crit)' : 'var(--good)';
          return (
            <div key={`${d.direction}-${d.label}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-1)' }}>{d.label}</span>
                <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', marginLeft: 8 }}>
                  {d.count} event{d.count === 1 ? '' : 's'}
                  {d.baseline_avg > 0 && ` · usually ${fmt(d.baseline_avg, true, sym)}`}
                  {d.baseline_avg === 0 && ' · new this month'}
                </span>
              </span>
              <span style={{ fontSize: 'var(--fs-data)', fontWeight: 700, color: colour, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                {up ? '+' : '−'}{fmt(Math.abs(d.delta), true, sym)}
                {d.pct_change !== null && ` (${up ? '+' : ''}${d.pct_change.toFixed(0)}%)`}
              </span>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
