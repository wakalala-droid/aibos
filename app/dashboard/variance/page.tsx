'use client';
import { useStore } from '@/lib/store';
import { monthName, monthTick } from '@/lib/change';
import { fmt, formatAxis } from '@/lib/utils';
import KPICard from '@/components/ui/KPICard';
import SectionCard from '@/components/ui/SectionCard';
import ChartTooltip from '@/components/ui/ChartTooltip';
import FeatureGate from '@/components/ui/FeatureGate';
import TimeSeriesUnavailable from '@/components/ui/TimeSeriesUnavailable';
import { TriangleAlert } from 'lucide-react';
import ChartKey from '@/components/ui/ChartKey';
import { BAD, INK, severityWord, signTone, trendTone } from '@/lib/tone';
import PageHeader from '@/components/ui/PageHeader';
import BudgetCard from '@/components/dashboard/BudgetCard';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';

// A cost rise counts as the wrong way past 5% on the month before: small
// wobbles are normal, so they stay ink.
const costWentWrong = (pct: number) => pct > 5;

export default function VariancePage() {
  const { monthly, alerts, kpi, currencySymbol, dataShape } = useStore();
  const sym = currencySymbol || 'K';

  if (dataShape === 'cross_sectional') {
    return <TimeSeriesUnavailable title="Month by month" feature="Variance analysis" />;
  }

  // ── Null-safe derived metrics ─────────────────────────────────────────────
  const months = Math.max(monthly.length, 1);

  // Month-over-month variance computation from monthly[]
  const variances = monthly.map((m, i) => {
    const rev  = Number(m.Revenue) || 0;
    const cost = Number(m.Costs)   || 0;
    const profit = rev - cost;

    const prev = monthly[i - 1];
    const prevRev    = prev ? (Number(prev.Revenue) || 0) : rev;
    const prevCost   = prev ? (Number(prev.Costs)   || 0) : cost;
    const prevProfit = prevRev - prevCost;

    const revChangePct    = prevRev    > 0 ? ((rev    - prevRev)    / prevRev    * 100) : 0;
    const costChangePct   = prevCost   > 0 ? ((cost   - prevCost)   / prevCost   * 100) : 0;
    const profitChangePct = prevProfit !== 0 ? ((profit - prevProfit) / Math.abs(prevProfit) * 100) : 0;

    return {
      month:        String(m.Month),
      revenue:      rev,
      cost,
      profit,
      revChange:    Math.round(revChangePct * 10) / 10,
      costChange:   Math.round(costChangePct * 10) / 10,
      profitChange: Math.round(profitChangePct * 10) / 10,
      margin:       rev > 0 ? Math.round((profit / rev) * 1000) / 10 : 0,
    };
  });

  // Aggregate stats
  const avgRevChange    = variances.length > 1
    ? variances.slice(1).reduce((s, v) => s + v.revChange,  0) / (variances.length - 1)
    : 0;
  const avgCostChange   = variances.length > 1
    ? variances.slice(1).reduce((s, v) => s + v.costChange, 0) / (variances.length - 1)
    : 0;
  const maxSpike        = variances.reduce((max, v) => Math.abs(v.costChange) > Math.abs(max.costChange) ? v : max, variances[0] ?? { costChange: 0, month: 'None' });
  const criticalAlerts  = (alerts ?? []).filter((a: any) => a.severity === 'critical' || a.severity === 'warning');

  // Chart data — revenue vs costs with variance bars
  const chartData = variances.map(v => ({
    month:     v.month,
    Revenue:   v.revenue,
    Costs:     v.cost,
    RevChange: v.revChange,
    CostChange: v.costChange,
  }));

  return (
    <FeatureGate
      feature="variance"
      title="Month by month"
      colour="var(--cyan)"
      headline={variances.length > 1
        ? `Your biggest swing was ${monthName(maxSpike.month)}, when costs moved ${maxSpike.costChange >= 0 ? '+' : ''}${maxSpike.costChange}% on the month before.`
        : 'Record at least two months to see how each month changed.'}
      detail="See how sales and costs moved each month, the months that broke your pattern and which costs drove each swing."
    >
    <>
      <PageHeader
        eyebrow="Reports"
        eyebrowColour="var(--cyan)"
        title="Month by month"
        subtitle="How sales, costs and profit changed each month, and which costs jumped."
      />

      {/* Plan vs actual (audit #37) — variance against intent, not just
          against last month. Silent before migration 0024 is run. */}
      <BudgetCard />

      {/* KPI cards: ink figures; a badge turns red only when the change went
          the wrong way (sales down, costs up). */}
      <div className="grid-kpi" style={{ marginBottom: 24 }}>
        <KPICard
          label="Sales, average change" value={`${avgRevChange >= 0 ? '+' : ''}${avgRevChange.toFixed(1)}%`}
          sub="month to month"
          growth={avgRevChange}
          sparkData={variances.map(v => v.revChange)}
        />
        <KPICard
          label="Costs, average change" value={`${avgCostChange >= 0 ? '+' : ''}${avgCostChange.toFixed(1)}%`}
          sub="month to month"
          growth={avgCostChange} goodWhenUp={false}
          sparkData={variances.map(v => v.costChange)}
        />
        <KPICard
          label="Worth checking" value={String(criticalAlerts.length)}
          sub="costs or months out of line"
        />
        <KPICard
          label="Biggest cost jump" value={`${maxSpike?.costChange >= 0 ? '+' : ''}${(maxSpike?.costChange ?? 0).toFixed(1)}%`}
          sub={`in ${maxSpike?.month && maxSpike.month !== 'None' ? monthName(maxSpike.month) : 'no month yet'}`}
          sparkData={variances.map(v => Math.abs(v.costChange))}
        />
      </div>

      {/* Sales against costs: sales in the brand line, costs in grey. */}
      {chartData.length > 0 && (
        <SectionCard title="Sales against costs" subtitle="Each month this year" delay={0.1} style={{ marginBottom: 20 }}
          action={<ChartKey items={[['var(--chart-line)', 'Sales'], ['var(--chart-muted)', 'Costs']]} />}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} barCategoryGap="22%" barGap={6}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis tickMargin={8} minTickGap={16} dataKey="month" tickFormatter={monthTick} tick={{ fontSize: 13, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
              <YAxis width={84} tick={{ fontSize: 13, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatAxis(v)} />
              <Tooltip content={<ChartTooltip sym={sym} />} cursor={{ fill: 'var(--table-row-hover)' }} />
              <Bar dataKey="Revenue" fill="var(--chart-line)" radius={[6, 6, 0, 0]} name="Sales" maxBarSize={72} />
              <Bar dataKey="Costs" fill="var(--chart-muted)" radius={[6, 6, 0, 0]} name="Costs" maxBarSize={72} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      )}

      {/* Change from the month before: a bar goes red only when it moved the
          wrong way (sales down, or costs up by more than 5%). */}
      {chartData.length > 1 && (
        <SectionCard title="Change from the month before" subtitle="Above the line is up, below is down. Red went the wrong way." delay={0.16} style={{ marginBottom: 20 }}
          action={<ChartKey items={[['var(--chart-line)', 'Sales'], ['var(--chart-muted)', 'Costs'], ['var(--red)', 'Wrong way']]} />}
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData.slice(1)} barCategoryGap="28%" barGap={6}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis tickMargin={8} minTickGap={16} dataKey="month" tickFormatter={monthTick} tick={{ fontSize: 13, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
              <YAxis width={84} tick={{ fontSize: 13, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} tickFormatter={v => `${Number(v).toFixed(0)}%`} />
              <Tooltip content={<ChartTooltip currency={false} />} cursor={{ fill: 'var(--table-row-hover)' }} />
              <ReferenceLine y={0} stroke="var(--border-strong)" strokeWidth={1} />
              <Bar dataKey="RevChange" name="Sales change, %" radius={[6, 6, 0, 0]} maxBarSize={72}>
                {chartData.slice(1).map((entry, i) => (
                  <Cell key={i} fill={entry.RevChange < 0 ? 'var(--red)' : 'var(--chart-line)'} />
                ))}
              </Bar>
              <Bar dataKey="CostChange" name="Cost change, %" radius={[6, 6, 0, 0]} maxBarSize={72}>
                {chartData.slice(1).map((entry, i) => (
                  <Cell key={i} fill={costWentWrong(entry.CostChange) ? 'var(--red)' : 'var(--chart-muted)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      )}

      {/* The table: every figure in ink; red only where a month went the
          wrong way. */}
      <SectionCard title="Month by month" subtitle="How sales, costs and profit moved each month" delay={0.22} style={{ marginBottom: 20 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Month</th><th>Sales</th><th>Sales change</th>
                <th>Costs</th><th>Cost change</th>
                <th>Profit</th><th>Kept from sales</th>
              </tr>
            </thead>
            <tbody>
              {variances.map((row, i) => (
                <tr key={row.month}>
                  <td style={{ fontWeight: 600, color: 'var(--text-1)' }}>{monthName(row.month)}</td>
                  <td className="tnum">{fmt(row.revenue, false, sym)}</td>
                  <td className="tnum" style={{ color: i === 0 ? 'var(--text-3)' : trendTone(row.revChange) }}>
                    {i === 0 ? 'First month' : `${row.revChange >= 0 ? '+' : ''}${row.revChange.toFixed(1)}%`}
                  </td>
                  <td className="tnum">{fmt(row.cost, false, sym)}</td>
                  <td className="tnum" style={{ color: i === 0 ? 'var(--text-3)' : costWentWrong(row.costChange) ? BAD : INK }}>
                    {i === 0 ? 'First month' : `${row.costChange >= 0 ? '+' : ''}${row.costChange.toFixed(1)}%`}
                  </td>
                  <td className="tnum" style={{ color: signTone(row.profit), fontWeight: 600 }}>{fmt(row.profit, false, sym)}</td>
                  <td className="tnum" style={{ color: signTone(row.margin) }}>{row.margin.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Worth checking: plain rows, red only for the ones that cannot wait. */}
      {alerts.length > 0 && (
        <SectionCard title="Worth checking" subtitle="Costs or months out of line" delay={0.28}>
          <div>
            {alerts.slice(0, 8).map((alert: any, i: number) => {
              const sev = severityWord(alert.severity);
              return (
                <div key={alert.id ?? i} className="row" style={{ alignItems: 'flex-start' }}>
                  <span className="bento-icon" aria-hidden="true" style={sev.bad ? { color: 'var(--red)' } : undefined}>
                    <TriangleAlert />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>{alert.title}</p>
                    <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: '2px 0 0', lineHeight: 1.6 }}>{alert.description}</p>
                  </div>
                  <span className="bento-tag" style={sev.bad ? { color: 'var(--red)', borderColor: 'color-mix(in srgb, var(--red) 35%, transparent)' } : undefined}>
                    {sev.word}
                  </span>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}
    </>
    </FeatureGate>
  );
}
