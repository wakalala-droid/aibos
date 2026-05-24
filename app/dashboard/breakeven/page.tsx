'use client';

import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart
} from 'recharts';
import { useStore } from '@/lib/store';
import { useCounter } from '@/hooks/useCounter';
import { formatCurrency } from '@/lib/utils';

function Card({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay }}
      style={{ background: 'rgba(9,13,30,0.72)', backdropFilter: 'blur(16px)', border: '1px solid rgba(99,179,237,0.12)', borderRadius: 16, padding: '22px 24px', boxShadow: '0 4px 24px rgba(0,0,0,0.3)', position: 'relative', overflow: 'hidden' }}
    >
      <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(99,179,237,0.3), transparent)' }} />
      {children}
    </motion.div>
  );
}

// Build breakeven chart data
function buildBreakevenCurve(fixed: number, varRate: number) {
  return Array.from({ length: 21 }, (_, i) => {
    const revenue = i * 20000;
    const totalCost = fixed + revenue * varRate;
    return {
      revenue,
      totalCost,
      fixedCost: fixed,
      profit: revenue - totalCost,
    };
  });
}

function BETooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(9,13,30,0.96)', border: '1px solid rgba(99,179,237,0.25)', borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
      <p style={{ fontSize: '0.7rem', fontFamily: 'DM Mono, monospace', color: '#4a6285', margin: '0 0 8px' }}>Revenue: {formatCurrency(label, true)}</p>
      {payload.map((e: any) => (
        <div key={e.name} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: e.stroke || e.color, marginTop: 3, flexShrink: 0 }}/>
          <span style={{ fontSize: '0.7rem', color: '#4a6285', fontFamily: 'DM Mono, monospace' }}>{e.name}:</span>
          <span style={{ fontSize: '0.76rem', color: e.value >= 0 ? '#e2eeff' : '#ef4444', fontFamily: 'Outfit, sans-serif', fontWeight: 500 }}>{formatCurrency(e.value, true)}</span>
        </div>
      ))}
    </div>
  );
}

// Contribution margin gauge
function ContribGauge({ pct, colour }: { pct: number; colour: string }) {
  const animated = useCounter(pct, { duration: 1200, delay: 300, decimals: 1 });
  const R = 44, C = 2 * Math.PI * R;
  const arc = C * (1 - animated / 100);
  return (
    <svg width={108} height={108} viewBox="0 0 108 108">
      <circle cx={54} cy={54} r={R} fill="none" stroke="rgba(99,179,237,0.1)" strokeWidth={9}/>
      <motion.circle
        cx={54} cy={54} r={R} fill="none"
        stroke={colour} strokeWidth={9}
        strokeLinecap="round"
        strokeDasharray={C}
        initial={{ strokeDashoffset: C }}
        animate={{ strokeDashoffset: arc }}
        transition={{ duration: 1.2, delay: 0.3 }}
        transform="rotate(-90 54 54)"
      />
      <text x={54} y={50} textAnchor="middle" fill="#e2eeff" fontSize={18} fontWeight={700} fontFamily="Outfit, sans-serif">{animated.toFixed(1)}</text>
      <text x={54} y={64} textAnchor="middle" fill={colour} fontSize={9} fontFamily="DM Mono, monospace" letterSpacing="0.05em">%</text>
    </svg>
  );
}

export default function BreakevenPage() {
  const be = useStore(s => s.breakeven);
  const varRate = 1 - be.contributionMargin / 100;
  const curve = buildBreakevenCurve(be.fixedCosts, varRate);

  const gap    = useCounter(be.gap,                 { duration: 1100, delay: 0 });
  const current = useCounter(be.currentRevenue,     { duration: 1100, delay: 80 });
  const beRev  = useCounter(be.breakevenRevenue,    { duration: 1100, delay: 160 });

  const AXIS = { tick: { fill: '#4a6285', fontSize: 11, fontFamily: 'DM Mono, monospace' }, axisLine: { stroke: 'rgba(99,179,237,0.1)' }, tickLine: false };

  // Sensitivity: what if variable costs change?
  const sensitivity = [-20, -10, 0, 10, 20].map(delta => {
    const newVarRate = varRate * (1 + delta / 100);
    const newBE = be.fixedCosts / (1 - newVarRate);
    return { delta: `${delta >= 0 ? '+' : ''}${delta}%`, breakevenRevenue: Math.round(newBE), change: Math.round(newBE - be.breakevenRevenue) };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1400, margin: '0 auto' }}>

      {/* Status hero */}
      <Card delay={0}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <div style={{ textAlign: 'center' }}>
            <ContribGauge pct={be.contributionMargin} colour="#10b981"/>
            <p style={{ fontSize: '0.62rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', marginTop: 4 }}>Contribution Margin</p>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 12px rgba(16,185,129,0.6)' }}/>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: '#10b981', fontFamily: 'Outfit, sans-serif' }}>
                {be.status === 'above' ? 'Above Breakeven' : 'Below Breakeven'}
              </span>
            </div>
            <p style={{ fontSize: '0.72rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: '0 0 20px', lineHeight: 1.6 }}>
              Current revenue of {formatCurrency(be.currentRevenue, true)} exceeds the breakeven point of {formatCurrency(be.breakevenRevenue, true)} by {formatCurrency(be.gap, true)} ({((be.gap / be.breakevenRevenue) * 100).toFixed(0)}% safety margin).
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {[
                { label: 'Current Revenue', value: formatCurrency(be.currentRevenue, true), colour: '#60a5fa' },
                { label: 'Breakeven Point', value: formatCurrency(be.breakevenRevenue, true), colour: '#f59e0b' },
                { label: 'Safety Margin',   value: `+${formatCurrency(be.gap, true)}`, colour: '#10b981' },
              ].map(item => (
                <div key={item.label} style={{ background: 'rgba(99,179,237,0.04)', borderRadius: 10, padding: '12px 14px' }}>
                  <p style={{ fontSize: '0.6rem', fontFamily: 'DM Mono, monospace', color: '#4a6285', textTransform: 'uppercase', margin: '0 0 4px' }}>{item.label}</p>
                  <p style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'Outfit, sans-serif', color: item.colour, margin: 0 }}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Breakeven chart */}
      <Card delay={0.1}>
        <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: '0 0 4px' }}>Breakeven Chart</h3>
        <p style={{ fontSize: '0.68rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: '0 0 20px' }}>Revenue vs total costs · intersection = breakeven · shaded = profit zone</p>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={curve} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
            <defs>
              <linearGradient id="profitZone" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.12}/>
                <stop offset="100%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,179,237,0.07)" />
            <XAxis dataKey="revenue" {...AXIS} tickFormatter={v => `$${v/1000}K`}/>
            <YAxis {...AXIS} tickFormatter={v => `$${v/1000}K`}/>
            <Tooltip content={<BETooltip/>}/>
            <ReferenceLine x={be.breakevenRevenue} stroke="rgba(245,158,11,0.5)" strokeDasharray="6 3"
              label={{ value: `BE: ${formatCurrency(be.breakevenRevenue, true)}`, fill: '#f59e0b', fontSize: 10, fontFamily: 'DM Mono, monospace' }}/>
            <ReferenceLine x={be.currentRevenue} stroke="rgba(96,165,250,0.5)" strokeDasharray="6 3"
              label={{ value: `Now: ${formatCurrency(be.currentRevenue, true)}`, fill: '#60a5fa', fontSize: 10, fontFamily: 'DM Mono, monospace' }}/>
            <Line type="monotone" dataKey="revenue"   name="Revenue"     stroke="#60a5fa" strokeWidth={2.5} dot={false}/>
            <Line type="monotone" dataKey="totalCost" name="Total Costs" stroke="#ef4444" strokeWidth={2.5} dot={false} strokeDasharray="8 4"/>
            <Line type="monotone" dataKey="fixedCost" name="Fixed Costs" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="4 4" opacity={0.6}/>
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Cost structure + sensitivity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Cost structure */}
        <Card delay={0.15}>
          <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: '0 0 16px' }}>Cost Structure</h3>
          {[
            { label: 'Fixed Costs',    value: be.fixedCosts,    pct: (be.fixedCosts / (be.fixedCosts + be.variableCosts) * 100).toFixed(0),    colour: '#f59e0b' },
            { label: 'Variable Costs', value: be.variableCosts, pct: (be.variableCosts / (be.fixedCosts + be.variableCosts) * 100).toFixed(0), colour: '#60a5fa' },
          ].map(item => (
            <div key={item.label} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: '0.75rem', color: '#d4ddf0', fontFamily: 'Outfit, sans-serif' }}>{item.label}</span>
                <div style={{ display: 'flex', gap: 10 }}>
                  <span style={{ fontSize: '0.75rem', color: item.colour, fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>{formatCurrency(item.value, true)}</span>
                  <span style={{ fontSize: '0.65rem', color: '#4a6285', fontFamily: 'DM Mono, monospace' }}>{item.pct}%</span>
                </div>
              </div>
              <div style={{ height: 8, background: 'rgba(99,179,237,0.08)', borderRadius: 999, overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${item.pct}%` }}
                  transition={{ duration: 1, delay: 0.4 }}
                  style={{ height: '100%', borderRadius: 999, background: item.colour }}
                />
              </div>
            </div>
          ))}
          <div style={{ marginTop: 20, padding: '12px 14px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10 }}>
            <p style={{ fontSize: '0.62rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: '0 0 4px', textTransform: 'uppercase' }}>Contribution Margin</p>
            <p style={{ fontSize: '1.3rem', fontWeight: 700, color: '#10b981', fontFamily: 'Outfit, sans-serif', margin: 0 }}>{be.contributionMargin}%</p>
            <p style={{ fontSize: '0.62rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: '4px 0 0' }}>For every $1 of revenue, ${(be.contributionMargin/100).toFixed(2)} covers fixed costs & profit</p>
          </div>
        </Card>

        {/* Sensitivity table */}
        <Card delay={0.2}>
          <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: '0 0 4px' }}>Variable Cost Sensitivity</h3>
          <p style={{ fontSize: '0.65rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: '0 0 16px' }}>How breakeven shifts if variable costs change</p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(99,179,237,0.1)' }}>
                {['VC Change', 'New Breakeven', 'Δ vs Base'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: '0.6rem', fontFamily: 'DM Mono, monospace', color: '#4a6285', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sensitivity.map((row, i) => (
                <motion.tr
                  key={row.delta}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.06 }}
                  style={{
                    borderBottom: '1px solid rgba(99,179,237,0.05)',
                    background: row.delta === '0%' ? 'rgba(99,179,237,0.06)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '9px 10px', fontSize: '0.75rem', fontFamily: 'DM Mono, monospace', color: row.delta === '0%' ? '#60a5fa' : '#d4ddf0', fontWeight: row.delta === '0%' ? 600 : 400 }}>
                    {row.delta === '0%' ? `${row.delta} (Base)` : row.delta}
                  </td>
                  <td style={{ padding: '9px 10px', fontSize: '0.78rem', fontFamily: 'Outfit, sans-serif', color: '#e2eeff', fontWeight: 500 }}>{formatCurrency(row.breakevenRevenue, true)}</td>
                  <td style={{ padding: '9px 10px', fontSize: '0.75rem', fontFamily: 'DM Mono, monospace', color: row.change <= 0 ? '#10b981' : '#ef4444', fontWeight: 500 }}>
                    {row.change === 0 ? '—' : (row.change > 0 ? '+' : '') + formatCurrency(row.change, true)}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
