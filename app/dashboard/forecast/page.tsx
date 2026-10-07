'use client';

import { useStore } from '@/lib/store';
import { monthName, monthTick } from '@/lib/change';
import { fmt, formatAxis } from '@/lib/utils';
import KPICard from '@/components/ui/KPICard';
import SectionCard from '@/components/ui/SectionCard';
import ChartTooltip from '@/components/ui/ChartTooltip';
import FeatureGate from '@/components/ui/FeatureGate';
import TimeSeriesUnavailable from '@/components/ui/TimeSeriesUnavailable';
import PageHeader from '@/components/ui/PageHeader';
import CashForecastFan from '@/components/dashboard/CashForecastFan';
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

// Least-squares linear fit over the revenue series → {slope, intercept, band}.
// Used to project the trend forward instead of compounding a single (noisy)
// last month, so the forecast reflects the whole historical dataset.
// `band(x)` is the 95% prediction-interval half-width at future index x,
// derived from the fit's residual error on the owner's own history — never a
// hardcoded percentage (SAFEGUARD §0.1: no fabricated precision). Null when
// there are fewer than 3 points, because no honest band exists yet.
function trendModel(ys: number[]): {
  slope: number; intercept: number; band: ((x: number) => number) | null;
} {
  const len = ys.length;
  if (len < 2) return { slope: 0, intercept: ys[0] ?? 0, band: null };
  const meanX = (len - 1) / 2;
  const meanY = ys.reduce((s, v) => s + v, 0) / len;
  let sxx = 0, sxy = 0;
  for (let i = 0; i < len; i++) {
    const dx = i - meanX;
    sxx += dx * dx;
    sxy += dx * (ys[i] - meanY);
  }
  const slope = sxx ? sxy / sxx : 0;
  const intercept = meanY - slope * meanX;
  if (len < 3 || sxx === 0) return { slope, intercept, band: null };
  let sse = 0;
  for (let i = 0; i < len; i++) {
    const resid = ys[i] - (intercept + slope * i);
    sse += resid * resid;
  }
  const sigma2 = sse / (len - 2);
  if (!isFinite(sigma2) || sigma2 < 0) return { slope, intercept, band: null };
  // 95% prediction interval at x: ±1.96·σ·√(1 + 1/n + (x−x̄)²/Sxx)
  const band = (x: number) =>
    1.96 * Math.sqrt(sigma2 * (1 + 1 / len + ((x - meanX) ** 2) / sxx));
  return { slope, intercept, band };
}

interface Row { month: string; hist?: number; fcast?: number; lower?: number; upper?: number; }

export default function ForecastPage() {
  const { monthly, kpi, currencySymbol, dataShape, twinLoading, twinChecked, uploadedFile } = useStore();
  // For the first seconds of every visit the recorded books are still on their
  // way, and this page said "Upload a financial file" to owners who record
  // every day. It waits for the books before calling anything empty.
  const figuresLoading = twinLoading || (!twinChecked && !uploadedFile);
  const sym = currencySymbol || 'K';

  // No time axis → never fabricate a forecast over item rows (SAFEGUARD).
  if (dataShape === 'cross_sectional') {
    return <TimeSeriesUnavailable title="Forecast" feature="Forecasting" />;
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
    hist: n(m?.Revenue),
  }));

  // Projection rows — anchor at the most recent actual and extend by the
  // least-squares trend slope (Holt-style). Uses the whole series for the slope
  // while staying tied to reality, instead of compounding one noisy month.
  const { slope, band } = trendModel(revSeries);
  const anchor = lastRev > 0 ? lastRev : Math.max(avgRev, 0);
  const projections: Row[] = [1, 2, 3].map(i => {
    const fcast = Math.max(0, Math.round(anchor + slope * i));
    const half = band ? band(revSeries.length - 1 + i) : null;
    return {
      month: `Forecast +${i}mo`,
      fcast,
      lower: half != null ? Math.max(0, Math.round(fcast - half)) : undefined,
      upper: half != null ? Math.round(fcast + half) : undefined,
    };
  });
  const hasBand = band != null;
  const bandLabel = hasBand
    ? 'The shaded band is where sales should land, judging by your history.'
    : 'The likely range appears once you have 3 months recorded.';

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
      title="The year ahead"
      colour="var(--cyan)"
      headline={hasData
        ? `Your revenue trend points to ${fmt(firstFcast, true, sym)} next month (${growthPct >= 0 ? '+' : ''}${growthPct.toFixed(1)}%).`
        : 'Upload data to project your next quarter.'}
      detail="See the next 3 months with how sure AIBOS is, how strong the trend is and what drives each month, with tables you can download."
    >
    <>
      <PageHeader
        eyebrow="Reports"
        eyebrowColour="var(--cyan)"
        title="Forecast"
        subtitle={<>What your sales are likely to be next, {hasBand ? 'with the range they should fall in' : 'from the trend so far'}.</>}
      />

      {/* P10/P50/P90 cash bands from recorded events (audit #19) — silent
          under 4 completed months of history. */}
      <CashForecastFan />

      <div className="grid-kpi" style={{ marginBottom: 24 }}>
        <KPICard label="Next month" value={fmt(firstFcast, false, sym)} sub="vs prior period" growth={growthPct}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M2 12l4-4 4 4 4-6 4 4" stroke="var(--chart-line)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>}
          iconBg="rgba(0,212,255,0.12)" sparkColor="var(--cyan)" delay={0} />
        <KPICard label="Next 3 months" value={fmt(threeTotal, true, sym)} sub="expected sales, added up"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="var(--blue)" strokeWidth="1.5" fill="none"/><path d="M16 2v4M8 2v4M3 10h18" stroke="var(--blue)" strokeWidth="1.4" strokeLinecap="round"/></svg>}
          iconBg="rgba(96,165,250,0.15)" sparkData={projections.map(p => p.fcast ?? 0)} sparkColor="var(--blue)" delay={0.06} />
        <KPICard label="Against the last 3 months" value={`${growthPct >= 0 ? '+' : ''}${growthPct.toFixed(1)}%`} sub="vs prior period" growth={growthPct}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" stroke="var(--good)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><polyline points="16 7 22 7 22 13" stroke="var(--good)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          iconBg="rgba(52,211,153,0.15)" sparkData={revSpark} sparkColor="var(--good)" delay={0.12} />
        <KPICard label="How sure" value={`${confidence}%`} sub="how well the trend fits your months"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="var(--purple)" strokeWidth="1.5" fill="none"/><path d="M9 12l2 2 4-4" stroke="var(--purple)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          iconBg="rgba(167,139,250,0.15)" sparkColor="var(--purple)" delay={0.18} />
      </div>

      {/* Live: the forecast redraws as you record. A dot and words, no pulse. */}
      <p style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '0 0 16px', fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
        <span className="badge" style={{ border: '1px solid var(--border-md)', color: 'var(--text-1)' }}>
          <span className="live-dot" aria-hidden="true" style={{ marginRight: 4 }} />Updates as you record
        </span>
        <span>Your sales so far and the next {projections.length} months. {bandLabel}</span>
      </p>

      {/* Chart */}
      {!hasData ? (
        <SectionCard title="Sales ahead" subtitle={`Your sales so far, then what AIBOS expects. ${bandLabel}`} delay={0.1} style={{ marginBottom: 20 }}>
          <div style={{
            height: 260, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 10, textAlign: 'center',
          }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
              <path d="M3 17l5-5 4 4 8-9" stroke="var(--text-4)" strokeWidth="1.6"
                strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 4" fill="none" />
            </svg>
            <p style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-2)', margin: 0 }}>
              {figuresLoading ? 'Loading your figures…' : 'No history yet'}
            </p>
            {!figuresLoading && (
              <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: 0 }}>
                Record your sales and costs as they happen, or upload a financial file on the dashboard and a forecast appears here.
              </p>
            )}
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="Sales ahead" subtitle={`Your sales so far, then what AIBOS expects. ${bandLabel}`} delay={0.1} style={{ marginBottom: 20 }}>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chart}>
              <defs>
                <linearGradient id="histG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--brand-fill)"   stopOpacity={0.20} />
                  <stop offset="100%" stopColor="var(--brand-fill)" stopOpacity={0}    />
                </linearGradient>
                <linearGradient id="foreG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-line)"   stopOpacity={0.10} />
                  <stop offset="100%" stopColor="var(--chart-line)" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis tickMargin={8} minTickGap={16} dataKey="month" tickFormatter={monthTick} tick={{ fontSize: 13, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
              <YAxis width={84} tick={{ fontSize: 13, fill: 'var(--text-3)' }} axisLine={false} tickLine={false}
                tickFormatter={(v) => formatAxis(n(v))} />
              <Tooltip content={<ChartTooltip sym={sym} />} cursor={{ stroke: 'var(--border-md)', strokeWidth: 1 }} />
              <Area type="monotone" dataKey={(d: Row) => (d.lower != null && d.upper != null ? [d.lower, d.upper] : null)} stroke="none" fill="var(--chart-line)" fillOpacity={0.12} dot={false} legendType="none" name="Likely range" connectNulls isAnimationActive={false} />
              <Area type="monotone" dataKey="hist"  stroke="var(--chart-line)"   strokeWidth={2.2} fill="url(#histG)" dot={{ r: 3.5, fill: 'var(--chart-line)',   strokeWidth: 0 }} connectNulls name="Historical" />
              <Area type="monotone" dataKey="fcast" stroke="var(--chart-line)" strokeWidth={2} strokeDasharray="6 4" fill="url(#foreG)" dot={{ r: 4, fill: 'var(--bg-card)', stroke: 'var(--chart-line)', strokeWidth: 2 }} connectNulls name="Forecast" />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 20, marginTop: 14 }}>
            {[{ color: 'var(--chart-line)', label: 'So far', dashed: false }, { color: 'var(--chart-line)', label: 'Forecast', dashed: true }].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <svg width="24" height="4">
                  {item.dashed
                    ? <line x1="0" y1="2" x2="24" y2="2" stroke={item.color} strokeWidth="2" strokeDasharray="5 3" />
                    : <line x1="0" y1="2" x2="24" y2="2" stroke={item.color} strokeWidth="2.2" />
                  }
                </svg>
                <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)' }}>{item.label}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Table */}
      {hasData && (
      <SectionCard title="Month by month" subtitle="Month-by-month predictions with confidence range" delay={0.18}>
        <table className="data-table">
          <thead>
            <tr><th>Period</th><th>Forecast Revenue</th><th>Lower (95% PI)</th><th>Upper (95% PI)</th><th>vs Last Month</th></tr>
          </thead>
          <tbody>
            {projections.map((row, i) => {
              const fv = row.fcast ?? 0;
              const vs = lastRev > 0 ? ((fv - lastRev) / lastRev * 100) : 0;
              return (
                <tr key={`p${i}`}>
                  <td style={{ fontWeight: 700, color: 'var(--text-1)' }}>{monthName(row.month)}</td>
                  <td style={{ color: 'var(--text-1)', fontWeight: 600 }}>{fmt(fv, false, sym)}</td>
                  <td style={{ color: 'var(--text-3)' }}>{row.lower != null ? fmt(row.lower, false, sym) : 'None'}</td>
                  <td style={{ color: 'var(--text-3)' }}>{row.upper != null ? fmt(row.upper, false, sym) : 'None'}</td>
                  <td style={{ color: 'var(--text-1)', fontWeight: 600 }}>
                    {vs >= 0 ? '+' : ''}{vs.toFixed(1)}%
                  </td>
                </tr>
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
