'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { formatCurrency, tokens } from '@/lib/utils';
import FileUpload from '@/components/upload/FileUpload';
import ThemeToggle from '@/components/layout/ThemeToggle';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';

const FADE = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay },
});

function scoreColour(score: number) {
  if (score >= 80) return tokens.good;
  if (score >= 60) return tokens.info;
  if (score >= 40) return tokens.warn;
  return tokens.crit;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: tokens.tooltipBg,
      border: `1px solid ${tokens.tooltipBorder}`,
      borderRadius: 12, padding: '10px 14px',
      backdropFilter: tokens.blur,
      boxShadow: tokens.shadow,
    }}>
      <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.62rem', color: tokens.textMuted, margin: '0 0 4px' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.8rem', fontWeight: 600, color: p.stroke ?? p.fill, margin: '2px 0' }}>
          {p.name}: {typeof p.value === 'number' ? formatCurrency(p.value, true) : p.value}
        </p>
      ))}
    </div>
  );
}

// Priority config uses CSS vars so they respect theme
const PRIORITY_CFG = {
  high:   { colour: tokens.crit, tag: 'HIGH'   },
  medium: { colour: tokens.warn, tag: 'MEDIUM' },
  low:    { colour: tokens.info, tag: 'LOW'    },
};

function EngineBadge({ engine }: { engine: string }) {
  const colour = engine === 'E1' ? tokens.e1 : engine === 'E2' ? tokens.e2 : tokens.e3;
  return (
    <span style={{
      fontFamily: 'DM Mono, monospace', fontSize: '0.57rem', fontWeight: 700,
      padding: '1px 7px', borderRadius: 4, color: colour,
      background: `color-mix(in srgb, ${colour} 14%, transparent)`,
      border: `1px solid color-mix(in srgb, ${colour} 28%, transparent)`,
    }}>
      {engine}
    </span>
  );
}

function EngineCard({
  label, score, colour, locked, href, hint,
}: {
  label: string; score: number; colour: string;
  locked: boolean; href: string; hint: string;
}) {
  const barCol = locked ? tokens.textFaint : scoreColour(score);
  return (
    <Link href={locked ? '#' : href} onClick={e => { if (locked) e.preventDefault(); }} style={{ textDecoration: 'none' }}>
      <motion.div
        whileHover={{ scale: locked ? 1 : 1.02 }}
        transition={{ type: 'spring', stiffness: 340, damping: 20 }}
        style={{
          background: tokens.bgSurface2,
          border: `1px solid color-mix(in srgb, ${colour} 18%, var(--border-subtle))`,
          borderRadius: 14, padding: '18px 20px',
          cursor: locked ? 'default' : 'pointer',
          opacity: locked ? 0.5 : 1,
          position: 'relative', overflow: 'hidden',
          boxShadow: tokens.shadow,
          transition: 'all 0.25s ease',
        }}
      >
        <div style={{ position: 'absolute', top: -28, right: -28, width: 90, height: 90, borderRadius: '50%', background: `color-mix(in srgb, ${colour} 10%, transparent)` }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, position: 'relative' }}>
          <div>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', color: colour, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>{label}</p>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.65rem', color: tokens.textMuted, margin: 0 }}>{hint}</p>
          </div>
          {locked
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="10" rx="2" stroke={tokens.textMuted} strokeWidth="1.5" fill="none" /><path d="M8 11V7a4 4 0 018 0v4" stroke={tokens.textMuted} strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke={colour} strokeWidth="1.5" fill="none" /><path d="M9 12l2 2 4-4" stroke={colour} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          }
        </div>
        <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '2.2rem', fontWeight: 800, color: barCol, letterSpacing: '-0.04em', margin: '0 0 8px', position: 'relative' }}>
          {locked ? '—' : score}
        </p>
        <div style={{ height: 3, borderRadius: 3, background: tokens.tableHead, overflow: 'hidden', position: 'relative' }}>
          {!locked && (
            <motion.div
              style={{ height: '100%', background: barCol, borderRadius: 3 }}
              initial={{ width: 0 }}
              animate={{ width: `${score}%` }}
              transition={{ duration: 1.1, ease: 'easeOut', delay: 0.4 }}
            />
          )}
        </div>
      </motion.div>
    </Link>
  );
}

function NavCard({ href, icon, label, sub, colour }: { href: string; icon: React.ReactNode; label: string; sub: string; colour: string }) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <motion.div
        whileHover={{ scale: 1.025 }}
        transition={{ type: 'spring', stiffness: 340, damping: 20 }}
        style={{
          background: tokens.bgSurface,
          border: `1px solid ${tokens.border}`,
          borderRadius: 12, padding: '13px 15px',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: tokens.shadow,
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 9, flexShrink: 0,
          background: `color-mix(in srgb, ${colour} 12%, transparent)`,
          border: `1px solid color-mix(in srgb, ${colour} 22%, transparent)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: colour,
        }}>
          {icon}
        </div>
        <div>
          <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem', fontWeight: 600, color: tokens.textPrimary, margin: 0 }}>{label}</p>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', color: tokens.textMuted, margin: 0 }}>{sub}</p>
        </div>
      </motion.div>
    </Link>
  );
}

export default function OverviewPage() {
  const {
    kpi, health, monthly, alerts,
    intelligenceScores, crossInsights, unifiedBrief,
    engineFlags, hasEngine2Data, hasEngine3Data,
    currencySymbol,
    rfm, retention,
    posGrandTotals, attachRates, benchmarks,
  } = useStore();

  const sym     = currencySymbol || 'K';
  const scores  = intelligenceScores;

  const chartData = monthly.slice(-6).map(m => ({
    month: m.Month,
    Revenue: Math.round(m.Revenue ?? 0),
    Profit:  Math.round((m.Revenue ?? 0) - (m.Costs ?? 0)),
  }));

  const champions  = rfm.filter(r => r.segment === 'Champion').length;
  const highChurn  = rfm.filter(r => r.churn_risk >= 70).length;
  const retRate    = retention?.retention_rate ?? 0;
  const gt         = posGrandTotals;
  const drinkAttach = attachRates?.drink_attach_pct ?? 0;
  const warnB      = benchmarks.filter(b => b.status !== 'good').length;

  const orderedInsights = [
    ...crossInsights.filter(i => i.priority === 'high'),
    ...crossInsights.filter(i => i.priority === 'medium'),
    ...crossInsights.filter(i => i.priority === 'low'),
  ].slice(0, 4);

  const briefLines = (unifiedBrief || '')
    .split('\n').filter(l => l.trim())
    .filter(l => /^\d+\./.test(l.trim()))
    .slice(0, 5);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1280, margin: '0 auto' }}>

      {/* Header */}
      <motion.div {...FADE(0)} style={{ marginBottom: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{ width: 3, height: 20, borderRadius: 2, background: `linear-gradient(180deg, ${tokens.e1}, ${tokens.e3})` }} />
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', color: tokens.textMuted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                AI-BOS · Platform Overview
              </span>
            </div>
            <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.8rem', fontWeight: 800, color: tokens.textPrimary, margin: 0, letterSpacing: '-0.03em' }}>
              Business Intelligence Overview
            </h1>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.7rem', color: tokens.textMuted, margin: '6px 0 0' }}>
              Financial · Customer · Operations — unified Kwacha intelligence
            </p>
          </div>
          {/* Theme toggle in header on overview */}
          <ThemeToggle variant="pill" />
        </div>
      </motion.div>

      {/* Composite score + engine cards */}
      <motion.div {...FADE(0.08)} style={{
        display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: 14, marginBottom: 20,
      }}>
        {/* Hero score */}
        <div style={{
          background: tokens.bgSurface2,
          border: `1px solid color-mix(in srgb, ${tokens.e1} 20%, var(--border-subtle))`,
          borderRadius: 16, padding: '24px 32px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          boxShadow: tokens.shadow,
          position: 'relative', overflow: 'hidden', minWidth: 140,
        }}>
          <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: tokens.shimmer }} />
          {scores ? (
            <>
              <motion.p
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 0.2 }}
                style={{ fontFamily: 'Outfit, sans-serif', fontSize: '3.8rem', fontWeight: 800, color: scoreColour(scores.overall_score), letterSpacing: '-0.05em', margin: 0, lineHeight: 1 }}
              >
                {scores.overall_score}
              </motion.p>
              <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.65rem', color: tokens.e1, margin: '5px 0 0', letterSpacing: '0.06em' }}>
                {scores.overall_label.toUpperCase()}
              </p>
              <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.58rem', color: tokens.textMuted, margin: '2px 0 0' }}>
                HEALTH SCORE
              </p>
            </>
          ) : (
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.72rem', color: tokens.textMuted, textAlign: 'center', margin: 0 }}>
              Upload data to score
            </p>
          )}
        </div>

        <EngineCard label="Engine 1 · Financial"  score={scores?.e1_score ?? 0} colour={tokens.e1} locked={!engineFlags.e1} href="/dashboard/cash"        hint="Cash · Forecast · P&L"    />
        <EngineCard label="Engine 2 · Customer"   score={scores?.e2_score ?? 0} colour={tokens.e2} locked={!hasEngine2Data}  href="/dashboard/customers"    hint="RFM · CLV · Churn"       />
        <EngineCard label="Engine 3 · Operations" score={scores?.e3_score ?? 0} colour={tokens.e3} locked={!hasEngine3Data}  href="/dashboard/pos"          hint="POS · Benchmarks · Velocity" />
      </motion.div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>

        {/* LEFT */}
        <div>
          {/* KPI strip */}
          <motion.div {...FADE(0.14)} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'TOTAL REVENUE', value: kpi.totalRevenue, colour: tokens.e1 },
              { label: 'TOTAL PROFIT',  value: kpi.totalProfit,  colour: tokens.good },
              { label: 'AVG MARGIN',    value: kpi.avgMargin,    colour: tokens.purple, pct: true },
            ].map(card => (
              <div key={card.label} style={{
                background: tokens.bgSurface2,
                border: `1px solid color-mix(in srgb, ${card.colour} 14%, var(--border-subtle))`,
                borderRadius: 13, padding: '18px 20px',
                boxShadow: tokens.shadow, position: 'relative', overflow: 'hidden',
                transition: 'background 0.25s ease',
              }}>
                <div style={{ position: 'absolute', top: -24, right: -24, width: 80, height: 80, borderRadius: '50%', background: `color-mix(in srgb, ${card.colour} 12%, transparent)` }} />
                <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.58rem', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px', position: 'relative' }}>
                  {card.label}
                </p>
                <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.6rem', fontWeight: 700, color: card.colour, letterSpacing: '-0.03em', margin: 0, position: 'relative' }}>
                  {(card as any).pct ? `${card.value.toFixed(1)}%` : formatCurrency(card.value, true, sym)}
                </p>
              </div>
            ))}
          </motion.div>

          {/* Revenue chart */}
          {chartData.length > 0 && (
            <motion.div {...FADE(0.18)} style={{
              background: tokens.bgSurface, backdropFilter: tokens.blur,
              border: `1px solid ${tokens.border}`, borderRadius: 16,
              padding: '20px 22px', marginBottom: 16,
              position: 'relative', overflow: 'hidden',
              boxShadow: tokens.shadow, transition: 'all 0.25s ease',
            }}>
              <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: tokens.shimmer }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', fontWeight: 600, color: tokens.textPrimary, margin: 0 }}>Revenue Trend (ZMW)</p>
                <div style={{ display: 'flex', gap: 12 }}>
                  {[[tokens.e1, 'Revenue'], [tokens.good, 'Profit']].map(([col, lbl]) => (
                    <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 8, height: 2, borderRadius: 2, background: col }} />
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', color: tokens.textMuted }}>{lbl}</span>
                    </div>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--e1)" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="var(--e1)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--good)" stopOpacity={0.14} />
                      <stop offset="100%" stopColor="var(--good)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--table-head)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontFamily: 'DM Mono, monospace', fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontFamily: 'DM Mono, monospace', fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `K${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border-medium)', strokeWidth: 1 }} />
                  <Area type="monotone" dataKey="Revenue" stroke="var(--e1)"   strokeWidth={1.8} fill="url(#revGrad)"  dot={false} name="Revenue" />
                  <Area type="monotone" dataKey="Profit"  stroke="var(--good)" strokeWidth={1.5} fill="url(#profGrad)" dot={false} name="Profit"  />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
          )}

          {/* E2 + E3 quick stats */}
          <motion.div {...FADE(0.22)} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            {/* E2 */}
            <div style={{
              background: tokens.bgSurface, backdropFilter: tokens.blur,
              border: `1px solid color-mix(in srgb, ${tokens.e2} 14%, var(--border-subtle))`,
              borderRadius: 14, padding: '18px 20px',
              position: 'relative', overflow: 'hidden',
              opacity: !hasEngine2Data ? 0.55 : 1,
              boxShadow: tokens.shadow, transition: 'all 0.25s ease',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, color-mix(in srgb, ${tokens.e2} 40%, transparent), transparent)` }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', color: tokens.e2, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Engine 2 · Customers</p>
                <Link href="/dashboard/customers" style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.58rem', color: tokens.textMuted, textDecoration: 'none' }}>View →</Link>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Champions',  value: String(champions),              colour: tokens.good },
                  { label: 'High Churn', value: String(highChurn),              colour: tokens.crit },
                  { label: 'Retention',  value: `${retRate.toFixed(0)}%`,       colour: tokens.e2   },
                ].map(item => (
                  <div key={item.label}>
                    <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.58rem', color: tokens.textMuted, margin: '0 0 3px' }}>{item.label}</p>
                    <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.3rem', fontWeight: 700, color: item.colour, margin: 0 }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* E3 */}
            <div style={{
              background: tokens.bgSurface, backdropFilter: tokens.blur,
              border: `1px solid color-mix(in srgb, ${tokens.e3} 14%, var(--border-subtle))`,
              borderRadius: 14, padding: '18px 20px',
              position: 'relative', overflow: 'hidden',
              opacity: !hasEngine3Data ? 0.55 : 1,
              boxShadow: tokens.shadow, transition: 'all 0.25s ease',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, color-mix(in srgb, ${tokens.e3} 40%, transparent), transparent)` }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', color: tokens.e3, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Engine 3 · POS</p>
                <Link href="/dashboard/pos" style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.58rem', color: tokens.textMuted, textDecoration: 'none' }}>View →</Link>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Net Revenue',  value: formatCurrency(gt?.net_revenue ?? 0, true, sym), colour: tokens.e3   },
                  { label: 'Drink Attach', value: `${drinkAttach.toFixed(0)}%`,                    colour: drinkAttach >= 80 ? tokens.good : tokens.warn },
                  { label: 'Warn Metrics', value: String(warnB),                                   colour: warnB > 0 ? tokens.warn : tokens.good },
                ].map(item => (
                  <div key={item.label}>
                    <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.58rem', color: tokens.textMuted, margin: '0 0 3px' }}>{item.label}</p>
                    <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: item.label === 'Net Revenue' ? '1rem' : '1.3rem', fontWeight: 700, color: item.colour, margin: 0, letterSpacing: '-0.02em' }}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Cross-insights */}
          {orderedInsights.length > 0 && (
            <motion.div {...FADE(0.28)} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.62rem', color: tokens.e1, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>⚡ Cross-Engine Insights</p>
                <Link href="/dashboard/ops-brief" style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.58rem', color: tokens.textMuted, textDecoration: 'none' }}>View all →</Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {orderedInsights.map((ins, i) => {
                  const cfg = PRIORITY_CFG[ins.priority] ?? PRIORITY_CFG.low;
                  return (
                    <motion.div key={i}
                      initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.34 + i * 0.06 }}
                      style={{
                        background: tokens.bgSurface, backdropFilter: tokens.blur,
                        border: `1px solid color-mix(in srgb, ${cfg.colour} 20%, var(--border-subtle))`,
                        borderRadius: 12, padding: '13px 16px',
                        boxShadow: tokens.shadow, transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{
                          fontFamily: 'DM Mono, monospace', fontSize: '0.55rem', fontWeight: 700,
                          padding: '1px 7px', borderRadius: 4, color: cfg.colour,
                          background: `color-mix(in srgb, ${cfg.colour} 12%, transparent)`,
                          border: `1px solid color-mix(in srgb, ${cfg.colour} 28%, transparent)`,
                        }}>{cfg.tag}</span>
                        {ins.source_engines.map(e => <EngineBadge key={e} engine={e} />)}
                      </div>
                      <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.7rem', color: tokens.textSecondary, lineHeight: 1.6, margin: '0 0 6px' }}>{ins.insight}</p>
                      <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.65rem', color: cfg.colour, margin: 0 }}>→ {ins.action}</p>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Brief preview */}
          {briefLines.length > 0 && (
            <motion.div {...FADE(0.34)} style={{
              background: tokens.bgSurface, backdropFilter: tokens.blur,
              border: `1px solid color-mix(in srgb, ${tokens.e1} 18%, var(--border-subtle))`,
              borderRadius: 16, padding: '20px 22px', marginBottom: 16,
              position: 'relative', overflow: 'hidden', boxShadow: tokens.shadow,
              transition: 'all 0.25s ease',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: tokens.shimmer }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', fontWeight: 600, color: tokens.textPrimary, margin: 0 }}>Executive Action Plan</p>
                <Link href="/dashboard/ops-brief" style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.58rem', color: tokens.textMuted, textDecoration: 'none' }}>Full brief →</Link>
              </div>
              {briefLines.map((line, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.07 }}
                  style={{
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                    padding: '9px 0',
                    borderTop: i > 0 ? `1px solid ${tokens.tableBorder}` : 'none',
                  }}
                >
                  <span style={{
                    width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                    background: `color-mix(in srgb, ${tokens.e1} 15%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${tokens.e1} 25%, transparent)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'DM Mono, monospace', fontSize: '0.55rem', fontWeight: 700, color: tokens.e1,
                  }}>{i + 1}</span>
                  <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.68rem', color: tokens.textSecondary, lineHeight: 1.6, margin: 0 }}>
                    {line.replace(/^\d+\.\s*/, '')}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>

        {/* RIGHT */}
        <div>
          {/* Upload */}
          <motion.div {...FADE(0.1)} style={{ marginBottom: 16 }} id="upload-section">
            <div style={{
              background: tokens.bgSurface, backdropFilter: tokens.blur,
              border: `1px solid ${tokens.border}`, borderRadius: 16, padding: '20px',
              position: 'relative', overflow: 'hidden', boxShadow: tokens.shadow,
              transition: 'all 0.25s ease',
            }}>
              <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: tokens.shimmer }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: tokens.e1 }} />
                <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                  Upload & Analyse
                </p>
              </div>
              <FileUpload />
            </div>
          </motion.div>

          {/* Quick nav */}
          <motion.div {...FADE(0.2)} style={{ marginBottom: 14 }}>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
              Quick Access
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <NavCard href="/dashboard/customers" colour={tokens.e2} label="Customer Intelligence" sub="RFM · CLV · Segments"
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" /><path d="M3 20c0-3.314 2.686-6 6-6h0c3.314 0 6 2.686 6 6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>}
              />
              <NavCard href="/dashboard/pos" colour={tokens.e3} label="POS Intelligence" sub="Revenue · Velocity · BCG"
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" /><path d="M2 10h20" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><circle cx="7" cy="15" r="1" fill="currentColor" /></svg>}
              />
              <NavCard href="/dashboard/benchmarks" colour={tokens.e3} label="Benchmarks" sub="QSR · Industry comparison"
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M2 20h20M5 20V14M9 20V8M13 20V11M17 20V5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>}
              />
              <NavCard href="/dashboard/churn" colour={tokens.e2} label="Churn Risk" sub="Interventions · CLV at risk"
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              />
              <NavCard href="/dashboard/ops-brief" colour={tokens.e1} label="Full Intelligence Brief" sub="E1 + E2 + E3 synthesis"
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2a10 10 0 110 20A10 10 0 0112 2z" stroke="currentColor" strokeWidth="1.5" fill="none" /><path d="M12 8v4M12 16v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>}
              />
            </div>
          </motion.div>

          {/* Alerts */}
          {alerts.length > 0 && (
            <motion.div {...FADE(0.28)}>
              <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', color: tokens.warn, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>
                ⚠ Active Alerts ({alerts.length})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {alerts.slice(0, 3).map((alert: any, i: number) => (
                  <div key={i} style={{
                    background: `color-mix(in srgb, ${tokens.warn} 5%, var(--bg-surface))`,
                    border: `1px solid color-mix(in srgb, ${tokens.warn} 14%, var(--border-subtle))`,
                    borderRadius: 9, padding: '9px 12px',
                    transition: 'all 0.2s ease',
                  }}>
                    <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.76rem', fontWeight: 600, color: tokens.warn, margin: '0 0 2px' }}>{alert.title ?? alert.type}</p>
                    <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.62rem', color: tokens.textMuted, margin: 0 }}>{alert.description ?? alert.month}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
