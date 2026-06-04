'use client';
import { useStore } from '@/lib/store';
import { fmt, scoreColor } from '@/lib/utils';
import KPICard from '@/components/ui/KPICard';
import SectionCard from '@/components/ui/SectionCard';
import InsightCard from '@/components/ui/InsightCard';
import FileUpload from '@/components/upload/FileUpload';
import ChartTooltip from '@/components/ui/ChartTooltip';
import { useTheme } from '@/lib/theme';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

// Sun/Moon icons
function SunIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.6"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>; }
function MoonIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>; }

// Engine score card
function EngineScoreCard({ label, sub, score, colour, href, locked }: { label: string; sub: string; score: number; colour: string; href: string; locked?: boolean }) {
  const col = scoreColor(score);
  return (
    <Link href={locked ? '#' : href} onClick={e => { if (locked) e.preventDefault(); }} style={{ textDecoration: 'none' }}>
      <div className="kpi-card" style={{ opacity: locked ? 0.5 : 1, cursor: locked ? 'default' : 'pointer' }}>
        <p className="kpi-label" style={{ color: colour }}>{label}</p>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: 'var(--text-4)', margin: '2px 0 10px' }}>{sub}</p>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '2.4rem', fontWeight: 800, color: locked ? 'var(--text-4)' : col, letterSpacing: '-0.04em', margin: '0 0 10px' }}>
          {locked ? '—' : score}
        </p>
        <div className="progress-track">
          {!locked && <div className="progress-fill" style={{ width: `${score}%`, background: col }} />}
        </div>
      </div>
    </Link>
  );
}

export default function OverviewPage() {
  const {
    kpi, health, monthly, alerts,
    intelligenceScores, crossInsights, unifiedBrief,
    engineFlags, hasEngine2Data, hasEngine3Data,
    currencySymbol, rfm, retention, posGrandTotals, attachRates, benchmarks,
  } = useStore();
  const { toggle, isDark } = useTheme();
  const sym = currencySymbol || 'K';
  const scores = intelligenceScores;

  const chartData = monthly.slice(-6).map(m => ({
    month: String(m.Month),
    Revenue: Math.round(Number(m.Revenue) || 0),
    Profit:  Math.round((Number(m.Revenue) || 0) - (Number(m.Costs) || 0)),
  }));

  const revSpark = monthly.slice(-6).map(m => Number(m.Revenue) || 0);
  const profSpark = monthly.slice(-6).map(m => (Number(m.Revenue) || 0) - (Number(m.Costs) || 0));
  const marginSpark = monthly.slice(-6).map(m => {
    const r = Number(m.Revenue) || 1;
    const c = Number(m.Costs) || 0;
    return Math.round(((r - c) / r) * 100);
  });

  const champions  = rfm.filter(r => r.segment === 'Champion').length;
  const highChurn  = rfm.filter(r => r.churn_risk >= 70).length;
  const retRate    = retention?.retention_rate ?? 0;
  const drinkAttach = attachRates?.drink_attach_pct ?? 0;
  const warnB      = benchmarks.filter(b => b.status !== 'good').length;
  const gt         = posGrandTotals;

  const orderedInsights = [
    ...crossInsights.filter(i => i.priority === 'high'),
    ...crossInsights.filter(i => i.priority === 'medium'),
    ...crossInsights.filter(i => i.priority === 'low'),
  ].slice(0, 5);

  const briefLines = (unifiedBrief || '').split('\n').filter(l => /^\d+\./.test(l.trim())).slice(0, 5);

  return (
    <>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.03em' }}>
            Business Intelligence Overview
          </h1>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: 'var(--text-3)', margin: '4px 0 0' }}>
            Financial · Customer · Operations — unified Kwacha intelligence
          </p>
        </div>
        <button
          onClick={toggle}
          style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border-md)', background: 'var(--bg-card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>

      {/* Engine score strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Overall hero */}
        <div className="kpi-card" style={{ minWidth: 130, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 28px' }}>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '3.2rem', fontWeight: 900, color: scores ? scoreColor(scores.overall_score) : 'var(--text-4)', letterSpacing: '-0.05em', margin: 0, lineHeight: 1 }}>
            {scores?.overall_score ?? '—'}
          </p>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: 'var(--cyan)', margin: '6px 0 0', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {scores?.overall_label ?? 'No data'}
          </p>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', color: 'var(--text-4)', margin: '2px 0 0' }}>HEALTH SCORE</p>
        </div>
        <EngineScoreCard label="ENGINE 1 · FINANCIAL"   sub="Cash · Forecast · P&L"    score={scores?.e1_score ?? 0} colour="var(--e1)" href="/dashboard/cash"       locked={!engineFlags.e1} />
        <EngineScoreCard label="CUSTOMER INTELLIGENCE"  sub="RFM · CLV · Churn"         score={scores?.e2_score ?? 0} colour="var(--e2)" href="/dashboard/customers"  locked={!hasEngine2Data} />
        <EngineScoreCard label="OPERATIONS"             sub="POS · Benchmarks · Velocity" score={scores?.e3_score ?? 0} colour="var(--e3)" href="/dashboard/pos"        locked={!hasEngine3Data} />
      </div>

      {/* KPI cards — matching E1 exactly */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <KPICard
          label="TOTAL REVENUE" value={fmt(kpi.totalRevenue, true, sym)}
          growth={8.4} sparkData={revSpark} sparkColor="var(--spark-revenue)"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="var(--blue)" strokeWidth="1.8" fill="none"/><path d="M12 7v10M9 9.5h4.5a1.5 1.5 0 010 3H9m0 0h4.5a1.5 1.5 0 010 3H9" stroke="var(--blue)" strokeWidth="1.4" strokeLinecap="round"/></svg>}
          iconBg="rgba(96,165,250,0.15)" delay={0}
        />
        <KPICard
          label="TOTAL COSTS" value={fmt(kpi.totalCosts, true, sym)}
          growth={5.2} sparkData={monthly.slice(-6).map(m => Number(m.Costs) || 0)} sparkColor="var(--spark-cost)"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M2 8h20v10a2 2 0 01-2 2H4a2 2 0 01-2-2V8z" stroke="var(--orange)" strokeWidth="1.6" fill="none"/><path d="M2 8l2-4h16l2 4" stroke="var(--orange)" strokeWidth="1.5" strokeLinejoin="round"/></svg>}
          iconBg="rgba(249,115,22,0.15)" delay={0.06}
        />
        <KPICard
          label="NET PROFIT" value={fmt(kpi.totalProfit, true, sym)}
          growth={12.1} sparkData={profSpark} sparkColor="var(--spark-profit)"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" stroke="var(--green)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><polyline points="16 7 22 7 22 13" stroke="var(--green)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          iconBg="rgba(52,211,153,0.15)" delay={0.12}
        />
        <KPICard
          label="AVG NET MARGIN" value={`${kpi.avgMargin.toFixed(1)}%`}
          growth={1.2} sparkData={marginSpark} sparkColor="var(--spark-margin)"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="var(--purple)" strokeWidth="1.6" fill="none"/><path d="M12 8v4l3 3" stroke="var(--purple)" strokeWidth="1.5" strokeLinecap="round"/></svg>}
          iconBg="rgba(167,139,250,0.15)" delay={0.18}
        />
      </div>

      {/* Main two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>

        {/* LEFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Revenue chart */}
          {chartData.length > 0 && (
            <SectionCard title="Revenue Intelligence" subtitle={`Monthly revenue & profit · ${sym} ZMW`} delay={0.1}>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--spark-revenue)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--spark-revenue)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--spark-profit)" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="var(--spark-profit)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} tickFormatter={v => `${sym}${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTooltip sym={sym} />} cursor={{ stroke: 'var(--border-md)', strokeWidth: 1 }} />
                  <Area type="monotone" dataKey="Revenue" stroke="var(--spark-revenue)" strokeWidth={2} fill="url(#gR)" dot={false} name="Revenue" />
                  <Area type="monotone" dataKey="Profit"  stroke="var(--spark-profit)"  strokeWidth={1.8} fill="url(#gP)" dot={false} name="Profit" />
                </AreaChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
                {[['var(--spark-revenue)', 'Revenue'], ['var(--spark-profit)', 'Profit']].map(([c, l]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 12, height: 2, borderRadius: 2, background: c }} />
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'var(--text-3)' }}>{l}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* E2 + E3 quick stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Customer Intelligence quick */}
            <SectionCard delay={0.15}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', fontWeight: 600, color: 'var(--e2)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Customer Intelligence</p>
                <Link href="/dashboard/customers" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: 'var(--text-3)', textDecoration: 'none' }}>View →</Link>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {[
                  { l: 'Champions',  v: String(champions),         c: 'var(--good)' },
                  { l: 'High Churn', v: String(highChurn),         c: 'var(--crit)' },
                  { l: 'Retention',  v: `${retRate.toFixed(0)}%`,  c: 'var(--e2)'   },
                ].map(item => (
                  <div key={item.l}>
                    <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: 'var(--text-4)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.l}</p>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.4rem', fontWeight: 800, color: item.c, margin: 0, letterSpacing: '-0.03em' }}>{item.v}</p>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Operations quick */}
            <SectionCard delay={0.18}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', fontWeight: 600, color: 'var(--e3)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Operations</p>
                <Link href="/dashboard/pos" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: 'var(--text-3)', textDecoration: 'none' }}>View →</Link>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {[
                  { l: 'Net Revenue',   v: fmt(gt?.net_revenue ?? 0, true, sym), c: 'var(--e3)'   },
                  { l: 'Drink Attach',  v: `${drinkAttach.toFixed(0)}%`,          c: drinkAttach >= 80 ? 'var(--good)' : 'var(--warn)' },
                  { l: 'Benchmarks',    v: `${warnB} warn`,                       c: warnB > 0 ? 'var(--warn)' : 'var(--good)' },
                ].map(item => (
                  <div key={item.l}>
                    <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: 'var(--text-4)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.l}</p>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1rem', fontWeight: 800, color: item.c, margin: 0, letterSpacing: '-0.02em' }}>{item.v}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          {/* Cross-engine insights */}
          {orderedInsights.length > 0 && (
            <SectionCard
              title="Cross-Engine Intelligence"
              subtitle="Compound insights derived from Financial · Customer · Operations data"
              delay={0.22}
              action={<Link href="/dashboard/ops-brief" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: 'var(--text-3)', textDecoration: 'none' }}>View all →</Link>}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {orderedInsights.map((ins, i) => (
                  <InsightCard
                    key={i} index={i}
                    insight={ins.insight}
                    action={ins.action}
                    priority={ins.priority as 'high' | 'medium' | 'low'}
                    sourceEngines={ins.source_engines}
                  />
                ))}
              </div>
            </SectionCard>
          )}

          {/* Executive brief preview */}
          {briefLines.length > 0 && (
            <SectionCard
              title="Executive Action Plan"
              subtitle="AI-BOS unified brief · E1 + Customer Intelligence + Operations"
              delay={0.26}
              action={<Link href="/dashboard/ops-brief" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: 'var(--text-3)', textDecoration: 'none' }}>Full brief →</Link>}
            >
              {briefLines.map((line, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  padding: '10px 0',
                  borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                    background: 'var(--cyan-dim)', border: '1px solid rgba(0,212,255,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', fontWeight: 700, color: 'var(--cyan)',
                  }}>{i + 1}</span>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: 'var(--text-2)', lineHeight: 1.55, margin: 0 }}>
                    {line.replace(/^\d+\.\s*/, '')}
                  </p>
                </div>
              ))}
            </SectionCard>
          )}
        </div>

        {/* RIGHT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Upload */}
          <SectionCard title="Upload & Analyse" subtitle="CSV or Excel · month, revenue, costs columns" delay={0.08} style={{ overflow: 'hidden' }}>
            <div id="upload-section">
              <FileUpload />
            </div>
          </SectionCard>

          {/* Active alerts */}
          {alerts.length > 0 && (
            <SectionCard title={`Active Alerts`} subtitle="Variance & anomaly flags" delay={0.14}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {alerts.slice(0, 4).map((a: any, i: number) => (
                  <div key={i} style={{
                    padding: '10px 12px', borderRadius: 8,
                    background: 'var(--bg-badge)', border: '1px solid var(--border)',
                  }}>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-1)', margin: '0 0 2px' }}>{a.title ?? a.type}</p>
                    <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'var(--text-3)', margin: 0 }}>{a.description ?? a.month}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Quick access */}
          <SectionCard title="Quick Access" delay={0.2}>
            {[
              { href: '/dashboard/customers', label: 'Customer Intelligence', sub: 'RFM · CLV · Segments',   colour: 'var(--e2)' },
              { href: '/dashboard/pos',       label: 'POS Intelligence',      sub: 'Revenue · Velocity · BCG', colour: 'var(--e3)' },
              { href: '/dashboard/benchmarks',label: 'Benchmarks',            sub: 'QSR · Industry targets',  colour: 'var(--e3)' },
              { href: '/dashboard/churn',     label: 'Churn Risk',            sub: 'Interventions · CLV risk', colour: 'var(--e2)' },
              { href: '/dashboard/ops-brief', label: 'Intelligence Brief',    sub: 'E1 + CI + Ops synthesis',  colour: 'var(--cyan)' },
            ].map(item => (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none', display: 'block', marginBottom: 6 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--bg-badge)', transition: 'border-color 0.15s ease',
                }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-md)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
                >
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: item.colour, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>{item.label}</p>
                    <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: 'var(--text-3)', margin: 0 }}>{item.sub}</p>
                  </div>
                </div>
              </Link>
            ))}
          </SectionCard>
        </div>
      </div>
    </>
  );
}
