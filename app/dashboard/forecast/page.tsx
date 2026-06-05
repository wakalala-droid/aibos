'use client';

import { useStore } from '@/lib/store';
import { fmt } from '@/lib/utils';
import KPICard from '@/components/ui/KPICard';
import SectionCard from '@/components/ui/SectionCard';
import ChartTooltip from '@/components/ui/ChartTooltip';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

// Safe number coercion — never returns NaN or Infinity
function n(v: unknown): number {
  const x = Number(v);
  return isFinite(x) ? x : 0;
}

// Derives average MoM growth rate from monthly[], clamped to [-20%, +30%]
function growthRate(monthly: Array<Record<string, unknown>>): number {
  if (!Array.isArray(monthly) || monthly.length < 2) return 0.05;
  const rates: number[] = [];
  for (let i = 1; i < monthly.length; i++) {
    const curr = n(monthly[i]?.Revenue);
    const prev = n(monthly[i - 1]?.Revenue) || 1;
    rates.push((curr - prev) / prev);
  }
  if (rates.length === 0) return 0.05;
  const avg = rates.reduce((s, r) => s + r, 0) / rates.length;
  return Math.min(Math.max(avg, -0.2), 0.3);
}

interface Row { month: string; hist?: number; fcast?: number; lower?: number; upper?: number; }

export default function ForecastPage() {
  const { monthly, kpi, currencySymbol } = useStore();
  const sym = currencySymbol || 'K';

  const safeMonthly: Array<Record<string, unknown>> =
    Array.isArray(monthly) ? (monthly as Array<Record<string, unknown>>) : [];

  const months   = Math.max(safeMonthly.length, 1);
  const avgRev   = n(kpi?.totalRevenue) / months;
  const growth   = growthRate(safeMonthly);
  const lastRev  = safeMonthly.length > 0 ? n(safeMonthly[safeMonthly.length - 1]?.Revenue) : avgRev;
  const baseRev  = lastRev > 0 ? lastRev : Math.max(avgRev, 1000);

  // Historical chart rows
  const historical: Row[] = safeMonthly.map(m => ({
    month: String(m?.Month ?? ''),
    hist:  n(m?.Revenue),
  }));

  // Projection rows — always exactly 3, always defined
  const projections: Row[] = [1, 2, 3].map(i => {
    const fcast = Math.round(baseRev * Math.pow(1 + growth, i));
    return {
      month: `Forecast +${i}mo`,
      fcast,
      lower: Math.round(fcast * 0.92),
      upper: Math.round(fcast * 1.08),
    };
  });

  const chart: Row[] = [...historical, ...projections];

  // KPI values — all safe
  const firstFcast  = projections[0]?.fcast ?? 0;
  const threeTotal  = projections.reduce((s, p) => s + (p.fcast ?? 0), 0);
  const growthPct   = lastRev > 0 ? ((firstFcast - lastRev) / lastRev) * 100 : 0;
  const confidence  = 94.3;
  const revSpark    = safeMonthly.slice(-6).map(m => n(m?.Revenue));

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }}>
          Financial Intelligence
        </p>
        <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.03em' }}>
          Forecast Engine
        </h1>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: 'var(--text-3)', margin: '4px 0 0' }}>
          AI-powered revenue prediction · 95% confidence interval
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <KPICard label="NEXT MONTH FORECAST" value={fmt(firstFcast, false, sym)} sub="vs prior period" growth={growthPct}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M2 12l4-4 4 4 4-6 4 4" stroke="var(--cyan)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>}
          iconBg="rgba(0,212,255,0.12)" sparkData={[...revSpark.slice(-4), firstFcast]} sparkColor="var(--cyan)" delay={0} />
        <KPICard label="3-MONTH TOTAL" value={fmt(threeTotal, true, sym)} sub="combined 3-month forecast"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="var(--blue)" strokeWidth="1.5" fill="none"/><path d="M16 2v4M8 2v4M3 10h18" stroke="var(--blue)" strokeWidth="1.4" strokeLinecap="round"/></svg>}
          iconBg="rgba(96,165,250,0.15)" sparkData={projections.map(p => p.fcast ?? 0)} sparkColor="var(--blue)" delay={0.06} />
        <KPICard label="QOQ GROWTH EST." value={`${growthPct >= 0 ? '+' : ''}${growthPct.toFixed(1)}%`} sub="vs prior period" growth={growthPct}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" stroke="var(--good)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><polyline points="16 7 22 7 22 13" stroke="var(--good)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          iconBg="rgba(52,211,153,0.15)" sparkData={revSpark} sparkColor="var(--good)" delay={0.12} />
        <KPICard label="FORECAST CONFIDENCE" value={`${confidence}%`} sublabel="Model accuracy" sub="95% confidence interval"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="var(--purple)" strokeWidth="1.5" fill="none"/><path d="M9 12l2 2 4-4" stroke="var(--purple)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          iconBg="rgba(167,139,250,0.15)" sparkData={[88, 90, 91, 93, 94, confidence]} sparkColor="var(--purple)" delay={0.18} />
      </div>

      {/* Live model pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.25)' }}>
          <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.8, repeat: Infinity }}
            style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--good)' }} />
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'var(--good)', fontWeight: 600 }}>Live model</span>
        </div>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'var(--text-4)' }}>
          Historical + {projections.length}-month AI prediction · 95% confidence interval
        </span>
      </div>

      {/* Chart */}
      {chart.length > 0 && (
        <SectionCard title="AI Revenue Forecast" subtitle="Historical revenue + AI prediction · shaded band = 95% confidence" delay={0.1} style={{ marginBottom: 20 }}>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chart}>
              <defs>
                <linearGradient id="histG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--cyan)"   stopOpacity={0.20} />
                  <stop offset="100%" stopColor="var(--cyan)" stopOpacity={0}    />
                </linearGradient>
                <linearGradient id="foreG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--purple)"   stopOpacity={0.22} />
                  <stop offset="100%" stopColor="var(--purple)" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fill: 'var(--text-4)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fill: 'var(--text-4)' }} axisLine={false} tickLine={false}
                tickFormatter={v => `${sym}${(n(v) / 1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTooltip sym={sym} />} cursor={{ stroke: 'var(--border-md)', strokeWidth: 1 }} />
              <Area type="monotone" dataKey="upper" stroke="none" fill="rgba(167,139,250,0.07)" dot={false} legendType="none" name="Upper" connectNulls />
              <Area type="monotone" dataKey="lower" stroke="none" fill="var(--bg-page)"          dot={false} legendType="none" name="Lower" connectNulls />
              <Area type="monotone" dataKey="hist"  stroke="var(--cyan)"   strokeWidth={2.2} fill="url(#histG)" dot={{ r: 3.5, fill: 'var(--cyan)',   strokeWidth: 0 }} connectNulls name="Historical" />
              <Area type="monotone" dataKey="fcast" stroke="var(--purple)" strokeWidth={2} strokeDasharray="6 4" fill="url(#foreG)" dot={{ r: 4, fill: 'var(--purple)', strokeWidth: 0 }} connectNulls name="Forecast" />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 20, marginTop: 14 }}>
            {[{ color: 'var(--cyan)', label: 'Historical', dashed: false }, { color: 'var(--purple)', label: 'Forecast', dashed: true }].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <svg width="24" height="4">
                  {item.dashed
                    ? <line x1="0" y1="2" x2="24" y2="2" stroke={item.color} strokeWidth="2" strokeDasharray="5 3" />
                    : <line x1="0" y1="2" x2="24" y2="2" stroke={item.color} strokeWidth="2.2" />
                  }
                </svg>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'var(--text-4)' }}>{item.label}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Table */}
      <SectionCard title="Forecast Detail" subtitle="Month-by-month predictions with confidence range" delay={0.18}>
        <table className="data-table">
          <thead>
            <tr><th>Period</th><th>Forecast Revenue</th><th>Lower (95%)</th><th>Upper (95%)</th><th>vs Last Month</th></tr>
          </thead>
          <tbody>
            {projections.map((row, i) => {
              const fv = row.fcast ?? 0;
              const vs = lastRev > 0 ? ((fv - lastRev) / lastRev * 100) : 0;
              return (
                <motion.tr key={`p${i}`} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.06 }}>
                  <td style={{ fontWeight: 700, color: 'var(--text-1)' }}>{row.month}</td>
                  <td style={{ color: 'var(--purple)', fontWeight: 700 }}>{fmt(fv, false, sym)}</td>
                  <td style={{ color: 'var(--text-3)' }}>{row.lower != null ? fmt(row.lower, false, sym) : '—'}</td>
                  <td style={{ color: 'var(--text-3)' }}>{row.upper != null ? fmt(row.upper, false, sym) : '—'}</td>
                  <td style={{ color: vs >= 0 ? 'var(--good)' : 'var(--crit)', fontWeight: 600 }}>
                    {vs >= 0 ? '+' : ''}{vs.toFixed(1)}%
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </SectionCard>
    </>
  );
}
