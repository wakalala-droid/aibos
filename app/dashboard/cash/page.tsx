'use client';
import { useStore } from '@/lib/store';
import { fmt, formatAxis } from '@/lib/utils';
import KPICard from '@/components/ui/KPICard';
import SectionCard from '@/components/ui/SectionCard';
import ChartTooltip from '@/components/ui/ChartTooltip';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

export default function CashPage() {
  const { cashflow, monthly, kpi, currencySymbol } = useStore();
  const sym = currencySymbol || 'K';

  // ── Null-safe: derive values from real data ──────────────────────────────
  const months      = Math.max(monthly.length, 1);
  const monthlyBurn = kpi.totalCosts / months;
  // Cash position = cumulative operating cash (sum of monthly profit). Engine 1
  // returns this as cashflow.ending_cash; fall back to total profit. No hardcode.
  const currentCash =
    cashflow?.currentCash ??
    cashflow?.ending_cash ??
    (typeof kpi.totalProfit === 'number' ? kpi.totalProfit : 0);
  const runway      = cashflow?.runway      ?? (monthlyBurn > 0 ? Math.round(currentCash / monthlyBurn) : 0);
  const projections = cashflow?.projections ?? [];
  // Real cumulative-cash trajectory for the sparkline, when available.
  const cashSpark = (cashflow?.monthly ?? [])
    .map((m) => Number(m?.cumulative_cash) || 0)
    .filter((v) => v !== 0);

  // Build projection chart from monthly or stored projections
  const chartData = projections.length > 0
    ? projections.map((p: any, i: number) => ({
        label: `Month +${p.month_ahead ?? i + 1}`,
        cash:  Math.round(Number(p.projected_cash) || 0),
        inflow:  Math.round(Number(p.inflow)  || 0),
        outflow: Math.round(Number(p.outflow) || 0),
      }))
    : monthly.slice(-6).map((m, i) => {
        const rev  = Number(m.Revenue) || 0;
        const cost = Number(m.Costs)   || 0;
        const runningCash = currentCash + (rev - cost) * (i + 1);
        return {
          label:   String(m.Month),
          cash:    Math.round(Math.max(runningCash, 0)),
          inflow:  Math.round(rev),
          outflow: Math.round(cost),
        };
      });

  // Runway bar config
  const runwayTarget = 18;
  const runwayPct    = Math.min((runway / runwayTarget) * 100, 100);
  const runwayColor  = runway >= 12 ? 'var(--good)' : runway >= 6 ? 'var(--warn)' : 'var(--crit)';

  // 6-month projection total
  const projTotal = chartData.length > 0 ? chartData[chartData.length - 1].cash : currentCash;

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }}>Financial Intelligence</p>
        <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.03em' }}>Cash Intelligence</h1>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: 'var(--text-3)', margin: '4px 0 0' }}>Runway · burn rate · cash position · forward projections</p>
      </div>

      {/* KPI cards */}
      <div className="grid-kpi" style={{ marginBottom: 24 }}>
        <KPICard
          label="CASH POSITION" value={fmt(currentCash, false, sym)} sub="current balance"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="var(--cyan)" strokeWidth="1.5" fill="none"/><path d="M2 10h20" stroke="var(--cyan)" strokeWidth="1.3" strokeLinecap="round"/><circle cx="8" cy="15" r="1.5" fill="var(--cyan)"/></svg>}
          iconBg="rgba(0,212,255,0.12)"
          sparkData={cashSpark.length > 1 ? cashSpark.slice(-6) : undefined}
          sparkColor="var(--cyan)" delay={0}
        />
        <KPICard
          label="MONTHLY BURN" value={fmt(monthlyBurn, false, sym)} sub="avg monthly spend"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2c0 0-6 5-6 10a6 6 0 0012 0c0-5-6-10-6-10z" stroke="var(--e2)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 12c0 0-2 1.5-2 3a2 2 0 004 0c0-1.5-2-3-2-3z" stroke="var(--e2)" strokeWidth="1.3" fill="none"/></svg>}
          iconBg="rgba(249,115,22,0.15)"
          sparkData={monthly.slice(-6).map(m => Number(m.Costs) || 0)}
          sparkColor="var(--e2)" delay={0.06}
        />
        <KPICard
          label="CASH RUNWAY" value={`${runway}mo`} sub={`vs ${runwayTarget}mo target`}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 12h18M3 6l6 6-6 6" stroke={runwayColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          iconBg={`color-mix(in srgb, ${runwayColor} 15%, transparent)`}
          sparkColor={runwayColor} delay={0.12}
        />
        <KPICard
          label="6M PROJECTION" value={fmt(projTotal, false, sym)} sub="projected cash position"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M2 12l4-4 4 4 4-6 4 4" stroke="var(--purple)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>}
          iconBg="rgba(167,139,250,0.15)"
          sparkData={chartData.slice(-6).map(d => d.cash)}
          sparkColor="var(--purple)" delay={0.18}
        />
      </div>

      {/* Runway status bar */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        style={{ background: 'var(--bg-card)', border: `1px solid var(--border)`, borderRadius: 12, padding: '20px 24px', marginBottom: 20, boxShadow: 'var(--shadow-card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1rem', fontWeight: 700, color: 'var(--text-1)', margin: '0 0 2px' }}>Cash Runway Status</p>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'var(--text-4)', margin: 0 }}>
              {runway}mo remaining · {runway < runwayTarget ? `⚠ Below ${runwayTarget}mo target` : `✓ Above ${runwayTarget}mo target`}
            </p>
          </div>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.5rem', fontWeight: 800, color: runwayColor }}>
            {runway}mo <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: 'var(--text-4)', fontWeight: 400 }}>/ {runwayTarget}mo</span>
          </span>
        </div>
        {/* Runway bar */}
        <div style={{ position: 'relative', height: 8, borderRadius: 8, background: 'var(--border)', overflow: 'hidden', marginBottom: 10 }}>
          <motion.div style={{ height: '100%', background: runwayColor, borderRadius: 8 }}
            initial={{ width: 0 }} animate={{ width: `${runwayPct}%` }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }} />
          {/* Target marker */}
          <div style={{ position: 'absolute', left: `${Math.min((12 / runwayTarget) * 100, 98)}%`, top: 0, bottom: 0, width: 2, background: 'var(--text-4)', opacity: 0.5 }} />
        </div>
        {/* Scale labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {[0, 6, 12, 18, 24].map(mo => (
            <span key={mo} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: mo === 12 ? 'var(--warn)' : 'var(--text-4)' }}>
              {mo}mo{mo === 12 ? ' ⚑' : ''}
            </span>
          ))}
        </div>
      </motion.div>

      {/* Projected cash chart */}
      {chartData.length > 0 && (
        <SectionCard title="Projected Cash Position" subtitle="Forward projection based on current trajectory" delay={0.16} style={{ marginBottom: 20 }}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--cyan)" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="var(--cyan)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fill: 'var(--text-4)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fill: 'var(--text-4)' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatAxis(v)} />
              <Tooltip content={<ChartTooltip sym={sym} />} cursor={{ stroke: 'var(--border-md)', strokeWidth: 1 }} />
              <Area type="monotone" dataKey="cash" stroke="var(--cyan)" strokeWidth={2} fill="url(#cashGrad)" dot={false} name="Cash Position" />
              <ReferenceLine y={0} stroke="var(--crit)" strokeDasharray="4 4" strokeWidth={1} />
            </AreaChart>
          </ResponsiveContainer>
        </SectionCard>
      )}

      {/* Monthly inflow/outflow table */}
      {chartData.length > 0 && (
        <SectionCard title="Cash Flow Details" subtitle="Monthly inflow, outflow and net position" delay={0.22}>
          <table className="data-table">
            <thead><tr><th>Period</th><th>Inflow</th><th>Outflow</th><th>Net</th><th>Cash Position</th></tr></thead>
            <tbody>
              {chartData.map((row, i) => {
                const net = row.inflow - row.outflow;
                return (
                  <motion.tr key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.28 + i * 0.04 }}>
                    <td style={{ color: 'var(--text-1)', fontWeight: 600 }}>{row.label}</td>
                    <td style={{ color: 'var(--good)' }}>{fmt(row.inflow, false, sym)}</td>
                    <td style={{ color: 'var(--e2)' }}>{fmt(row.outflow, false, sym)}</td>
                    <td style={{ color: net >= 0 ? 'var(--good)' : 'var(--crit)', fontWeight: 700 }}>
                      {net >= 0 ? '+' : ''}{fmt(net, false, sym)}
                    </td>
                    <td style={{ color: 'var(--cyan)', fontWeight: 600 }}>{fmt(row.cash, false, sym)}</td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </SectionCard>
      )}
    </>
  );
}
