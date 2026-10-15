'use client';

// Forecast (rebuilt on the forecast engine, 16 October 2026).
//
// Sales, costs and profit for this month and the three after it, each with
// its cautious and hopeful ends, from aibos-api forecast_engine.py: several
// methods tested on the owner's own months, the best blended, one-off months
// softened, seasons used once two years are in. This month is judged on what
// is in so far against how a month usually fills up.
//
// It replaces a straight line fitted in the browser whose "How sure" figure
// was the line's fit to the past (R squared), not how often it had been right:
// a line can fit well and still miss every month. "How accurate" here is the
// forecast's real average miss on the owner's past months, beside what simply
// repeating last month would have missed.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { useStore } from '@/lib/store';
import { monthName, monthTick } from '@/lib/change';
import { fmt, formatAxis } from '@/lib/utils';
import Stat from '@/components/ui/Stat';
import Panel from '@/components/home/Panel';
import BentoCard from '@/components/ui/BentoCard';
import ChartKey from '@/components/ui/ChartKey';
import ChartTooltip from '@/components/ui/ChartTooltip';
import FeatureGate from '@/components/ui/FeatureGate';
import TimeSeriesUnavailable from '@/components/ui/TimeSeriesUnavailable';
import PageHeader from '@/components/ui/PageHeader';
import CashForecastFan from '@/components/dashboard/CashForecastFan';
import { getOutlook, getSeriesOutlook, type Outlook } from '@/lib/api';
import { canAccess } from '@/lib/tiers';
import { signTone, trendTone } from '@/lib/tone';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

export default function ForecastPage() {
  const { monthly, currencySymbol, dataShape, twin, uploadedFile, twinLoading, twinChecked, tier } = useStore();
  const version = useStore((s) => s.booksVersion);
  const sym = currencySymbol || 'K';
  const fromBooks = !uploadedFile && !!twin && Number(twin.event_count) > 0;
  const waiting = twinLoading || (!twinChecked && !uploadedFile);
  const [outlook, setOutlook] = useState<Outlook | null>(null);
  const [failed, setFailed] = useState(false);

  // An uploaded file's periods, as they were read.
  const fileRows = useMemo(() => (Array.isArray(monthly) ? monthly : []).map((m) => {
    const r = m as unknown as Record<string, unknown>;
    return { month: String(r.Month ?? r.month ?? ''), revenue: n(r.Revenue ?? r.revenue), costs: n(r.Costs ?? r.costs) };
  }), [monthly]);

  useEffect(() => {
    if (waiting || dataShape === 'cross_sectional') return;
    let alive = true;
    const read = fromBooks ? getOutlook() : fileRows.length ? getSeriesOutlook(fileRows) : null;
    if (!read) { setOutlook(null); return; }
    setFailed(false);
    read.then((o) => { if (alive) setOutlook(o); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [fromBooks, fileRows, waiting, dataShape, version]);

  if (dataShape === 'cross_sectional') {
    return <TimeSeriesUnavailable title="Forecast" feature="Forecasting" />;
  }

  const ok = !!outlook?.ok;
  const ahead = outlook?.ahead ?? [];
  const now = outlook?.this_month ?? null;
  // From the recorded books the first month ahead is this one; the rest follow.
  const later = now ? ahead.slice(1) : ahead;
  const next = later[0];
  const threeTotal = later.slice(0, 3).reduce((t, a) => t + a.revenue.p50, 0);
  const acc = outlook?.accuracy;
  const lastActual = outlook?.history?.length ? outlook.history[outlook.history.length - 1].revenue : 0;
  const change = next && lastActual > 0 ? ((next.revenue.p50 - lastActual) / lastActual) * 100 : 0;

  // The last twelve months as recorded, then the months ahead; the likely line
  // starts from the last real month so the two join.
  const hist = (outlook?.history ?? []).slice(-12);
  const chart: { month: string; sales?: number; likely?: number; range?: [number, number] }[] = [
    ...hist.map((h, i) => ({
      month: h.month, sales: h.revenue,
      likely: i === hist.length - 1 && ahead.length ? h.revenue : undefined,
    })),
    ...ahead.map((a) => ({ month: a.month, likely: a.revenue.p50, range: [a.revenue.p10, a.revenue.p90] as [number, number] })),
  ];

  const headline = !ok
    ? (outlook?.reason || 'Record your sales and costs and your forecast appears here.')
    : now
      ? `This month is on pace for ${fmt(now.revenue.estimate, true, sym)}; ${next ? `${monthName(next.month)} looks like ${fmt(next.revenue.p50, true, sym)}` : ''}.`
      : `Your next period looks like ${fmt(next?.revenue.p50 ?? 0, true, sym)}.`;

  return (
    <FeatureGate
      feature="forecast"
      title="Forecast"
      colour="var(--cyan)"
      headline={headline}
      detail="Sales, costs and profit for the months ahead with the range they should fall in, this month's pace, and how accurate the forecast has been on your own months."
    >
      <PageHeader
        title="Forecast"
        subtitle="What your sales, costs and profit are likely to be, with the range they should fall in."
        actions={canAccess(tier, 'cash_plan')
          ? <Link className="pill" href="/dashboard/cash-plan">13-week cash plan</Link>
          : <Link className="pill pill-quiet" href="/dashboard/cash-plan">Cash plan with Growth</Link>}
      />

      {/* P10/P50/P90 cash months from recorded money (audit #19), silent under 4 months. */}
      {fromBooks && <CashForecastFan />}

      {failed && <p className="rs-text is-quiet">The forecast could not be worked out just now. Try again in a moment.</p>}
      {!outlook && !failed && <div className="skeleton" style={{ height: 240, borderRadius: 'var(--radius-lg)' }} />}

      {outlook && !ok && (
        <Panel title="Not enough history yet">
          <p className="rs-text">{outlook.reason}</p>
        </Panel>
      )}

      {ok && (
        <>
          <div className="grid-kpi" style={{ marginBottom: 20 }}>
            {now ? (
              <Stat label={`${monthName(now.month)}, on pace for`} money={now.revenue.estimate} sym={sym}
                sub={`${fmt(now.revenue.so_far, true, sym)} in so far${now.revenue.pace_pct != null
                  ? `, ${Math.abs(Math.round(now.revenue.pace_pct))}% ${now.revenue.pace_pct >= 0 ? 'ahead of' : 'behind'} the usual pace` : ''}`}
                tone={now.revenue.pace_pct != null && now.revenue.pace_pct < -10 ? 'bad' : undefined} />
            ) : (
              <Stat label="Last period" money={lastActual} sym={sym} sub="As recorded" />
            )}
            {next && (
              <Stat label={`${monthName(next.month)}, likely`} money={next.revenue.p50} sym={sym}
                sub={`${fmt(next.revenue.p10, true, sym)} to ${fmt(next.revenue.p90, true, sym)}`}
                tone={change < -5 ? 'bad' : undefined} />
            )}
            <Stat label={`Next ${Math.min(3, later.length)} months`} money={threeTotal} sym={sym} sub="Expected sales, added up" />
            <Stat label="How accurate" text={acc?.avg_miss_pct != null ? `${acc.avg_miss_pct}%` : 'New'}
              sub={acc?.avg_miss_pct != null
                ? `Average miss on your last ${acc.tested} months${acc.naive_miss_pct != null ? ` (repeating last month: ${acc.naive_miss_pct}%)` : ''}`
                : 'Tested as your months come in'} />
          </div>

          <Panel title="Sales ahead">
            <ChartKey items={[['var(--chart-line)', 'So far'], ['var(--chart-line)', 'Likely', true],
              ['color-mix(in srgb, var(--chart-line) 30%, transparent)', 'Cautious to hopeful']]} />
            <div role="img" style={{ marginTop: 12 }}
              aria-label={`Sales so far and the next months: ${ahead.map((a) => `${monthName(a.month)} ${fmt(a.revenue.p50, true, sym)}`).join(', ')}`}>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={monthTick} minTickGap={16} tick={{ fontSize: 13, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} tickMargin={8} />
                  <YAxis width={84} tick={{ fontSize: 13, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatAxis(n(v))} />
                  <Tooltip content={<ChartTooltip sym={sym} />} cursor={{ stroke: 'var(--border-md)', strokeWidth: 1 }} />
                  <Area dataKey="range" stroke="none" fill="var(--chart-line)" fillOpacity={0.14} isAnimationActive={false} name="Range" legendType="none" />
                  <Line dataKey="sales" stroke="var(--chart-line)" strokeWidth={2.4} dot={{ r: 3, fill: 'var(--chart-line)', strokeWidth: 0 }} isAnimationActive={false} name="So far" connectNulls={false} />
                  <Line dataKey="likely" stroke="var(--chart-line)" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3.5, fill: 'var(--bg-card)', stroke: 'var(--chart-line)', strokeWidth: 2 }} isAnimationActive={false} name="Likely" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            {outlook?.accuracy_words && <p className="bento-note" style={{ marginTop: 12 }}>{outlook.accuracy_words}</p>}
          </Panel>

          <div style={{ marginTop: 20 }}>
            <Panel title="Month by month">
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr><th>Month</th><th>Sales, likely</th><th>Sales range</th><th>Costs, likely</th><th>Profit, likely</th><th>Profit range</th></tr>
                  </thead>
                  <tbody>
                    {ahead.map((a) => (
                      <tr key={a.month}>
                        <td style={{ fontWeight: 600, color: 'var(--text-1)' }}>{monthName(a.month)}{now && a.month === now.month ? ' (so far ' + fmt(now.revenue.so_far, true, sym) + ')' : ''}</td>
                        <td style={{ fontWeight: 600, color: 'var(--text-1)' }}>{fmt(a.revenue.p50, false, sym)}</td>
                        <td style={{ color: 'var(--text-3)' }}>{fmt(a.revenue.p10, true, sym)} to {fmt(a.revenue.p90, true, sym)}</td>
                        <td style={{ color: 'var(--text-1)' }}>{fmt(a.costs.p50, false, sym)}</td>
                        <td style={{ fontWeight: 600, color: signTone(a.profit.p50) }}>{fmt(a.profit.p50, false, sym)}</td>
                        <td style={{ color: a.profit.p10 < 0 ? 'var(--red)' : 'var(--text-3)' }}>{fmt(a.profit.p10, true, sym)} to {fmt(a.profit.p90, true, sym)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          <div className="bento-grid" style={{ marginTop: 20 }}>
            <BentoCard className="span-6" icon={<ShieldCheck />} title="How AIBOS worked this out" tag="Your months only"
              text={[
                outlook?.methods?.length
                  ? `Several methods were tested on your own past months; the best ${outlook.methods.length === 1 ? 'one is' : `${outlook.methods.length} are`} blended: ${outlook.methods.map((m) => `${m.label} (${Math.round(m.weight * 100)}%)`).join(', ')}.`
                  : '',
                outlook?.softened?.length ? `One-off month${outlook.softened.length > 1 ? 's' : ''} softened so ${outlook.softened.length > 1 ? 'they do' : 'it does'} not drive the forecast: ${outlook.softened.map((m) => monthName(m)).join(', ')}.` : '',
                outlook?.seasonal ? 'Your seasons are used: two full years are recorded.' : 'No seasons are assumed until two full years are recorded.',
                outlook?.trend ? `Sales are ${outlook.trend.direction === 'steady' ? 'holding steady' : outlook.trend.direction}${outlook.trend.direction !== 'steady' ? `, about ${fmt(Math.abs(outlook.trend.revenue_per_month), true, sym)} a month` : ''}.` : '',
                'The range is where sales should land 8 times in 10, from simulating your own past surprises.',
              ].filter(Boolean).join(' ')}
              foot={next ? <span className="tnum" style={{ color: trendTone(change), fontWeight: 600 }}>{change >= 0 ? '+' : ''}{change.toFixed(1)}% next month against the last one recorded</span> : undefined}
            />
          </div>
        </>
      )}
    </FeatureGate>
  );
}
