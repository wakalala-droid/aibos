'use client';

// CashForecastFan — P10/P50/P90 cash bands from recorded history (audit #19).
// Honest uncertainty instead of a single line: the cautious path, the middle
// path, the optimistic one, with the assumptions spelled out. Silent under
// 4 completed months (the backend's honesty gate).

import { useEffect, useState } from 'react';
import { authHeaders } from '@/lib/api';
import { useStore } from '@/lib/store';
import { fmt, formatAxis } from '@/lib/utils';
import { Wallet } from 'lucide-react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import BentoCard from '@/components/ui/BentoCard';
import ChartKey from '@/components/ui/ChartKey';
import ChartTooltip from '@/components/ui/ChartTooltip';
import { BAD, signTone } from '@/lib/tone';

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

  // A real fan (second bento pass, 5 Oct 2026): the likely path as the brand
  // line, the cautious-to-hopeful range shaded around it, starting from today.
  const now = fc.cash_now ?? 0;
  const data = [
    { label: 'Now', likely: now, cautious: now, hopeful: now, range: [now, now] as [number, number] },
    ...fc.bands.map((b) => ({ label: monthLabel(b.month_ahead), likely: b.p50, cautious: b.p10, hopeful: b.p90, range: [b.p10, b.p90] as [number, number] })),
  ];
  const dips = fc.bands.some((b) => b.p10 <= 0);

  return (
    <div className="bento-grid" style={{ marginBottom: 20 }}>
    <BentoCard
      className="span-6"
      icon={<Wallet />}
      title="Cash ahead"
      tag="Three paths"
      text={`From your ${fc.baseline_months} full months of recorded money in and out. Today you hold ${fmt(now, true, sym)}.`}
    >
      <div style={{ marginTop: 16 }}>
        <ChartKey items={[['var(--chart-line)', 'Most likely'], ['color-mix(in srgb, var(--chart-line) 30%, transparent)', 'Cautious to hopeful'], ['var(--text-3)', 'Cautious', true]]} />
      </div>
      <div role="img" aria-label={`Cash over the next ${fc.bands.length} months: most likely ${fmt(fc.bands[fc.bands.length - 1].p50, true, sym)}`} style={{ marginTop: 12 }}>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 18, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} tickMargin={10} padding={{ left: 12 }} />
            <YAxis width={84} tick={{ fontSize: 18, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatAxis(Number(v))} />
            <Tooltip content={<ChartTooltip sym={sym} />} cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }} />
            {dips && <ReferenceLine y={0} stroke="var(--red)" strokeDasharray="4 4" strokeWidth={1} />}
            <Area dataKey="range" stroke="none" fill="var(--chart-line)" fillOpacity={0.16} isAnimationActive={false} name="Range" legendType="none" />
            <Line dataKey="cautious" stroke="var(--text-3)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} name="Cautious" />
            <Line dataKey="likely" stroke="var(--chart-line)" strokeWidth={2.5} dot={{ r: 3.5, fill: 'var(--chart-line)', strokeWidth: 0 }} isAnimationActive={false} name="Most likely" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mini-stats" style={{ marginTop: 16 }}>
        {fc.bands.map((b) => (
          <div key={b.month_ahead} className="mini-stat">
            <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>{monthLabel(b.month_ahead)}</span>
            <span className="tnum" style={{ fontSize: 'var(--fs-h3)', fontWeight: 600, color: signTone(b.p50) }}>{fmt(b.p50, true, sym)}</span>
            <span className="tnum" style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
              <span style={{ color: b.p10 <= 0 ? BAD : undefined }}>{fmt(b.p10, true, sym)}</span> to {fmt(b.p90, true, sym)}
            </span>
          </div>
        ))}
      </div>
      {typeof fc.runway_p10_months === 'number' && (
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--red)', fontWeight: 600, margin: '16px 0 0' }}>
          On the cautious path, cash runs out in about {fc.runway_p10_months} month{fc.runway_p10_months === 1 ? '' : 's'}.
        </p>
      )}
      {fc.assumptions && (
        <p className="bento-note" style={{ marginTop: 12 }}>{fc.assumptions.join(' ')}</p>
      )}
    </BentoCard>
    </div>
  );
}
