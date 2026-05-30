'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, Legend,
} from 'recharts';
import { useStore, severityConfig } from '@/lib/store';
import { formatCurrency, formatPercent } from '@/lib/utils';

// ── Shared Card ───────────────────────────────────────────────────────────────
function Card({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay }}
      style={{
        background:    'rgba(9,13,30,0.82)',
        backdropFilter:'blur(20px)',
        border:        '1px solid rgba(255,255,255,0.06)',
        borderRadius:  16,
        padding:       '22px 24px',
        boxShadow:     '0 4px 32px rgba(0,0,0,0.35)',
        position:      'relative',
        overflow:      'hidden',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(99,179,237,0.2), transparent)' }} />
      {children}
    </motion.div>
  );
}

// ── Stat Card (per-color identity, Image 2 style) ─────────────────────────────
function StatCard({ label, value, colour, glow, isCount = false, negative = false, delay = 0, sym }: any) {
  const display = isCount
    ? String(value)
    : (value >= 0 ? '+' : '') + formatCurrency(value, true, sym);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay }}
      style={{
        background:    'rgba(9,13,30,0.88)',
        backdropFilter:'blur(20px)',
        border:        '1px solid rgba(255,255,255,0.05)',
        borderLeft:    `3px solid ${colour}`,
        borderRadius:  '0 14px 14px 0',
        padding:       '22px 24px',
        boxShadow:     `0 4px 32px rgba(0,0,0,0.4), inset 40px 0 60px ${glow}`,
        position:      'relative',
        overflow:      'hidden',
      }}
    >
      {/* Top-right glow */}
      <div style={{ position: 'absolute', top: -24, right: -24, width: 88, height: 88, borderRadius: '50%', background: `radial-gradient(circle, ${glow}, transparent 70%)`, pointerEvents: 'none' }} />

      <p style={{
        fontSize:      '0.6rem',
        fontFamily:    'DM Mono, monospace',
        color:         '#4a6285',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        margin:        '0 0 14px',
      }}>{label}</p>

      <p style={{
        fontSize:      '2rem',
        fontWeight:    700,
        fontFamily:    'Outfit, sans-serif',
        color:         colour,
        margin:        0,
        letterSpacing: '-0.03em',
        lineHeight:    1,
      }}>{display}</p>

      <p style={{
        fontSize:      '0.6rem',
        color:         '#2d4a70',
        fontFamily:    'DM Mono, monospace',
        margin:        '10px 0 0',
        letterSpacing: '0.06em',
      }}>vs budget FY</p>
    </motion.div>
  );
}

// ── Custom Gradient Bar ───────────────────────────────────────────────────────
const GradientBar = (props: any) => {
  const { x, y, width, height, value, index } = props;
  if (!width || !height) return null;
  const pos  = value >= 0;
  const id   = `vgrad_${index}`;
  const topC = pos ? '#60A5FA' : '#FB923C';
  const botC = pos ? '#1D4ED8' : '#9A3412';
  const glow = pos ? 'rgba(96,165,250,0.25)' : 'rgba(251,146,60,0.25)';
  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" y1={pos ? '0' : '1'} x2="0" y2={pos ? '1' : '0'}>
          <stop offset="0%"   stopColor={topC} stopOpacity={0.95} />
          <stop offset="100%" stopColor={botC} stopOpacity={0.65} />
        </linearGradient>
        <filter id={`glow_${index}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <rect
        x={x + 1} y={y} width={width - 2} height={height}
        rx={3} ry={3}
        fill={`url(#${id})`}
        filter={`url(#glow_${index})`}
        opacity={0.9}
      />
      {/* Top shimmer line */}
      <rect
        x={x + 2} y={pos ? y : y + height - 1}
        width={width - 4} height={1}
        fill={topC} opacity={0.6}
        rx={1}
      />
    </g>
  );
};

// ── Custom Tooltip ────────────────────────────────────────────────────────────
function VarianceTooltip({ active, payload, label, sym }: any) {
  if (!active || !payload?.length) return null;
  const pv  = payload.find((p: any) => p.dataKey === 'profitVariance');
  const rv  = payload.find((p: any) => p.dataKey === 'revenueVariance');
  const val = pv?.value ?? 0;
  const pos = val >= 0;

  return (
    <div style={{
      background:    'rgba(7,10,24,0.97)',
      border:        `1px solid ${pos ? 'rgba(96,165,250,0.2)' : 'rgba(251,146,60,0.2)'}`,
      borderLeft:    `3px solid ${pos ? '#60A5FA' : '#FB923C'}`,
      borderRadius:  '0 12px 12px 0',
      padding:       '12px 16px',
      boxShadow:     `0 12px 40px rgba(0,0,0,0.6), 0 0 24px ${pos ? 'rgba(96,165,250,0.06)' : 'rgba(251,146,60,0.06)'}`,
      minWidth:      160,
    }}>
      <p style={{ fontSize: '0.68rem', fontFamily: 'DM Mono, monospace', color: '#4a6285', margin: '0 0 10px', letterSpacing: '0.05em' }}>{label}</p>
      {pv && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 5 }}>
          <span style={{ fontSize: '0.68rem', fontFamily: 'DM Mono, monospace', color: '#4a6285' }}>Profit var</span>
          <span style={{ fontSize: '0.74rem', fontFamily: 'Outfit, sans-serif', fontWeight: 600, color: val >= 0 ? '#60A5FA' : '#FB923C' }}>
            {val >= 0 ? '+' : ''}{formatCurrency(val, true, sym)}
          </span>
        </div>
      )}
      {rv && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ fontSize: '0.68rem', fontFamily: 'DM Mono, monospace', color: '#4a6285' }}>Revenue var</span>
          <span style={{ fontSize: '0.74rem', fontFamily: 'Outfit, sans-serif', fontWeight: 600, color: rv.value >= 0 ? '#34D399' : '#F87171' }}>
            {rv.value >= 0 ? '+' : ''}{formatCurrency(rv.value, true, sym)}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function VariancePage() {
  const monthly = useStore(s => s.monthly);
  const alerts  = useStore(s => s.alerts);
  const sym     = useStore(s => s.currencySymbol);
  const [sortCol, setSortCol] = useState<'month' | 'revenue' | 'costs' | 'profit' | 'margin'>('month');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Budget assumption: 10% growth from Jan baseline
  const budget = monthly.map((m, i) => ({
    ...m,
    budgetRevenue: Math.round(142000 * (1 + i * 0.015)),
    budgetCosts:   Math.round(98000  * (1 + i * 0.012)),
  }));

  const varianceData = budget.map(m => ({
    month:           m.month.slice(0, 3),
    revenueVariance: m.revenue - m.budgetRevenue,
    costsVariance:   m.budgetCosts - m.costs,
    profitVariance:  m.profit - (m.budgetRevenue - m.budgetCosts),
  }));

  const totalRV = varianceData.reduce((s, m) => s + m.revenueVariance, 0);
  const totalCV = varianceData.reduce((s, m) => s + m.costsVariance, 0);
  const totalPV = varianceData.reduce((s, m) => s + m.profitVariance, 0);
  const alertCount = alerts.filter(a => a.severity === 'critical' || a.severity === 'high').length;

  const AXIS = {
    tick:     { fill: '#4a6285', fontSize: 11, fontFamily: 'DM Mono, monospace' },
    axisLine: { stroke: 'rgba(99,179,237,0.08)' },
    tickLine: false,
  };

  const thStyle = {
    textAlign:     'left' as const,
    padding:       '8px 12px',
    fontSize:      '0.6rem',
    fontFamily:    'DM Mono, monospace',
    color:         '#4a6285',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    fontWeight:    400,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1400, margin: '0 auto' }}>

      {/* ── Stat Cards ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <StatCard label="Revenue Variance" value={totalRV}     colour="#38BDF8" glow="rgba(56,189,248,0.10)"  delay={0}    sym={sym} />
        <StatCard label="Cost Variance"    value={totalCV}     colour="#FB923C" glow="rgba(251,146,60,0.10)"  delay={0.07} sym={sym} />
        <StatCard label="Profit Variance"  value={totalPV}     colour="#34D399" glow="rgba(52,211,153,0.10)"  delay={0.14} sym={sym} />
        <StatCard label="Alerts Active"    value={alertCount}  colour="#F87171" glow="rgba(248,113,113,0.10)" delay={0.21} sym={sym} isCount />
      </div>

      {/* ── Chart ──────────────────────────────────────────────────────── */}
      <Card delay={0.1}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: '0 0 4px' }}>Monthly Profit Variance vs Budget</h3>
            <p style={{ fontSize: '0.66rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: 0 }}>
              Bars = profit variance · Line = revenue variance trend
            </p>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: 'linear-gradient(135deg, #60A5FA, #1D4ED8)' }} />
              <span style={{ fontSize: '0.6rem', fontFamily: 'DM Mono, monospace', color: '#4a6285' }}>Ahead</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: 'linear-gradient(135deg, #FB923C, #9A3412)' }} />
              <span style={{ fontSize: '0.6rem', fontFamily: 'DM Mono, monospace', color: '#4a6285' }}>Behind</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 16, height: 1, background: '#34D399' }} />
              <span style={{ fontSize: '0.6rem', fontFamily: 'DM Mono, monospace', color: '#4a6285' }}>Rev trend</span>
            </div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={varianceData} margin={{ top: 8, right: 8, bottom: 0, left: -8 }} barCategoryGap="28%">
            <defs>
              <linearGradient id="refGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(99,179,237,0.15)" />
                <stop offset="100%" stopColor="rgba(99,179,237,0)" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke="rgba(99,179,237,0.06)" vertical={false} />
            <XAxis dataKey="month" {...AXIS} />
            <YAxis
              {...AXIS}
              tickFormatter={v => `${sym}${v >= 0 ? '+' : ''}${(v / 1000).toFixed(0)}K`}
              width={68}
            />
            {/* Subtle column hover backdrop — no white flash */}
            <Tooltip
              cursor={{ fill: 'rgba(148,163,184,0.04)', stroke: 'rgba(148,163,184,0.08)', strokeWidth: 1 }}
              content={<VarianceTooltip sym={sym} />}
            />
            <ReferenceLine
              y={0}
              stroke="rgba(148,163,184,0.25)"
              strokeWidth={1.5}
              strokeDasharray="0"
            />
            <Bar
              dataKey="profitVariance"
              name="Profit Variance"
              shape={<GradientBar />}
              isAnimationActive
              animationDuration={900}
              animationEasing="ease-out"
            >
              {varianceData.map((_, i) => (
                <Cell key={i} fill="transparent" />
              ))}
            </Bar>
            <Line
              dataKey="revenueVariance"
              name="Revenue Variance"
              type="monotone"
              stroke="#34D399"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={{ fill: '#34D399', r: 2.5, strokeWidth: 0 }}
              activeDot={{ r: 4, fill: '#34D399', stroke: 'rgba(52,211,153,0.3)', strokeWidth: 4 }}
              isAnimationActive
              animationDuration={1200}
              animationEasing="ease-out"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      {/* ── Budget vs Actuals Table ─────────────────────────────────────── */}
      <Card delay={0.15}>
        <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: '0 0 4px' }}>Budget vs Actuals Detail</h3>
        <p style={{ fontSize: '0.66rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: '0 0 16px' }}>Click column headers to sort</p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(99,179,237,0.1)' }}>
                {[
                  { key: 'month',    label: 'Month'         },
                  { key: 'budgRev',  label: 'Budget Rev'    },
                  { key: 'actRev',   label: 'Actual Rev'    },
                  { key: 'revVar',   label: 'Rev Variance'  },
                  { key: 'actCost',  label: 'Actual Cost'   },
                  { key: 'budgCost', label: 'Budget Cost'   },
                  { key: 'costVar',  label: 'Cost Variance' },
                  { key: 'margin',   label: 'Margin'        },
                ].map(col => (
                  <th key={col.key} style={thStyle}>{col.label}</th>
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
                    <td style={{ padding: '10px 12px', fontSize: '0.78rem', fontFamily: 'DM Mono, monospace', color: rv >= 0 ? '#38BDF8' : '#FB923C', fontWeight: 600 }}>{rv >= 0 ? '+' : ''}{formatCurrency(rv, true, sym)}</td>
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

      {/* ── Alert Detail ───────────────────────────────────────────────── */}
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
                style={{ display: 'flex', gap: 14, padding: '12px 16px', background: cfg.bg, border: `1px solid ${cfg.border}`, borderLeft: `3px solid ${cfg.colour}`, borderRadius: '0 10px 10px 0', alignItems: 'flex-start' }}
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
