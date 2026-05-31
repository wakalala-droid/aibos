'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { useStore, severityConfig } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';

// ── Shared card ────────────────────────────────────────────────────────────────
function Card({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay }}
      style={{
        background:     'rgba(9,13,30,0.82)',
        backdropFilter: 'blur(20px)',
        border:         '1px solid rgba(99,179,237,0.1)',
        borderRadius:   16,
        padding:        '22px 24px',
        boxShadow:      '0 4px 32px rgba(0,0,0,0.35)',
        position:       'relative',
        overflow:       'hidden',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: 'linear-gradient(90deg,transparent,rgba(99,179,237,0.25),transparent)' }} />
      {children}
    </motion.div>
  );
}

// ── Stat card — glow only, no accent border ────────────────────────────────────
function StatCard({ label, value, colour, glow, isCount = false, delay = 0, sym }: any) {
  const display = isCount
    ? String(value)
    : (value >= 0 ? '+' : '') + formatCurrency(value, true, sym);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      style={{
        background:     'rgba(9,13,30,0.88)',
        backdropFilter: 'blur(20px)',
        border:         `1px solid ${colour}18`,
        borderRadius:   14,
        padding:        '22px 24px',
        boxShadow:      `0 4px 32px rgba(0,0,0,0.4), 0 0 40px ${glow}`,
        position:       'relative',
        overflow:       'hidden',
      }}
    >
      {/* Ambient glow orb */}
      <div style={{ position: 'absolute', top: -32, right: -32, width: 100, height: 100, borderRadius: '50%', background: `radial-gradient(circle, ${glow}, transparent 70%)`, pointerEvents: 'none' }} />
      {/* Subtle floor gradient */}
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 80% 0%, ${colour}09 0%, transparent 65%)`, pointerEvents: 'none' }} />

      <p style={{ fontSize: '0.6rem', fontFamily: 'DM Mono, monospace', color: '#4a6285', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 14px' }}>{label}</p>

      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: delay + 0.15 }}
        style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'Outfit, sans-serif', color: colour, margin: 0, letterSpacing: '-0.03em', lineHeight: 1 }}
      >
        {display}
      </motion.p>

      <p style={{ fontSize: '0.6rem', color: '#2d4a70', fontFamily: 'DM Mono, monospace', margin: '10px 0 0', letterSpacing: '0.06em' }}>vs budget FY</p>
    </motion.div>
  );
}

// ── Custom animated bar shape ──────────────────────────────────────────────────
const VarianceBar = (props: any) => {
  const { x, y, width, height, value, index } = props;
  if (!width || !height || Math.abs(height) < 1) return null;

  const isPos  = (value ?? 0) >= 0;
  const absH   = Math.abs(height);
  const gradId = `vbg_${index}`;

  return (
    <g>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={isPos ? '#60A5FA' : '#FBBF24'} stopOpacity={0.92} />
          <stop offset="100%" stopColor={isPos ? '#1D4ED8' : '#92400E'} stopOpacity={0.60} />
        </linearGradient>
      </defs>

      {/* Main bar — springs in from zero line */}
      <motion.rect
        x={x + 2}
        y={y}
        width={width - 4}
        height={absH}
        rx={3}
        ry={3}
        fill={`url(#${gradId})`}
        style={{
          transformBox:    'fill-box',
          transformOrigin: isPos ? 'center bottom' : 'center top',
          filter:          `drop-shadow(0 0 5px ${isPos ? 'rgba(96,165,250,0.35)' : 'rgba(251,191,36,0.35)'})`,
        }}
        initial={{ scaleY: 0, opacity: 0 }}
        animate={{ scaleY: 1, opacity: 1 }}
        transition={{ duration: 0.65, delay: 0.1 + index * 0.055, ease: [0.34, 1.56, 0.64, 1] }}
      />

      {/* Shimmer cap — appears after bar finishes */}
      <motion.rect
        x={x + 4}
        y={isPos ? y : y + absH - 1}
        width={width - 8}
        height={1.5}
        rx={1}
        fill={isPos ? '#93C5FD' : '#FDE68A'}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.75 }}
        transition={{ delay: 0.1 + index * 0.055 + 0.5, duration: 0.25 }}
      />
    </g>
  );
};

// ── Custom tooltip ─────────────────────────────────────────────────────────────
function VarianceTooltip({ active, payload, label, sym }: any) {
  if (!active || !payload?.length) return null;
  const pv = payload.find((p: any) => p.dataKey === 'profitVariance');
  const rv = payload.find((p: any) => p.dataKey === 'revenueVariance');
  const val = pv?.value ?? 0;
  const pos = val >= 0;

  return (
    <div style={{
      background:    'rgba(7,10,24,0.97)',
      border:        `1px solid ${pos ? 'rgba(96,165,250,0.2)' : 'rgba(251,191,36,0.2)'}`,
      borderRadius:  12,
      padding:       '12px 16px',
      boxShadow:     `0 16px 48px rgba(0,0,0,0.6), 0 0 24px ${pos ? 'rgba(96,165,250,0.06)' : 'rgba(251,191,36,0.06)'}`,
      minWidth:      168,
      backdropFilter:'blur(16px)',
    }}>
      <p style={{ fontSize: '0.66rem', fontFamily: 'DM Mono, monospace', color: '#4a6285', margin: '0 0 10px', letterSpacing: '0.05em' }}>{label}</p>

      {pv && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 5 }}>
          <span style={{ fontSize: '0.66rem', fontFamily: 'DM Mono, monospace', color: '#4a6285' }}>Profit var</span>
          <span style={{ fontSize: '0.76rem', fontFamily: 'Outfit, sans-serif', fontWeight: 700, color: pos ? '#60A5FA' : '#FBBF24' }}>
            {val >= 0 ? '+' : ''}{formatCurrency(val, true, sym)}
          </span>
        </div>
      )}
      {rv && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
          <span style={{ fontSize: '0.66rem', fontFamily: 'DM Mono, monospace', color: '#4a6285' }}>Rev var</span>
          <span style={{ fontSize: '0.76rem', fontFamily: 'Outfit, sans-serif', fontWeight: 700, color: rv.value >= 0 ? '#34D399' : '#F87171' }}>
            {rv.value >= 0 ? '+' : ''}{formatCurrency(rv.value, true, sym)}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function VariancePage() {
  const monthly = useStore(s => s.monthly);
  const alerts  = useStore(s => s.alerts);
  const sym     = useStore(s => s.currencySymbol);

  const budget = monthly.map((m, i) => ({
    ...m,
    budgetRevenue: Math.round(142000 * (1 + i * 0.015)),
    budgetCosts:   Math.round(98000  * (1 + i * 0.012)),
  }));

  const varianceData = budget.map(m => ({
    month:           m.month.slice(0, 3),
    revenueVariance: m.revenue  - m.budgetRevenue,
    costsVariance:   m.budgetCosts - m.costs,
    profitVariance:  m.profit   - (m.budgetRevenue - m.budgetCosts),
  }));

  const totalRV    = varianceData.reduce((s, m) => s + m.revenueVariance, 0);
  const totalCV    = varianceData.reduce((s, m) => s + m.costsVariance,   0);
  const totalPV    = varianceData.reduce((s, m) => s + m.profitVariance,  0);
  const alertCount = alerts.filter(a => a.severity === 'critical' || a.severity === 'high').length;

  const AXIS = {
    tick:     { fill: '#4a6285', fontSize: 11, fontFamily: 'DM Mono, monospace' },
    axisLine: { stroke: 'rgba(99,179,237,0.07)' },
    tickLine: false,
  };

  const thStyle = { textAlign: 'left' as const, padding: '8px 12px', fontSize: '0.6rem', fontFamily: 'DM Mono, monospace', color: '#4a6285', textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontWeight: 400 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1400, margin: '0 auto' }}>

      {/* ── Stat cards ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <StatCard label="Revenue Variance" value={totalRV}     colour="#38BDF8" glow="rgba(56,189,248,0.08)"  delay={0}    sym={sym} />
        <StatCard label="Cost Variance"    value={totalCV}     colour="#FBBF24" glow="rgba(251,191,36,0.08)"  delay={0.07} sym={sym} />
        <StatCard label="Profit Variance"  value={totalPV}     colour="#34D399" glow="rgba(52,211,153,0.08)"  delay={0.14} sym={sym} />
        <StatCard label="Alerts Active"    value={alertCount}  colour="#F87171" glow="rgba(248,113,113,0.08)" delay={0.21} sym={sym} isCount />
      </div>

      {/* ── Variance chart ─────────────────────────────────────────────── */}
      <Card delay={0.1}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: '0 0 4px' }}>Monthly Variance Analysis</h3>
            <p style={{ fontSize: '0.65rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: 0 }}>
              Bars = profit vs budget · Curve = revenue variance trajectory
            </p>
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: 'linear-gradient(135deg,#60A5FA,#1D4ED8)' }} />
              <span style={{ fontSize: '0.6rem', fontFamily: 'DM Mono, monospace', color: '#4a6285' }}>Ahead</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: 'linear-gradient(135deg,#FBBF24,#92400E)' }} />
              <span style={{ fontSize: '0.6rem', fontFamily: 'DM Mono, monospace', color: '#4a6285' }}>Behind</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 18, height: 2, background: 'none', backgroundImage: 'repeating-linear-gradient(90deg,#A78BFA 0,#A78BFA 5px,transparent 5px,transparent 9px)', borderRadius: 1 }} />
              <span style={{ fontSize: '0.6rem', fontFamily: 'DM Mono, monospace', color: '#4a6285' }}>Rev trend</span>
            </div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={varianceData} margin={{ top: 8, right: 8, bottom: 0, left: -8 }} barCategoryGap="30%">
            <CartesianGrid
              strokeDasharray="0"
              stroke="rgba(255,255,255,0.03)"
              vertical={false}
              horizontalPoints={[-45000, -30000, -15000, 0, 15000, 30000, 45000]}
            />
            <XAxis dataKey="month" {...AXIS} />
            <YAxis
              {...AXIS}
              tickFormatter={v => `${sym}${v >= 0 ? '+' : ''}${(v / 1000).toFixed(0)}K`}
              width={70}
            />
            {/* Zero baseline — subtle glow line */}
            <ReferenceLine
              y={0}
              stroke="rgba(148,163,184,0.2)"
              strokeWidth={1.5}
              isFront
            />
            {/* No white cursor flash */}
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.025)', stroke: 'none' }}
              content={<VarianceTooltip sym={sym} />}
            />

            {/* Bars — custom animated shape */}
            <Bar
              dataKey="profitVariance"
              name="Profit Variance"
              shape={<VarianceBar />}
              isAnimationActive={false}
            >
              {varianceData.map((_, i) => (
                <Cell key={i} />
              ))}
            </Bar>

            {/* Revenue trend line — draws in after bars finish */}
            <Line
              dataKey="revenueVariance"
              name="Revenue Variance"
              type="monotone"
              stroke="#A78BFA"
              strokeWidth={2}
              strokeDasharray="7 4"
              dot={{ fill: '#A78BFA', r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#A78BFA', stroke: 'rgba(167,139,250,0.4)', strokeWidth: 5 }}
              isAnimationActive
              animationDuration={1400}
              animationBegin={900}
              animationEasing="ease-out"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      {/* ── Budget vs actuals table ─────────────────────────────────────── */}
      <Card delay={0.15}>
        <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: '0 0 4px' }}>Budget vs Actuals Detail</h3>
        <p style={{ fontSize: '0.65rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: '0 0 16px' }}>Click column headers to sort</p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(99,179,237,0.08)' }}>
                {['Month','Budget Rev','Actual Rev','Rev Variance','Actual Cost','Budget Cost','Cost Variance','Margin'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {budget.map((row, i) => {
                const rv = row.revenue - row.budgetRevenue;
                const cv = row.budgetCosts - row.costs;
                return (
                  <motion.tr
                    key={row.month}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.04 }}
                    style={{ borderBottom: '1px solid rgba(99,179,237,0.05)', transition: 'background .15s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(99,179,237,0.03)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <td style={{ padding: '10px 12px', fontSize: '0.78rem', fontFamily: 'DM Mono, monospace', color: '#d4ddf0', fontWeight: 500 }}>{row.month}</td>
                    <td style={{ padding: '10px 12px', fontSize: '0.78rem', fontFamily: 'Outfit, sans-serif', color: '#4a6285' }}>{formatCurrency(row.budgetRevenue, true, sym)}</td>
                    <td style={{ padding: '10px 12px', fontSize: '0.78rem', fontFamily: 'Outfit, sans-serif', color: '#e2eeff' }}>{formatCurrency(row.revenue, true, sym)}</td>
                    <td style={{ padding: '10px 12px', fontSize: '0.78rem', fontFamily: 'DM Mono, monospace', color: rv >= 0 ? '#38BDF8' : '#FBBF24', fontWeight: 600 }}>{rv >= 0 ? '+' : ''}{formatCurrency(rv, true, sym)}</td>
                    <td style={{ padding: '10px 12px', fontSize: '0.78rem', fontFamily: 'Outfit, sans-serif', color: '#e2eeff' }}>{formatCurrency(row.costs, true, sym)}</td>
                    <td style={{ padding: '10px 12px', fontSize: '0.78rem', fontFamily: 'Outfit, sans-serif', color: '#4a6285' }}>{formatCurrency(row.budgetCosts, true, sym)}</td>
                    <td style={{ padding: '10px 12px', fontSize: '0.78rem', fontFamily: 'DM Mono, monospace', color: cv >= 0 ? '#34D399' : '#F87171', fontWeight: 600 }}>{cv >= 0 ? '+' : ''}{formatCurrency(cv, true, sym)}</td>
                    <td style={{ padding: '10px 12px', fontSize: '0.78rem', fontFamily: 'DM Mono, monospace', color: row.margin >= 32 ? '#34D399' : row.margin >= 28 ? '#F59E0B' : '#F87171', fontWeight: 500 }}>{row.margin.toFixed(1)}%</td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Alert detail ────────────────────────────────────────────────── */}
      <Card delay={0.2}>
        <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: '0 0 16px' }}>Variance Alert Detail</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {alerts.length === 0 ? (
            <p style={{ fontSize: '0.78rem', fontFamily: 'DM Mono, monospace', color: '#4a6285', textAlign: 'center', padding: '24px 0' }}>No active alerts</p>
          ) : alerts.map((alert, i) => {
            const cfg = severityConfig[alert.severity];
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.05 }}
                style={{ display: 'flex', gap: 14, padding: '12px 16px', background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 10, alignItems: 'flex-start' }}
              >
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.colour, flexShrink: 0, marginTop: 5, boxShadow: `0 0 8px ${cfg.colour}90` }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 500, color: '#d4ddf0', fontFamily: 'Outfit, sans-serif' }}>{alert.title}</span>
                    <span style={{ fontSize: '0.58rem', fontFamily: 'DM Mono, monospace', color: cfg.colour, background: `${cfg.colour}18`, padding: '2px 8px', borderRadius: 4 }}>{cfg.label}</span>
                  </div>
                  <p style={{ fontSize: '0.72rem', color: '#4a6285', fontFamily: 'Outfit, sans-serif', margin: 0 }}>{alert.description}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
