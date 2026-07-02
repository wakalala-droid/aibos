'use client';
import { useStore } from '@/lib/store';
import { fmt, formatAxis } from '@/lib/utils';
import KPICard from '@/components/ui/KPICard';
import SectionCard from '@/components/ui/SectionCard';
import ChartTooltip from '@/components/ui/ChartTooltip';
import FeatureGate from '@/components/ui/FeatureGate';
import TimeSeriesUnavailable from '@/components/ui/TimeSeriesUnavailable';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';

export default function VariancePage() {
  const { monthly, alerts, kpi, currencySymbol, dataShape } = useStore();
  const sym = currencySymbol || 'K';

  if (dataShape === 'cross_sectional') {
    return <TimeSeriesUnavailable title="Variance Analysis" feature="Variance analysis" />;
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
      month:         String(m.Month),
      revenue:       rev,
      cost,
      profit,
      revChange:     Math.round(revChangePct * 10) / 10,
      costChange:    Math.round(costChangePct * 10) / 10,
      profitChange:  Math.round(profitChangePct * 10) / 10,
      margin:        rev > 0 ? Math.round((profit / rev) * 1000) / 10 : 0,
    };
  });

  // Aggregate stats
  const avgRevChange    = variances.length > 1
    ? variances.slice(1).reduce((s, v) => s + v.revChange,  0) / (variances.length - 1)
    : 0;
  const avgCostChange   = variances.length > 1
    ? variances.slice(1).reduce((s, v) => s + v.costChange, 0) / (variances.length - 1)
    : 0;
  const maxSpike        = variances.reduce((max, v) => Math.abs(v.costChange) > Math.abs(max.costChange) ? v : max, variances[0] ?? { costChange: 0, month: '—' });
  const criticalAlerts  = (alerts ?? []).filter((a: any) => a.severity === 'critical' || a.severity === 'warning');

  // Chart data — revenue vs costs with variance bars
  const chartData = variances.map(v => ({
    month:      v.month,
    Revenue:    v.revenue,
    Costs:      v.cost,
    RevChange:  v.revChange,
    CostChange: v.costChange,
  }));

  return (
    <FeatureGate
      feature="variance"
      title="Variance Analysis"
      colour="var(--cyan)"
      headline={variances.length > 1
        ? `Your biggest swing was ${maxSpike.month}, with costs moving ${maxSpike.costChange >= 0 ? '+' : ''}${maxSpike.costChange}% month-over-month.`
        : 'Upload at least two months to see month-over-month variance.'}
      detail="See month-by-month revenue and cost variance, the months that broke pattern, and which line items drove every swing."
    >
    <>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.68rem', color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }}>
          Financial Intelligence
        </p>
        <h1 style={{ fontFamily: 'Geist, sans-serif', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.03em' }}>
          Variance Analysis
        </h1>
        <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.7rem', color: 'var(--text-3)', margin: '4px 0 0' }}>
          Month-over-month changes · cost spikes · margin trends
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid-kpi" style={{ marginBottom: 24 }}>
        <KPICard
          label="AVG REVENUE CHANGE" value={`${avgRevChange >= 0 ? '+' : ''}${avgRevChange.toFixed(1)}%`}
          sub="month-over-month avg"
          growth={avgRevChange}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 18l5-5 4 3 5-7 4 3" stroke="var(--good)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          iconBg="rgba(52,211,153,0.15)"
          sparkData={variances.map(v => v.revChange)}
          sparkColor="var(--good)" delay={0}
        />
        <KPICard
          label="AVG COST CHANGE" value={`${avgCostChange >= 0 ? '+' : ''}${avgCostChange.toFixed(1)}%`}
          sub="month-over-month avg"
          growth={-avgCostChange}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M2 8h20v10a2 2 0 01-2 2H4a2 2 0 01-2-2V8z" stroke="var(--e2)" strokeWidth="1.5" fill="none"/><path d="M2 8l2-4h16l2 4" stroke="var(--e2)" strokeWidth="1.4" strokeLinejoin="round"/></svg>}
          iconBg="rgba(249,115,22,0.15)"
          sparkData={variances.map(v => v.costChange)}
          sparkColor="var(--e2)" delay={0.06}
        />
        <KPICard
          label="ACTIVE ALERTS" value={String(criticalAlerts.length)}
          sub="variance & anomaly flags"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 3L2 20h20L12 3z" stroke="var(--warn)" strokeWidth="1.5" strokeLinejoin="round" fill="none"/><path d="M12 10v4M12 17v.5" stroke="var(--warn)" strokeWidth="1.5" strokeLinecap="round"/></svg>}
          iconBg="rgba(251,191,36,0.15)"
          sparkColor="var(--warn)" delay={0.12}
        />
        <KPICard
          label="LARGEST COST SPIKE" value={`${maxSpike?.costChange >= 0 ? '+' : ''}${(maxSpike?.costChange ?? 0).toFixed(1)}%`}
          sub={`in ${maxSpike?.month ?? '—'}`}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="var(--crit)" strokeWidth="1.5" fill="none"/><path d="M12 8v5M12 16v.5" stroke="var(--crit)" strokeWidth="1.5" strokeLinecap="round"/></svg>}
          iconBg="rgba(239,68,68,0.15)"
          sparkData={variances.map(v => Math.abs(v.costChange))}
          sparkColor="var(--crit)" delay={0.18}
        />
      </div>

      {/* Revenue vs Costs chart */}
      {chartData.length > 0 && (
        <SectionCard title="Revenue vs Costs" subtitle="Monthly performance · FY" delay={0.1} style={{ marginBottom: 20 }}
          action={
            <div style={{ display: 'flex', gap: 14 }}>
              {[['var(--cyan)', 'Revenue'], ['var(--e2)', 'Costs']].map(([c, l]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: c as string, opacity: 0.8 }} />
                  <span style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.68rem', color: 'var(--text-4)' }}>{l}</span>
                </div>
              ))}
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barCategoryGap="22%" barGap={4}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontFamily: 'Geist, sans-serif', fontSize: 10, fill: 'var(--text-4)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontFamily: 'Geist, sans-serif', fontSize: 10, fill: 'var(--text-4)' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatAxis(v)} />
              <Tooltip content={<ChartTooltip sym={sym} />} cursor={{ fill: 'var(--table-row-hover)' }} />
              <Bar dataKey="Revenue" fill="var(--cyan)"  fillOpacity={0.75} radius={[4,4,0,0]} name="Revenue" />
              <Bar dataKey="Costs"   fill="var(--e2)"    fillOpacity={0.75} radius={[4,4,0,0]} name="Costs"   />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      )}

      {/* Month-over-month change chart */}
      {chartData.length > 1 && (
        <SectionCard title="Month-over-Month Change %" subtitle="Revenue and cost variance · positive = growth" delay={0.16} style={{ marginBottom: 20 }}>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData.slice(1)} barCategoryGap="28%" barGap={4}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontFamily: 'Geist, sans-serif', fontSize: 10, fill: 'var(--text-4)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontFamily: 'Geist, sans-serif', fontSize: 10, fill: 'var(--text-4)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v.toFixed(0)}%`} />
              <Tooltip content={<ChartTooltip currency={false} />} cursor={{ fill: 'var(--table-row-hover)' }} />
              <ReferenceLine y={0} stroke="var(--border-md)" strokeWidth={1} />
              <Bar dataKey="RevChange"  name="Revenue Δ" radius={[3,3,0,0]}>
                {chartData.slice(1).map((entry, i) => (
                  <Cell key={i} fill={entry.RevChange >= 0 ? 'var(--good)' : 'var(--crit)'} fillOpacity={0.8} />
                ))}
              </Bar>
              <Bar dataKey="CostChange" name="Cost Δ" radius={[3,3,0,0]}>
                {chartData.slice(1).map((entry, i) => (
                  <Cell key={i} fill={entry.CostChange <= 5 ? 'var(--blue)' : 'var(--warn)'} fillOpacity={0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      )}

      {/* Variance table */}
      <SectionCard title="Variance Detail" subtitle="Month-by-month revenue, cost and profit changes" delay={0.22} style={{ marginBottom: 20 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Month</th><th>Revenue</th><th>Rev Δ</th>
                <th>Costs</th><th>Cost Δ</th>
                <th>Profit</th><th>Margin</th>
              </tr>
            </thead>
            <tbody>
              {variances.map((row, i) => (
                <motion.tr key={row.month} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.28 + i * 0.04 }}>
                  <td style={{ fontWeight: 700, color: 'var(--text-1)' }}>{row.month}</td>
                  <td>{fmt(row.revenue, false, sym)}</td>
                  <td style={{ color: row.revChange >= 0 ? 'var(--good)' : 'var(--crit)', fontWeight: 600 }}>
                    {i === 0 ? '—' : `${row.revChange >= 0 ? '+' : ''}${row.revChange.toFixed(1)}%`}
                  </td>
                  <td>{fmt(row.cost, false, sym)}</td>
                  <td style={{ color: row.costChange > 10 ? 'var(--warn)' : row.costChange > 0 ? 'var(--text-3)' : 'var(--good)', fontWeight: 600 }}>
                    {i === 0 ? '—' : `${row.costChange >= 0 ? '+' : ''}${row.costChange.toFixed(1)}%`}
                  </td>
                  <td style={{ color: row.profit >= 0 ? 'var(--good)' : 'var(--crit)', fontWeight: 700 }}>{fmt(row.profit, false, sym)}</td>
                  <td style={{ color: row.margin >= 20 ? 'var(--good)' : row.margin >= 10 ? 'var(--warn)' : 'var(--crit)' }}>
                    {row.margin.toFixed(1)}%
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Active alerts */}
      {alerts.length > 0 && (
        <SectionCard title="Active Alerts" subtitle="Variance & anomaly flags" delay={0.28}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alerts.slice(0, 8).map((alert: any, i: number) => {
              const sevColor = alert.severity === 'critical' ? 'var(--crit)' : alert.severity === 'warning' ? 'var(--warn)' : 'var(--info)';
              return (
                <motion.div key={alert.id ?? i}
                  initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.34 + i * 0.04 }}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderRadius: 8, background: 'var(--bg-badge)', border: '1px solid var(--border)' }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: sevColor, flexShrink: 0, marginTop: 4 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-1)', margin: '0 0 3px' }}>{alert.title}</p>
                    <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.68rem', color: 'var(--text-3)', margin: 0 }}>{alert.description}</p>
                  </div>
                  <span className="badge" style={{ color: sevColor, background: `color-mix(in srgb, ${sevColor} 12%, transparent)`, borderColor: `color-mix(in srgb, ${sevColor} 28%, transparent)`, flexShrink: 0 }}>
                    {(alert.severity ?? 'info').toUpperCase()}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </SectionCard>
      )}
    </>
    </FeatureGate>
  );
}
