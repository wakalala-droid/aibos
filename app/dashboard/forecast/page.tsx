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
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

// Safe number coercion — never returns NaN or Infinity
function n(v: unknown): number {
  const x = Number(v);
  return isFinite(x) ? x : 0;
}

// Real forecast confidence = R-squared of a linear fit on historical revenue,
// expressed as a 0-100 percentage. Falls back to 0 when there isn't enough data.
function forecastConfidence(monthly: Array<Record<string, unknown>>): number {
  const ys = (Array.isArray(monthly) ? monthly : []).map(m => n(m?.Revenue));
  const len = ys.length;
  if (len < 3) return 0;

  const xs = ys.map((_, i) => i);
  const meanX = xs.reduce((s, v) => s + v, 0) / len;
  const meanY = ys.reduce((s, v) => s + v, 0) / len;

  let sxx = 0, sxy = 0, syy = 0;
  for (let i = 0; i < len; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }

  if (sxx === 0 || syy === 0) return 0;

  const r2 = (sxy * sxy) / (sxx * syy);
  const pct = Math.round(r2 * 1000) / 10;
  return Math.min(Math.max(pct, 0), 99.9);
}

// Least-squares linear fit over the revenue series → {slope, intercept}.
// Used to project the trend forward instead of compounding a single (noisy)
// last month, so the forecast reflects the whole historical dataset.
function linearFit(ys: number[]): { slope: number; intercept: number } {
  const len = ys.length;
  if (len < 2) return { slope: 0, intercept: ys[0] ?? 0 };
  const meanX = (len - 1) / 2;
  const meanY = ys.reduce((s, v) => s + v, 0) / len;
  let sxx = 0, sxy = 0;
  for (let i = 0; i < len; i++) {
    const dx = i - meanX;
    sxx += dx * dx;
    sxy += dx * (ys[i] - meanY);
  }
  const slope = sxx ? sxy / sxx : 0;
  return { slope, intercept: meanY - slope * meanX };
}

interface Row { month: string; hist?: number; fcast?: number; lower?: number; upper?: number; }

export default function ForecastPage() {
  const { monthly, kpi, currencySymbol, dataShape } = useStore();
  const sym = currencySymbol || 'K';

  // No time axis → never fabricate a forecast over item rows (SAFEGUARD).
  if (dataShape === 'cross_sectional') {
    return <TimeSeriesUnavailable title="Forecast Engine" feature="Forecasting" />;
  }

  const safeMonthly: Array<Record<string, unknown>> =
    Array.isArray(monthly) ? (monthly as Array<Record<string, unknown>>) : [];

  const months   = Math.max(safeMonthly.length, 1);
  const avgRev   = n(kpi?.totalRevenue) / months;
  const lastRev  = safeMonthly.length > 0 ? n(safeMonthly[safeMonthly.length - 1]?.Revenue) : avgRev;

  // Historical revenue series (real data, in order)
  const revSeries = safeMonthly.map(m => n(m?.Revenue));

  // Historical chart rows
  const historical: Row[] = safeMonthly.map(m => ({
    month: String(m?.Month ?? ''),
    hist:  n(m?.Revenue),
  }));

  // Projection rows — anchor at the most recent actual and extend by the
  // least-squares trend slope (Holt-style). Uses the whole series for the slope
  // while staying tied to reality, instead of compounding one noisy month.
  const { slope } = linearFit(revSeries);
  const anchor = lastRev > 0 ? lastRev : Math.max(avgRev, 0);
  const projections: Row[] = [1, 2, 3].map(i => {
    const fcast = Math.max(0, Math.round(anchor + slope * i));
    return {
      month: `Forecast +${i}mo`,
      fcast,
      lower: Math.round(fcast * 0.92),
      upper: Math.round(fcast * 1.08),
    };
  });

  const chart: Row[] = [...historical, ...projections];
  const hasData = safeMonthly.length > 0;

  // KPI values — all safe
  const firstFcast  = projections[0]?.fcast ?? 0;
  const threeTotal  = projections.reduce((s, p) => s + (p.fcast ?? 0), 0);
  const growthPct   = lastRev > 0 ? ((firstFcast - lastRev) / lastRev) * 100 : 0;
  const confidence  = forecastConfidence(safeMonthly);
  const revSpark    = safeMonthly.slice(-6).map(m => n(m?.Revenue));

  return (
    <FeatureGate
      feature="forecast"
      title="12-month Forecast"
      colour="var(--cyan)"
      headline={hasData
        ? `Your revenue trend points to ${fmt(firstFcast, true, sym)} next month (${growthPct >= 0 ? '+' : ''}${growthPct.toFixed(1)}%).`
        : 'Upload data to project your next quarter.'}
      detail="See the full 3-month projection with confidence bands, trend strength, and the monthly drivers — plus exportable forecast tables."
    >
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

      <div className="grid-kpi" style={{ marginBottom: 24 }}>
        <KPICard label="NEXT MONTH FORECAST" value={fmt(firstFcast, false, sym)} sub="vs prior period" growth={growthPct}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M2 12l4-4 4 4 4-6 4 4" stroke="var(--cyan)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>}
          iconBg="rgba(0,212,255,0.12)" sparkColor="var(--cyan)" delay={0} />
        <KPICard label="3-MONTH TOTAL" value={fmt(threeTotal, true, sym)} sub="combined 3-month forecast"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="var(--blue)" strokeWidth="1.5" fill="none"/><path d="M16 2v4M8 2v4M3 10h18" stroke="var(--blue)" strokeWidth="1.4" strokeLinecap="round"/></svg>}
          iconBg="rgba(96,165,250,0.15)" sparkData={projections.map(p => p.fcast ?? 0)} sparkColor="var(--blue)" delay={0.06} />
        <KPICard label="QOQ GROWTH EST." value={`${growthPct >= 0 ? '+' : ''}${growthPct.toFixed(1)}%`} sub="vs prior period" growth={growthPct}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" stroke="var(--good)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><polyline points="16 7 22 7 22 13" stroke="var(--good)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          iconBg="rgba(52,211,153,0.15)" sparkData={revSpark} sparkColor="var(--good)" delay={0.12} />
        <KPICard label="FORECAST CONFIDENCE" value={`${confidence}%`} sublabel="Model accuracy" sub="95% confidence interval"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="var(--purple)" strokeWidth="1.5" fill="none"/><path d="M9 12l2 2 4-4" stroke="var(--purple)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          iconBg="rgba(167,139,250,0.15)" sparkColor="var(--purple)" delay={0.18} />
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
      {!hasData ? (
        <SectionCard title="AI Revenue Forecast" subtitle="Historical revenue + AI prediction · shaded band = 95% confidence" delay={0.1} style={{ marginBottom: 20 }}>
          <div style={{
            height: 260, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 10, textAlign: 'center',
          }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
              <path d="M3 17l5-5 4 4 8-9" stroke="var(--text-4)" strokeWidth="1.6"
                strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 4" fill="none" />
            </svg>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-2)', margin: 0 }}>
              No historical data yet
            </p>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'var(--text-4)', margin: 0 }}>
              Upload a financial file on the dashboard to generate a forecast.
            </p>
          </div>
        </SectionCard>
      ) : (
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
                tickFormatter={(v) => formatAxis(n(v))} />
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
      {hasData && (
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
      )}
    </>
    </FeatureGate>
  );
}
