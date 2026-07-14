'use client';

// CashForecastFan — P10/P50/P90 cash bands from recorded history (audit #19).
// Honest uncertainty instead of a single line: the cautious path, the middle
// path, the optimistic one, with the assumptions spelled out. Silent under
// 4 completed months (the backend's honesty gate).

import { useEffect, useState } from 'react';
import { authHeaders } from '@/lib/api';
import { useStore } from '@/lib/store';
import { fmt } from '@/lib/utils';
import SectionCard from '@/components/ui/SectionCard';

interface Band { month_ahead: number; p10: number; p50: number; p90: number }
interface Forecast {
  ok: boolean;
  reason?: string;
  cash_now?: number;
  baseline_months?: number;
  bands?: Band[];
  runway_p10_months?: number | null;
  assumptions?: string[];
}

export default function CashForecastFan() {
  const sym = useStore((s) => s.currencySymbol) || 'K';
  const [fc, setFc] = useState<Forecast | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/proxy/forecast/cash', { headers: await authHeaders() });
        const data = await res.json();
        if (alive && res.ok) setFc(data.forecast as Forecast);
      } catch { /* silent — the classic forecast below stands on its own */ }
    })();
    return () => { alive = false; };
  }, []);

  if (!fc?.ok || !fc.bands?.length) return null;

  const monthLabel = (h: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + h);
    return d.toLocaleDateString(undefined, { month: 'short' });
  };

  return (
    <SectionCard
      title="Cash — the honest fan"
      subtitle={`From your ${fc.baseline_months} completed months of recorded cashflow · today: ${fmt(fc.cash_now ?? 0, true, sym)}`}
      style={{ marginBottom: 20 }}
    >
      <div style={{ display: 'grid', gap: 8 }}>
        {fc.bands.map((b) => {
          const worried = b.p10 <= 0;
          return (
            <div key={b.month_ahead} style={{ display: 'grid', gridTemplateColumns: '56px 1fr 1fr 1fr', gap: 10, alignItems: 'baseline', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 'var(--fs-label)', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' }}>{monthLabel(b.month_ahead)}</span>
              <span style={{ fontSize: 'var(--fs-data)', color: worried ? 'var(--crit)' : 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ fontSize: 'var(--fs-label)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>cautious </span>{fmt(b.p10, true, sym)}
              </span>
              <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>{fmt(b.p50, true, sym)}</span>
              <span style={{ fontSize: 'var(--fs-data)', color: 'var(--good)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                <span style={{ fontSize: 'var(--fs-label)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>upside </span>{fmt(b.p90, true, sym)}
              </span>
            </div>
          );
        })}
      </div>
      {typeof fc.runway_p10_months === 'number' && (
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--crit)', fontWeight: 600, margin: '12px 0 0' }}>
          On the cautious path, cash crosses zero in about {fc.runway_p10_months} month{fc.runway_p10_months === 1 ? '' : 's'}.
        </p>
      )}
      {fc.assumptions && (
        <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', fontStyle: 'italic', margin: '10px 0 0' }}>
          {fc.assumptions.join(' ')}
        </p>
      )}
    </SectionCard>
  );
}
