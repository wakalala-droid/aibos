'use client';
import { useStore } from '@/lib/store';
import { fmt, scoreColor, formatAxis, n } from '@/lib/utils';
import KPICard from '@/components/ui/KPICard';
import SectionCard from '@/components/ui/SectionCard';
import InsightCard from '@/components/ui/InsightCard';
import FileUpload from '@/components/upload/FileUpload';
import AICFOChat from '@/components/chat/AICFOChat';
import ChartTooltip from '@/components/ui/ChartTooltip';
import FeatureGate from '@/components/ui/FeatureGate';
import UpgradeTrigger from '@/components/ui/UpgradeTrigger';
import BriefSubscribe from '@/components/ui/BriefSubscribe';
import DataManifestCard from '@/components/ui/DataManifestCard';
import CustomMetricsCard from '@/components/ui/CustomMetricsCard';
import BorderGlow from '@/components/ui/BorderGlow';
import { cometProps } from '@/lib/cometStyle';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

// Cursor edge-glow tuning for KPI/score cards (hsl "h s l", React Bits).
const CURSOR_GLOW = '190 95 62';
const MESH = ['#22d3ee', '#60a5fa', '#a78bfa'];

function EngineScoreCard({
  label, sub, score, colour, href, locked, explainId,
}: {
  label: string; sub: string; score: number; colour: string; href: string; locked?: boolean; explainId?: string;
}) {
  const col = scoreColor(score);
  const comet = cometProps(locked ? undefined : score, colour);
  return (
    <Link
      href={locked ? '#' : href}
      onClick={e => { if (locked) e.preventDefault(); }}
      style={{ textDecoration: 'none' }}
    >
      <BorderGlow glowColor={CURSOR_GLOW} backgroundColor="var(--bg-card)" borderRadius={14} glowRadius={48} glowIntensity={1.2} coneSpread={12} colors={MESH} style={{ height: '100%' }}>
      <div
        className={`kpi-card glow-inner ${comet.className}`}
        data-ai-explain={explainId}
        data-ai-label={explainId ? label : undefined}
        data-ai-value={explainId && !locked ? String(score) : undefined}
        style={{
          ...comet.style,
          opacity: locked ? 0.5 : 1,
          cursor: locked ? 'default' : 'pointer',
        }}
      >
        {/* Bento dot texture — fades in from the bottom on hover */}
        <span className="bento-tex" aria-hidden="true" />
        <p className="kpi-label" style={{ color: colour }}>{label}</p>
        <p style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem',
          color: 'var(--text-4)', margin: '2px 0 10px',
        }}>
          {sub}
        </p>
        <p style={{
          fontFamily: 'Inter, sans-serif', fontSize: '2.4rem', fontWeight: 800,
          color: locked ? 'var(--text-4)' : col,
          letterSpacing: '-0.04em', margin: '0 0 10px',
        }}>
          {locked ? '—' : score}
        </p>
        <div className="progress-track">
          {!locked && (
            <div className="progress-fill" style={{ width: `${score}%`, background: col }} />
          )}
        </div>
      </div>
      </BorderGlow>
    </Link>
  );
}

function ComingSoon({ colour, text }: { colour: string; text: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0 2px' }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
        fontFamily: 'JetBrains Mono, monospace', fontSize: '0.64rem', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.08em', color: colour,
        background: `color-mix(in srgb, ${colour} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${colour} 30%, transparent)`,
        padding: '3px 8px', borderRadius: 6,
      }}>
        Coming soon
      </span>
      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.78rem', color: 'var(--text-3)', lineHeight: 1.5, margin: 0 }}>
        {text}
      </p>
    </div>
  );
}

export default function OverviewPage() {
  const {
    kpi, health, monthly, alerts,
    intelligenceScores, crossInsights, unifiedBrief,
    engineFlags, hasEngine2Data, hasEngine3Data,
    currencySymbol, rfm, retention,
    posGrandTotals, attachRates, benchmarks,
    dataShape, breakdown,
  } = useStore();
  const sym    = currencySymbol || 'K';
  const scores = intelligenceScores;

  // Chart data
  const safeMonthly = Array.isArray(monthly) ? monthly : [];
  const chartData = safeMonthly.slice(-6).map(m => ({
    month:   String(m?.Month ?? ''),
    Revenue: Math.round(Number(m?.Revenue) || 0),
    Profit:  Math.round((Number(m?.Revenue) || 0) - (Number(m?.Costs) || 0)),
  }));

  // Spark arrays
  const revSpark  = safeMonthly.slice(-6).map(m => Number(m?.Revenue) || 0);
  const profSpark = safeMonthly.slice(-6).map(m =>
    (Number(m?.Revenue) || 0) - (Number(m?.Costs) || 0)
  );
  const marginSpark = safeMonthly.slice(-6).map(m => {
    const r = Number(m?.Revenue) || 1;
    const c = Number(m?.Costs)   || 0;
    return Math.round(((r - c) / r) * 100);
  });
  const costSpark = safeMonthly.slice(-6).map(m => Number(m?.Costs) || 0);

  // Real month-over-month growth (no hardcoded numbers — trust is design).
  // Returns undefined when there's no prior month, so KPICard hides the badge
  // rather than showing a fabricated trend.
  // Month-over-month only makes sense with a real time axis. For item-level
  // (cross-sectional) files, suppress growth badges — comparing product rows as
  // "last month vs this month" would be fabricated.
  const isTimeSeries = dataShape !== 'cross_sectional';
  const lastM = safeMonthly[safeMonthly.length - 1];
  const prevM = isTimeSeries ? safeMonthly[safeMonthly.length - 2] : undefined;
  const pctGrowth = (cur: number, prev: number | undefined) =>
    prevM && prev !== undefined && prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : undefined;

  const lastRev = n(lastM?.Revenue), prevRev = n(prevM?.Revenue);
  const lastCost = n(lastM?.Costs), prevCost = n(prevM?.Costs);
  const lastProfit = lastRev - lastCost, prevProfit = prevRev - prevCost;
  const lastMargin = lastRev ? (lastProfit / lastRev) * 100 : 0;
  const prevMargin = prevRev ? (prevProfit / prevRev) * 100 : 0;

  const revGrowth    = pctGrowth(lastRev, prevM ? prevRev : undefined);
  const costGrowth   = pctGrowth(lastCost, prevM ? prevCost : undefined);
  const profitGrowth = pctGrowth(lastProfit, prevM ? prevProfit : undefined);
  // Margin moves in percentage points, not %.
  const marginGrowth = prevM ? lastMargin - prevMargin : undefined;
  const growthSub = prevM ? 'vs last month' : 'first month';

  // Customer + Operations quick stats
  const safeRfm     = Array.isArray(rfm) ? rfm : [];
  const safeAlerts  = Array.isArray(alerts) ? alerts : [];
  const champions   = safeRfm.filter(r => r.segment === 'Champion').length;
  const highChurn   = safeRfm.filter(r => r.churn_risk >= 70).length;
  const retRate     = retention?.retention_rate ?? 0;
  const gt          = posGrandTotals;
  const drinkAttach = attachRates?.drink_attach_pct ?? 0;
  const safeBench   = Array.isArray(benchmarks) ? benchmarks : [];
  const warnB       = safeBench.filter(b => b.status !== 'good').length;

  // Item-level operations (e.g. the flower model): real product data that should
  // light up the Operations engine even when it isn't a restaurant POS export.
  const safeBreakdown = Array.isArray(breakdown) ? breakdown : [];
  const hasItemOps  = safeBreakdown.length > 0;
  const topSeller   = hasItemOps
    ? safeBreakdown.reduce((a, b) => ((b.units ?? 0) > (a.units ?? 0) ? b : a))
    : null;
  const bestMargin  = hasItemOps
    ? safeBreakdown.reduce((a, b) => (b.margin > a.margin ? b : a))
    : null;
  const opsActive   = hasEngine3Data || hasItemOps;

  // Cross insights + brief
  const safeInsights = Array.isArray(crossInsights) ? crossInsights : [];
  const orderedInsights = [
    ...safeInsights.filter(i => i.priority === 'high'),
    ...safeInsights.filter(i => i.priority === 'medium'),
    ...safeInsights.filter(i => i.priority === 'low'),
  ].slice(0, 5);

  const briefLines = (unifiedBrief || '')
    .split('\n')
    .filter(l => /^\d+\./.test(l.trim()))
    .slice(0, 5);

  // ── Unified Engine Intelligence ───────────────────────────────────────────
  // Always synthesise from whatever engines have data — even a single one — so
  // this panel is never an empty/locked dead-zone. Real cross-engine insights
  // (2+ engines) take precedence; otherwise we derive signals from the engine(s)
  // that are loaded.
  const hasEngine1 = !!engineFlags?.e1 || safeMonthly.length > 0;
  type Signal = { insight: string; action: string; priority: 'high' | 'medium' | 'low'; source_engines: string[] };
  const synthSignals: Signal[] = [];

  if (hasEngine1) {
    const m = kpi?.avgMargin ?? 0;
    // Don't call item rows "months" — describe the real scope of the data.
    const scope = isTimeSeries
      ? `${safeMonthly.length} month${safeMonthly.length === 1 ? '' : 's'}`
      : hasItemOps
        ? `${safeBreakdown.length} product${safeBreakdown.length === 1 ? '' : 's'}`
        : 'the dataset';
    synthSignals.push({
      insight: `Average net margin is ${m.toFixed(1)}% across ${scope}.`,
      action: m < 10 ? 'Margins are thin — review pricing and your largest cost lines.'
            : m < 20 ? 'Workable, but improvable — target your top variable costs.'
            : 'Strong margins — protect them as you scale.',
      priority: m < 10 ? 'high' : m < 20 ? 'medium' : 'low',
      source_engines: ['E1'],
    });
    if (revGrowth !== undefined) {
      const up = revGrowth >= 0;
      synthSignals.push({
        insight: `Revenue ${up ? 'rose' : 'fell'} ${Math.abs(revGrowth).toFixed(1)}% versus last month.`,
        action: up ? 'Reinvest the momentum into your best-performing lines.' : 'Investigate the drop before it compounds.',
        priority: !up && Math.abs(revGrowth) > 10 ? 'high' : !up ? 'medium' : 'low',
        source_engines: ['E1'],
      });
    }
    if (marginGrowth !== undefined && Math.abs(marginGrowth) >= 0.5) {
      const up = marginGrowth >= 0;
      synthSignals.push({
        insight: `Net margin ${up ? 'expanded' : 'compressed'} ${Math.abs(marginGrowth).toFixed(1)} pts month-over-month.`,
        action: up ? 'Lock in whatever drove the gain.' : 'Costs are outpacing revenue — act on the largest line.',
        priority: !up && Math.abs(marginGrowth) > 3 ? 'high' : !up ? 'medium' : 'low',
        source_engines: ['E1'],
      });
    }
  }
  if (hasEngine2Data) {
    synthSignals.push({
      insight: `${champions} champion customer${champions === 1 ? '' : 's'} · ${highChurn} at high churn risk.`,
      action: highChurn > 0 ? 'Prioritise retention outreach to the high-risk segment.' : 'Grow your champions with a loyalty offer.',
      priority: highChurn > champions ? 'high' : 'medium',
      source_engines: ['E2'],
    });
  }
  if (hasEngine3Data) {
    synthSignals.push({
      insight: `Drink attach at ${drinkAttach.toFixed(0)}%${warnB > 0 ? ` · ${warnB} benchmark${warnB === 1 ? '' : 's'} below target` : ''}.`,
      action: drinkAttach < 80 ? 'Push combo prompts at the point of sale to lift attach.' : 'Attach is strong — replicate it across locations.',
      priority: warnB > 0 || drinkAttach < 70 ? 'high' : 'low',
      source_engines: ['E3'],
    });
  }

  const unifiedInsights = (orderedInsights.length > 0 ? orderedInsights : synthSignals).slice(0, 6);
  const activeEngineCount = [hasEngine1, hasEngine2Data, opsActive].filter(Boolean).length;
  const engineStrip = [
    { label: 'Overall',    score: scores?.overall_score, colour: 'var(--cyan)', active: !!scores },
    { label: 'Financial',  score: scores?.e1_score,      colour: 'var(--e1)',   active: hasEngine1 },
    { label: 'Customer',   score: scores?.e2_score,      colour: 'var(--e2)',   active: hasEngine2Data },
    { label: 'Operations', score: scores?.e3_score,      colour: 'var(--e3)',   active: opsActive },
  ];

  return (
    <>
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontFamily: 'Inter, sans-serif', fontSize: '1.5rem', fontWeight: 800,
          color: 'var(--text-1)', margin: 0, letterSpacing: '-0.03em',
        }}>
          Overview
        </h1>
        <p style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem',
          color: 'var(--text-3)', margin: '4px 0 0',
        }}>
          Financial · Customer · Operations — unified Kwacha intelligence
        </p>
      </div>

      {/* ── Contextual upgrade trigger (only at moments of demonstrated value) ── */}
      <UpgradeTrigger />

      {/* ── Engine score strip ──────────────────────────────────────────── */}
      <div className="grid-engines" style={{ marginBottom: 24 }}>
        {/* Overall hero */}
        <BorderGlow glowColor={CURSOR_GLOW} backgroundColor="var(--bg-card)" borderRadius={14} glowRadius={48} glowIntensity={1.2} coneSpread={12} colors={MESH} style={{ height: '100%' }}>
        <div className={`kpi-card glow-inner ${cometProps(scores ? scores.overall_score : undefined, 'var(--cyan)').className}`}
          data-ai-explain="score.overall"
          data-ai-label="Health Score"
          data-ai-value={scores ? String(scores.overall_score) : undefined}
          style={{
          ...cometProps(scores ? scores.overall_score : undefined, 'var(--cyan)').style,
          minWidth: 130, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: '24px 28px',
        }}>
          {/* Bento dot texture — fades in from the bottom on hover */}
          <span className="bento-tex" aria-hidden="true" />
          <p style={{
            fontFamily: 'Inter, sans-serif', fontSize: '3.2rem', fontWeight: 900,
            color: scores ? scoreColor(scores.overall_score) : 'var(--text-4)',
            letterSpacing: '-0.05em', margin: 0, lineHeight: 1,
          }}>
            {scores?.overall_score ?? '—'}
          </p>
          <p style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem',
            color: 'var(--cyan)', margin: '6px 0 0', letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            {scores?.overall_label ?? 'No data'}
          </p>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.64rem', color: 'var(--text-4)', margin: '2px 0 0' }}>
            HEALTH SCORE
          </p>
        </div>
        </BorderGlow>

        <EngineScoreCard explainId="score.e1" label="ENGINE 1 · FINANCIAL"   sub="Cash · Forecast · P&L"
          score={scores?.e1_score ?? 0} colour="var(--e1)"
          href="/dashboard/cash"        locked={!engineFlags?.e1} />
        <EngineScoreCard explainId="score.e2" label="CUSTOMER INTELLIGENCE"  sub="RFM · CLV · Churn"
          score={scores?.e2_score ?? 0} colour="var(--e2)"
          href="/dashboard/customers"  locked={!hasEngine2Data} />
        <EngineScoreCard explainId="score.e3" label="OPERATIONS"             sub="POS · Benchmarks · Velocity"
          score={scores?.e3_score ?? 0} colour="var(--e3)"
          href="/dashboard/pos"         locked={!opsActive} />
      </div>

      {/* ── KPI cards ───────────────────────────────────────────────────── */}
      <div className="grid-kpi" style={{ marginBottom: 24 }}>
        <KPICard
          explainId="kpi.revenue"
          label="TOTAL REVENUE" value={fmt(kpi?.totalRevenue ?? 0, true, sym)}
          growth={revGrowth} sub={growthSub} sparkData={revSpark} sparkColor="var(--spark-revenue)"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="var(--blue)" strokeWidth="1.8" fill="none"/><path d="M12 7v10M9 9.5h4.5a1.5 1.5 0 010 3H9m0 0h4.5a1.5 1.5 0 010 3H9" stroke="var(--blue)" strokeWidth="1.4" strokeLinecap="round"/></svg>}
          iconBg="rgba(96,165,250,0.15)" delay={0}
        />
        <KPICard
          explainId="kpi.costs"
          label="TOTAL COSTS" value={fmt(kpi?.totalCosts ?? 0, true, sym)}
          growth={costGrowth} goodWhenUp={false} sub={growthSub} sparkData={costSpark} sparkColor="var(--spark-cost)"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M2 8h20v10a2 2 0 01-2 2H4a2 2 0 01-2-2V8z" stroke="var(--orange)" strokeWidth="1.6" fill="none"/><path d="M2 8l2-4h16l2 4" stroke="var(--orange)" strokeWidth="1.5" strokeLinejoin="round"/></svg>}
          iconBg="rgba(249,115,22,0.15)" delay={0.06}
        />
        <KPICard
          explainId="kpi.profit"
          label="NET PROFIT" value={fmt(kpi?.totalProfit ?? 0, true, sym)}
          growth={profitGrowth} sub={growthSub} sparkData={profSpark} sparkColor="var(--spark-profit)"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" stroke="var(--green)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><polyline points="16 7 22 7 22 13" stroke="var(--green)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          iconBg="rgba(52,211,153,0.15)" delay={0.12}
        />
        <KPICard
          explainId="kpi.margin"
          label="AVG NET MARGIN" value={`${(kpi?.avgMargin ?? 0).toFixed(1)}%`}
          growth={marginGrowth} sub={growthSub} sparkData={marginSpark} sparkColor="var(--spark-margin)"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="var(--purple)" strokeWidth="1.6" fill="none"/><path d="M12 8v4l3 3" stroke="var(--purple)" strokeWidth="1.5" strokeLinecap="round"/></svg>}
          iconBg="rgba(167,139,250,0.15)" delay={0.18}
        />
      </div>

      {/* ── Main two-column layout ───────────────────────────────────────── */}
      <div className="grid-main" style={{ marginBottom: 24 }}>

        {/* LEFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* How AI-BOS read your file (self-hides when there's no manifest) */}
          <DataManifestCard />

          {/* Owner-approved custom metrics, computed live (self-hides otherwise) */}
          <CustomMetricsCard />

          {/* Revenue chart — hidden for cross-sectional files, where a time line
              over non-time rows would be misleading (SAFEGUARD: no fabrication). */}
          {chartData.length > 0 && dataShape !== 'cross_sectional' && (
            <SectionCard explainId="chart.revenue" title="Revenue Intelligence" subtitle={`Monthly revenue & profit · ${sym} ZMW`} delay={0.1}>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="var(--spark-revenue)" stopOpacity={0.25}/>
                      <stop offset="100%" stopColor="var(--spark-revenue)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="var(--spark-profit)" stopOpacity={0.2}/>
                      <stop offset="100%" stopColor="var(--spark-profit)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" vertical={false}/>
                  <XAxis dataKey="month"
                    tick={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fill: 'var(--text-3)' }}
                    axisLine={false} tickLine={false}/>
                  <YAxis
                    tick={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fill: 'var(--text-3)' }}
                    axisLine={false} tickLine={false}
                    tickFormatter={(v) => formatAxis(Number(v))}/>
                  <Tooltip content={<ChartTooltip sym={sym}/>}
                    cursor={{ stroke: 'var(--border-md)', strokeWidth: 1 }}/>
                  <Area type="monotone" dataKey="Revenue"
                    stroke="var(--spark-revenue)" strokeWidth={2}
                    fill="url(#gR)" dot={false} name="Revenue"/>
                  <Area type="monotone" dataKey="Profit"
                    stroke="var(--spark-profit)" strokeWidth={1.8}
                    fill="url(#gP)" dot={false} name="Profit"/>
                </AreaChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
                {[['var(--spark-revenue)', 'Revenue'], ['var(--spark-profit)', 'Profit']].map(([c, l]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 12, height: 2, borderRadius: 2, background: c }}/>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: 'var(--text-3)' }}>{l}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* E2 + E3 quick stats — render real numbers when the engine has data,
              otherwise a clearly-labeled "coming soon" state (never zero-filled
              cards that look broken). */}
          <div className="grid-2">
            <SectionCard explainId="card.customer" delay={0.15}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', fontWeight: 600, color: 'var(--e2)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                  Customer Intelligence
                </p>
                {hasEngine2Data && (
                  <Link href="/dashboard/customers" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: 'var(--text-3)', textDecoration: 'none' }}>
                    View →
                  </Link>
                )}
              </div>
              {hasEngine2Data ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  {[
                    { l: 'Champions', v: String(champions),       c: 'var(--good)' },
                    { l: 'High Churn', v: String(highChurn),      c: 'var(--crit)' },
                    { l: 'Retention', v: `${retRate.toFixed(0)}%`, c: 'var(--e2)'  },
                  ].map(item => (
                    <div key={item.l}>
                      <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.66rem', color: 'var(--text-4)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {item.l}
                      </p>
                      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.4rem', fontWeight: 800, color: item.c, margin: 0, letterSpacing: '-0.03em' }}>
                        {item.v}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <ComingSoon
                  colour="var(--e2)"
                  text="Upload customer or sales data to unlock RFM segments, CLV tiers and churn risk."
                />
              )}
            </SectionCard>

            <SectionCard explainId="card.operations" delay={0.18}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', fontWeight: 600, color: 'var(--e3)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                  Operations
                </p>
                {hasEngine3Data && (
                  <Link href="/dashboard/pos" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: 'var(--text-3)', textDecoration: 'none' }}>
                    View →
                  </Link>
                )}
              </div>
              {hasEngine3Data ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  {[
                    { l: 'Net Revenue',   v: fmt(gt?.net_revenue ?? 0, true, sym),  c: 'var(--e3)'   },
                    { l: 'Drink Attach',  v: `${drinkAttach.toFixed(0)}%`,           c: drinkAttach >= 80 ? 'var(--good)' : 'var(--warn)' },
                    { l: 'Benchmarks',    v: `${warnB} warn`,                        c: warnB > 0 ? 'var(--warn)' : 'var(--good)' },
                  ].map(item => (
                    <div key={item.l}>
                      <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.66rem', color: 'var(--text-4)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {item.l}
                      </p>
                      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1rem', fontWeight: 800, color: item.c, margin: 0, letterSpacing: '-0.02em' }}>
                        {item.v}
                      </p>
                    </div>
                  ))}
                </div>
              ) : hasItemOps ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  {[
                    { l: 'Products',    v: String(safeBreakdown.length),                           c: 'var(--e3)' },
                    { l: 'Top Seller',  v: topSeller?.item ?? '—',                                 c: 'var(--good)' },
                    { l: 'Best Margin', v: bestMargin ? `${bestMargin.margin.toFixed(0)}%` : '—',  c: (bestMargin?.margin ?? 0) >= 0 ? 'var(--good)' : 'var(--crit)' },
                  ].map(item => (
                    <div key={item.l}>
                      <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.66rem', color: 'var(--text-4)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {item.l}
                      </p>
                      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', fontWeight: 800, color: item.c, margin: 0, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.v}>
                        {item.v}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <ComingSoon
                  colour="var(--e3)"
                  text="Upload a POS export to unlock category mix, item velocity and QSR benchmarks."
                />
              )}
            </SectionCard>
          </div>

          {/* Unified Engine Intelligence — always synthesises from whatever
              engines have data (even one), so this space is never empty. */}
          <SectionCard
            explainId="card.unifiedIntelligence"
            title="Unified Engine Intelligence"
            subtitle="Synthesised across Financial · Customer · Operations"
            delay={0.22}
            action={
              orderedInsights.length > 0 ? (
                <Link href="/dashboard/ops-brief" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: 'var(--text-3)', textDecoration: 'none' }}>
                  View all →
                </Link>
              ) : undefined
            }
          >
            {/* Per-engine score synthesis — inactive engines dim, never vanish. */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {engineStrip.map(s => (
                <div key={s.label} style={{
                  flex: '1 1 0', minWidth: 92, padding: '10px 12px', borderRadius: 10,
                  border: '1px solid var(--border)', opacity: s.active ? 1 : 0.4,
                }}>
                  <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.64rem', color: 'var(--text-4)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {s.label}
                  </p>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.3rem', fontWeight: 800, color: s.active ? s.colour : 'var(--text-4)', margin: 0, letterSpacing: '-0.03em' }}>
                    {s.active && s.score !== undefined ? s.score : '—'}
                  </p>
                </div>
              ))}
            </div>

            {/* Synthesised signals (cross-engine when available, else single-engine). */}
            {unifiedInsights.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {unifiedInsights.map((ins, i) => (
                  <InsightCard
                    key={i} index={i}
                    insight={ins.insight}
                    action={ins.action}
                    priority={ins.priority as 'high' | 'medium' | 'low'}
                    sourceEngines={ins.source_engines}
                  />
                ))}
              </div>
            ) : (
              <ComingSoon colour="var(--cyan)" text="Upload financial, customer or POS data to generate unified intelligence." />
            )}

            {/* Encourage more engines — informational, never a blocking lock. */}
            {activeEngineCount < 3 && unifiedInsights.length > 0 && (
              <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: 'var(--text-4)', margin: '14px 0 0', lineHeight: 1.5 }}>
                {activeEngineCount === 1
                  ? 'Add customer or POS data to unlock full cross-engine synthesis.'
                  : 'Add the remaining engine to unlock full cross-engine synthesis.'}
              </p>
            )}
          </SectionCard>

          {/* Executive brief preview */}
          {briefLines.length > 0 && (
            <SectionCard
              explainId="card.executiveBrief"
              title="Executive Action Plan"
              subtitle="AI-BOS unified brief · Financial + Customer Intelligence + Operations"
              delay={0.26}
              action={
                <Link href="/dashboard/ops-brief" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: 'var(--text-3)', textDecoration: 'none' }}>
                  Full brief →
                </Link>
              }
            >
              {briefLines.map((line, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  padding: '10px 0',
                  borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                    background: 'var(--cyan-dim)',
                    border: '1px solid rgba(0,212,255,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'JetBrains Mono, monospace', fontSize: '0.66rem', fontWeight: 700, color: 'var(--cyan)',
                  }}>
                    {i + 1}
                  </span>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: 'var(--text-2)', lineHeight: 1.55, margin: 0 }}>
                    {line.replace(/^\d+\.\s*/, '')}
                  </p>
                </div>
              ))}
            </SectionCard>
          )}
        </div>

        {/* RIGHT column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Upload */}
          <SectionCard explainId="card.upload" title="Upload & Analyse" subtitle="CSV or Excel · month, revenue, costs columns" delay={0.08}>
            <div id="upload-section">
              <FileUpload />
            </div>
          </SectionCard>

          {/* Active alerts */}
          {safeAlerts.length > 0 && (
            <SectionCard explainId="card.alerts" title="Active Alerts" subtitle="Variance & anomaly flags" delay={0.14}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {safeAlerts.slice(0, 4).map((a: any, i: number) => (
                  <div key={i} style={{
                    padding: '10px 12px', borderRadius: 8,
                    background: 'var(--bg-badge)', border: '1px solid var(--border)',
                  }}>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-1)', margin: '0 0 2px' }}>
                      {a.title ?? a.type}
                    </p>
                    <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: 'var(--text-3)', margin: 0 }}>
                      {a.description ?? a.month}
                    </p>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Quick access */}
          <SectionCard explainId="card.quickAccess" title="Quick Access" delay={0.2}>
            {[
              { href: '/dashboard/customers',  label: 'Customer Intelligence', sub: 'RFM · CLV · Segments',    colour: 'var(--e2)'   },
              { href: '/dashboard/pos',         label: 'POS Intelligence',      sub: 'Revenue · Velocity · BCG', colour: 'var(--e3)'   },
              { href: '/dashboard/benchmarks',  label: 'Benchmarks',            sub: 'QSR · Industry targets',   colour: 'var(--e3)'   },
              { href: '/dashboard/churn',       label: 'Churn Risk',            sub: 'Interventions · CLV risk', colour: 'var(--e2)'   },
              { href: '/dashboard/ops-brief',   label: 'Intelligence Brief',    sub: 'E1 + CI + Ops synthesis',  colour: 'var(--cyan)' },
            ].map(item => (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none', display: 'block', marginBottom: 6 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--bg-badge)',
                  transition: 'border-color 0.15s ease',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-md)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: item.colour, flexShrink: 0 }}/>
                  <div>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>{item.label}</p>
                    <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: 'var(--text-3)', margin: 0 }}>{item.sub}</p>
                  </div>
                </div>
              </Link>
            ))}
          </SectionCard>

          {/* AI brief delivery — gated to paid tiers (the retention engine). */}
          <FeatureGate
            feature="scheduled_brief"
            title="AI Brief"
            colour="var(--cyan)"
            headline="Get the one number that matters — daily or weekly."
            detail="A scheduled brief lands in your inbox leading with what changed: “Your cash runway dropped to 12 days.” Every line links straight back into the product."
          >
            <BriefSubscribe />
          </FeatureGate>
        </div>
      </div>

      {/* ── AI CFO Chat ─────────────────────────────────────────────────── */}
      {/* Full-width section below the main grid. Gated to paid tiers — free sees
          a locked preview teasing the capability. The chat component renders its
          own labelled <section> + heading, so no duplicate heading here. */}
      <div style={{ marginBottom: 8 }}>
        <FeatureGate
          feature="ai_chat"
          title="AI CFO Chat"
          colour="var(--cyan)"
          headline="Ask your numbers anything — in plain language."
          detail="“What drove last month's cost spike?” “What's our cash runway?” The AI CFO reasons across your Financial, Customer and Operations data and answers instantly."
        >
          <div style={{ height: 600 }}>
            <AICFOChat />
          </div>
        </FeatureGate>
      </div>
    </>
  );
}
