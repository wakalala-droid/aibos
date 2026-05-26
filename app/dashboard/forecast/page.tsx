'use client';

export const dynamic = 'force-dynamic';

import { motion } from 'framer-motion';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';
import { useStore } from '@/lib/store';
import { KPICard } from '@/components/cards/KPICard';
import { formatCurrency } from '@/lib/utils';

function Card({ children, delay = 0, style = {} }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay }}
      style={{ background: 'rgba(9,13,30,0.72)', backdropFilter: 'blur(16px)', border: '1px solid rgba(99,179,237,0.12)', borderRadius: 16, padding: '22px 24px', boxShadow: '0 4px 24px rgba(0,0,0,0.3)', position: 'relative', overflow: 'hidden', ...style }}
    >
      <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(99,179,237,0.3), transparent)' }} />
      {children}
    </motion.div>
  );
}

function ForecastTooltip({ active, payload, label }: any) {
  const sym = useStore(s => s.currencySymbol);
  if (!active || !payload?.length) return null;
  const relevant = payload.filter((p: any) => p.value !== null && p.value !== undefined);
  return (
    <div style={{ background: 'rgba(9,13,30,0.96)', border: '1px solid rgba(99,179,237,0.25)', borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
      <p style={{ fontSize: '0.7rem', fontFamily: 'DM Mono, monospace', color: '#4a6285', margin: '0 0 8px' }}>{label}</p>
      {relevant.map((e: any) => (
        <div key={e.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: e.color || e.stroke, flexShrink: 0 }} />
          <span style={{ fontSize: '0.7rem', color: '#4a6285', fontFamily: 'DM Mono, monospace' }}>{e.name}:</span>
          <span style={{ fontSize: '0.76rem', color: '#e2eeff', fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>{formatCurrency(e.value, true, sym)}</span>
        </div>
      ))}
    </div>
  );
}

export default function ForecastPage() {
  const forecast = useStore(s => s.forecast);
  const sym = useStore(s => s.currencySymbol);
  const monthly  = useStore(s => s.monthly);
  const kpi      = useStore(s => s.kpi);

  const forecastMonths = forecast.filter(f => f.forecast !== undefined);
  const totalForecastRevenue = forecastMonths.reduce((s, f) => s + (f.forecast ?? 0), 0);
  const avgForecastGrowth = 11.2; // % QoQ based on trajectory
  const forecastAccuracy  = 94.3; // mock confidence score

  const AXIS = { tick: { fill: '#4a6285', fontSize: 11, fontFamily: 'DM Mono, monospace' }, axisLine: { stroke: 'rgba(99,179,237,0.1)' }, tickLine: false };

  // Scenarios
  const scenarios = [
    { label: 'Bear Case',  multiplier: 0.88, colour: '#ef4444', description: 'Slowdown in Q1 + cost pressure' },
    { label: 'Base Case',  multiplier: 1.00, colour: '#60a5fa', description: 'Continuation of current trajectory' },
    { label: 'Bull Case',  multiplier: 1.15, colour: '#10b981', description: 'Q4 momentum accelerates into Q1' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1400, margin: '0 auto' }}>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        <KPICard title="Q1 Forecast"     value={forecastMonths[0]?.forecast ?? 0} format="currency" compact colour="#60a5fa" index={0} />
        <KPICard title="3-Month Total"   value={totalForecastRevenue} format="currency" compact colour="#a78bfa" index={1} />
        <KPICard title="QoQ Growth Est." value={avgForecastGrowth} format="percent" colour="#10b981" index={2} />
        <KPICard title="Forecast Confidence" value={forecastAccuracy} format="percent" colour="#06b6d4" index={3} subtitle="Model accuracy" />
      </div>

      {/* Main forecast chart */}
      <Card delay={0.1}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: 0 }}>AI Revenue Forecast</h3>
            <p style={{ fontSize: '0.68rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: '3px 0 0' }}>Historical + 3-month AI prediction · 95% confidence interval</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, padding: '4px 10px' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', animation: 'pulse 2s ease-in-out infinite' }} />
            <span style={{ fontSize: '0.65rem', fontFamily: 'DM Mono, monospace', color: '#10b981' }}>Live model</span>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={forecast} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
            <defs>
              <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.3}/>
                <stop offset="100%" stopColor="#60a5fa" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.35}/>
                <stop offset="100%" stopColor="#a78bfa" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.12}/>
                <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.04}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,179,237,0.07)" vertical={false}/>
            <XAxis dataKey="month" {...AXIS}/>
            <YAxis {...AXIS} tickFormatter={v => `${sym}${(v/1000).toFixed(0)}K`}/>
            <Tooltip content={<ForecastTooltip/>}/>
            <ReferenceLine x="Dec" stroke="rgba(99,179,237,0.3)" strokeDasharray="6 3" label={{ value: 'Forecast →', fill: '#4a6285', fontSize: 10, fontFamily: 'DM Mono, monospace' }}/>

            {/* Confidence band */}
            <Area type="monotone" dataKey="upper"  name="Upper bound" fill="url(#bandGrad)" stroke="transparent"/>
            <Area type="monotone" dataKey="lower"  name="Lower bound" fill="#03060d"         stroke="transparent"/>

            {/* Historical */}
            <Area type="monotone" dataKey="historical" name="Historical" stroke="#60a5fa" strokeWidth={2.5} fill="url(#histGrad)" dot={false}/>

            {/* Forecast line */}
            <Line type="monotone" dataKey="forecast" name="AI Forecast" stroke="#a78bfa" strokeWidth={2.5} strokeDasharray="8 4" dot={{ fill: '#a78bfa', r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }}/>
          </ComposedChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 20, marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(99,179,237,0.08)' }}>
          {[
            { colour: '#60a5fa', label: 'Historical revenue', solid: true },
            { colour: '#a78bfa', label: 'AI forecast',        solid: false },
            { colour: '#a78bfa', label: '95% confidence band', solid: true, opacity: 0.2 },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 20, height: 2,
                background: item.opacity ? `rgba(167,139,250,0.3)` : item.colour,
                borderRadius: 1,
                ...(item.solid ? {} : { backgroundImage: `repeating-linear-gradient(90deg, ${item.colour} 0, ${item.colour} 5px, transparent 5px, transparent 9px)`, background: 'none' }),
              }}/>
              <span style={{ fontSize: '0.65rem', fontFamily: 'DM Mono, monospace', color: '#4a6285' }}>{item.label}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Scenario planning */}
      <Card delay={0.15}>
        <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: '0 0 4px' }}>Scenario Planning</h3>
        <p style={{ fontSize: '0.68rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: '0 0 20px' }}>Bear / Base / Bull case Q1–Q3 revenue projections</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {scenarios.map((s, i) => {
            const q1 = Math.round((forecastMonths[0]?.forecast ?? 281000) * s.multiplier);
            const q2 = Math.round((forecastMonths[1]?.forecast ?? 296000) * s.multiplier);
            const q3 = Math.round((forecastMonths[2]?.forecast ?? 314000) * s.multiplier);
            const total = q1 + q2 + q3;
            return (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.08 }}
                style={{ padding: '16px', background: `${s.colour}0d`, border: `1px solid ${s.colour}30`, borderRadius: 12 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.colour, boxShadow: `0 0 8px ${s.colour}60` }}/>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: s.colour, fontFamily: 'Outfit, sans-serif' }}>{s.label}</span>
                </div>
                <p style={{ fontSize: '0.65rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: '0 0 14px', lineHeight: 1.5 }}>{s.description}</p>
                {[['Jan+1', q1], ['Feb+1', q2], ['Mar+1', q3]].map(([m, v]) => (
                  <div key={m as string} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.68rem', fontFamily: 'DM Mono, monospace', color: '#4a6285' }}>{m}</span>
                    <span style={{ fontSize: '0.76rem', fontFamily: 'Outfit, sans-serif', color: '#d4ddf0', fontWeight: 500 }}>{formatCurrency(v as number, true, sym)}</span>
                  </div>
                ))}
                <div style={{ height: 1, background: `${s.colour}25`, margin: '10px 0' }}/>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.68rem', fontFamily: 'DM Mono, monospace', color: '#4a6285' }}>Q Total</span>
                  <span style={{ fontSize: '0.84rem', fontFamily: 'Outfit, sans-serif', color: s.colour, fontWeight: 700 }}>{formatCurrency(total, true, sym)}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </Card>

      {/* Monthly forecast table */}
      <Card delay={0.2}>
        <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: '0 0 16px' }}>Forecast Detail</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(99,179,237,0.1)' }}>
                {['Period', 'Type', 'Revenue', 'Lower Bound', 'Upper Bound', 'Range Width'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: '0.63rem', fontFamily: 'DM Mono, monospace', color: '#4a6285', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {forecast.slice(-6).map((row, i) => {
                const isForecast = row.forecast !== undefined;
                const rev   = isForecast ? row.forecast! : row.historical!;
                const lower = row.lower ?? rev;
                const upper = row.upper ?? rev;
                return (
                  <motion.tr
                    key={row.month}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.05 }}
                    style={{ borderBottom: '1px solid rgba(99,179,237,0.05)', transition: 'background .15s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(99,179,237,0.04)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <td style={{ padding: '10px 12px', fontSize: '0.78rem', fontFamily: 'DM Mono, monospace', color: '#d4ddf0', fontWeight: 500 }}>{row.month}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: '0.6rem', fontFamily: 'DM Mono, monospace', color: isForecast ? '#a78bfa' : '#60a5fa', background: isForecast ? 'rgba(167,139,250,0.12)' : 'rgba(96,165,250,0.12)', border: `1px solid ${isForecast ? 'rgba(167,139,250,0.3)' : 'rgba(96,165,250,0.3)'}`, padding: '2px 8px', borderRadius: 4 }}>
                        {isForecast ? 'Forecast' : 'Historical'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '0.82rem', fontFamily: 'Outfit, sans-serif', color: '#e2eeff', fontWeight: 600 }}>{formatCurrency(rev, true, sym)}</td>
                    <td style={{ padding: '10px 12px', fontSize: '0.78rem', fontFamily: 'Outfit, sans-serif', color: '#4a6285' }}>{isForecast ? formatCurrency(lower, true, sym) : '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: '0.78rem', fontFamily: 'Outfit, sans-serif', color: '#4a6285' }}>{isForecast ? formatCurrency(upper, true, sym) : '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: '0.78rem', fontFamily: 'DM Mono, monospace', color: '#f59e0b' }}>{isForecast ? formatCurrency(upper - lower, true, sym) : '—'}</td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
