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
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';

export default function BreakevenPage() {
  const { breakeven, monthly, currencySymbol, dataShape } = useStore();
  const sym = currencySymbol || 'K';

  if (dataShape === 'cross_sectional') {
    return <TimeSeriesUnavailable title="Breakeven Analysis" feature="Breakeven analysis" />;
  }

  // ── Null-safe: compute from monthly if breakeven is null ──────────────────
  const totalRevenue = monthly.reduce((s, m) => s + (Number(m.Revenue) || 0), 0);
  const totalCosts   = monthly.reduce((s, m) => s + (Number(m.Costs)   || 0), 0);
  const months       = Math.max(monthly.length, 1);

  const avgMonthlyRevenue = totalRevenue / months;
  const avgMonthlyCosts   = totalCosts   / months;

  // Use breakeven data if available, otherwise derive from monthly
  const fixedCostPct     = 0.40;
  const fixedCosts       = breakeven?.fixedCosts       ?? (avgMonthlyCosts * fixedCostPct);
  const variableCosts    = breakeven?.variableCosts    ?? (avgMonthlyCosts * (1 - fixedCostPct));
  const contribMargin    = breakeven?.contributionMargin ?? (avgMonthlyRevenue > 0 ? ((avgMonthlyRevenue - variableCosts) / avgMonthlyRevenue) : 0.28);
  const bepRevenue       = breakeven?.breakevenRevenue ?? (contribMargin > 0 ? fixedCosts / contribMargin : 0);
  const currentRevenue   = breakeven?.currentRevenue   ?? avgMonthlyRevenue;
  const gap              = currentRevenue - bepRevenue;
  const status           = gap >= 0 ? (gap / bepRevenue > 0.2 ? 'safe' : 'warning') : 'critical';

  const statusColor = status === 'safe' ? 'var(--good)' : status === 'warning' ? 'var(--warn)' : 'var(--crit)';

  // Build waterfall-style chart from monthly
  const chartData = monthly.map(m => {
    const rev  = Number(m.Revenue) || 0;
    const cost = Number(m.Costs)   || 0;
    const fc   = cost * fixedCostPct;
    const vc   = cost * (1 - fixedCostPct);
    return {
      month: String(m.Month),
      Revenue: Math.round(rev),
      FixedCosts: Math.round(fc),
      VarCosts:   Math.round(vc),
      Breakeven:  Math.round(bepRevenue),
    };
  });

  return (
    <FeatureGate
      feature="breakeven"
      title="Breakeven Analysis"
      colour="var(--cyan)"
      headline={currentRevenue > 0
        ? `You're ${fmt(Math.abs(gap), true, sym)} ${gap >= 0 ? 'above' : 'below'} a breakeven of ${fmt(bepRevenue, true, sym)}/month.`
        : 'Upload revenue and cost data to find your breakeven point.'}
      detail="See your fixed vs variable cost split, contribution margin, margin of safety, and the exact revenue you need each month to break even."
    >
    <>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.68rem', color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }}>Financial Intelligence</p>
        <h1 style={{ fontFamily: 'Geist, sans-serif', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.03em' }}>Breakeven Analysis</h1>
        <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.7rem', color: 'var(--text-3)', margin: '4px 0 0' }}>Fixed costs · variable costs · contribution margin · breakeven point</p>
      </div>

      {/* KPI cards */}
      <div className="grid-kpi" style={{ marginBottom: 24 }}>
        <KPICard label="BREAKEVEN REVENUE" value={fmt(bepRevenue, false, sym)} sub="monthly target"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 12h18M12 3v18" stroke="var(--cyan)" strokeWidth="1.5" strokeLinecap="round" opacity=".4"/><path d="M5 19L19 5" stroke="var(--cyan)" strokeWidth="2" strokeLinecap="round"/></svg>}
          iconBg="rgba(0,212,255,0.12)" sparkColor="var(--cyan)" delay={0} />
        <KPICard label="CURRENT REVENUE" value={fmt(currentRevenue, false, sym)} sub="monthly average"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" stroke="var(--good)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          iconBg="rgba(52,211,153,0.15)" sparkData={monthly.slice(-6).map(m => Number(m.Revenue) || 0)} sparkColor="var(--good)" delay={0.06} />
        <KPICard label="FIXED COSTS" value={fmt(fixedCosts, false, sym)} sub={`${(fixedCostPct*100).toFixed(0)}% of total costs`}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="var(--warn)" strokeWidth="1.5" fill="none"/><path d="M3 9h18M9 21V9" stroke="var(--warn)" strokeWidth="1.3" strokeLinecap="round"/></svg>}
          iconBg="rgba(251,191,36,0.15)" sparkColor="var(--warn)" delay={0.12} />
        <KPICard label="CONTRIBUTION MARGIN" value={`${(contribMargin * 100).toFixed(1)}%`} sub="after variable costs"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="var(--purple)" strokeWidth="1.5" strokeLinecap="round"/></svg>}
          iconBg="rgba(167,139,250,0.15)" sparkColor="var(--purple)" delay={0.18} />
      </div>

      {/* Status banner */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        style={{ background: 'var(--bg-card)', border: `1px solid ${statusColor}`, borderRadius: 12, padding: '18px 22px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: 'var(--shadow-card)' }}>
        <div>
          <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.68rem', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>Breakeven Status</p>
          <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '1rem', fontWeight: 700, color: statusColor, margin: 0 }}>
            {status === 'safe' ? `${fmt(gap, false, sym)} above breakeven` : status === 'warning' ? `Only ${fmt(gap, false, sym)} above breakeven — tight margin` : `${fmt(Math.abs(gap), false, sym)} below breakeven — revenue required`}
          </p>
        </div>
        <span className="badge" style={{ color: statusColor, background: `color-mix(in srgb, ${statusColor} 12%, transparent)`, borderColor: `color-mix(in srgb, ${statusColor} 30%, transparent)`, fontSize: '0.7rem', padding: '4px 12px' }}>
          {status.toUpperCase()}
        </span>
      </motion.div>

      {/* Chart */}
      {chartData.length > 0 && (
        <SectionCard title="Revenue vs Cost Structure" subtitle="Monthly · fixed costs · variable costs · breakeven threshold" delay={0.14} style={{ marginBottom: 20 }}>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontFamily: 'Geist, sans-serif', fontSize: 10, fill: 'var(--text-4)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontFamily: 'Geist, sans-serif', fontSize: 10, fill: 'var(--text-4)' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatAxis(v)} />
              <Tooltip content={<ChartTooltip sym={sym} />} cursor={{ fill: 'var(--table-row-hover)' }} />
              <Bar dataKey="FixedCosts"  stackId="a" fill="var(--warn)"    fillOpacity={0.6} name="Fixed Costs"    radius={[0,0,0,0]} />
              <Bar dataKey="VarCosts"    stackId="a" fill="var(--purple)"  fillOpacity={0.6} name="Variable Costs" radius={[4,4,0,0]} />
              <Line type="monotone" dataKey="Revenue"   stroke="var(--good)" strokeWidth={2.2} dot={{ r: 4, fill: 'var(--good)', strokeWidth: 0 }} name="Revenue" />
              <ReferenceLine y={bepRevenue} stroke="var(--cyan)" strokeDasharray="5 4" strokeWidth={1.5} label={{ value: `BEP: ${sym}${(bepRevenue/1000).toFixed(0)}k`, fill: 'var(--cyan)', fontFamily: 'Geist, sans-serif', fontSize: 10, position: 'insideTopRight' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </SectionCard>
      )}

      {/* Cost breakdown */}
      <SectionCard title="Cost Structure Breakdown" subtitle="Fixed vs variable cost analysis" delay={0.2}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {[
            { label: 'Fixed Costs', value: fixedCosts,    pct: fixedCostPct * 100,           color: 'var(--warn)',   desc: 'Rent, salaries, insurance — constant regardless of sales' },
            { label: 'Variable Costs', value: variableCosts, pct: (1 - fixedCostPct) * 100,  color: 'var(--purple)', desc: 'COGS, commissions, packaging — scale with revenue' },
          ].map(item => (
            <div key={item.label} style={{ background: 'var(--bg-badge)', borderRadius: 10, padding: '16px 18px', border: '1px solid var(--border)' }}>
              <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.68rem', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>{item.label}</p>
              <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '1.5rem', fontWeight: 800, color: item.color, margin: '0 0 4px', letterSpacing: '-0.03em' }}>{fmt(item.value, false, sym)}</p>
              <div className="progress-track" style={{ marginBottom: 6 }}>
                <motion.div className="progress-fill" style={{ background: item.color }} initial={{ width: 0 }} animate={{ width: `${item.pct}%` }} transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }} />
              </div>
              <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.68rem', color: 'var(--text-4)', margin: 0 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </>
    </FeatureGate>
  );
}
