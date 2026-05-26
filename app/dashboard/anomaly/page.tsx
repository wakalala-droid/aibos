'use client';

export const dynamic = 'force-dynamic';

import { motion } from 'framer-motion';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts';
import { useStore, severityConfig } from '@/lib/store';
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

// Z-score gauge
function ZScoreGauge({ score, colour }: { score: number; colour: string }) {
  const MAX = 5;
  const pct = Math.min((score / MAX) * 100, 100);
  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: '0.6rem', color: '#2d4a70', fontFamily: 'DM Mono, monospace' }}>0σ</span>
        <span style={{ fontSize: '0.6rem', color: '#f59e0b', fontFamily: 'DM Mono, monospace' }}>2σ</span>
        <span style={{ fontSize: '0.6rem', color: '#ef4444', fontFamily: 'DM Mono, monospace' }}>3σ+</span>
      </div>
      <div style={{ height: 6, background: 'rgba(99,179,237,0.08)', borderRadius: 999, overflow: 'hidden', position: 'relative' }}>
        {/* Threshold markers */}
        <div style={{ position: 'absolute', left: '40%', top: 0, bottom: 0, width: 1, background: 'rgba(245,158,11,0.4)' }}/>
        <div style={{ position: 'absolute', left: '60%', top: 0, bottom: 0, width: 1, background: 'rgba(239,68,68,0.4)' }}/>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ height: '100%', borderRadius: 999, background: colour, boxShadow: `0 0 8px ${colour}80` }}
        />
      </div>
      <div style={{ textAlign: 'right', marginTop: 3 }}>
        <span style={{ fontSize: '0.7rem', fontFamily: 'DM Mono, monospace', color: colour, fontWeight: 500 }}>{score.toFixed(1)}σ</span>
      </div>
    </div>
  );
}

// All monthly data for scatter
function buildScatterData(monthly: ReturnType<typeof useStore.getState>['monthly']) {
  const mean = monthly.reduce((s, m) => s + m.costs, 0) / monthly.length;
  const std  = Math.sqrt(monthly.reduce((s, m) => s + Math.pow(m.costs - mean, 2), 0) / monthly.length);
  return monthly.map((m, i) => ({
    x: i + 1,
    y: m.costs,
    z: Math.abs((m.costs - mean) / std),
    month: m.month,
    colour: Math.abs((m.costs - mean) / std) >= 3 ? '#ef4444' : Math.abs((m.costs - mean) / std) >= 2 ? '#f59e0b' : '#60a5fa',
  }));
}

function AnomalyTooltip({ active, payload }: any) {
  const sym = useStore(s => s.currencySymbol);
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: 'rgba(9,13,30,0.95)', border: '1px solid rgba(99,179,237,0.25)', borderRadius: 10, padding: '10px 14px' }}>
      <p style={{ fontSize: '0.78rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: '0 0 4px' }}>{d.month}</p>
      <p style={{ fontSize: '0.7rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: '0 0 3px' }}>Costs: {formatCurrency(d.y, true, sym)}</p>
      <p style={{ fontSize: '0.7rem', color: d.colour, fontFamily: 'DM Mono, monospace', margin: 0 }}>Z-score: {d.z.toFixed(2)}σ</p>
    </div>
  );
}

export default function AnomalyPage() {
  const anomalies = useStore(s => s.anomalies);
  const sym = useStore(s => s.currencySymbol);
  const monthly   = useStore(s => s.monthly);
  const scatterData = buildScatterData(monthly);

  const critCount = anomalies.filter(a => a.severity === 'critical').length;
  const highCount = anomalies.filter(a => a.severity === 'high').length;

  const AXIS = { tick: { fill: '#4a6285', fontSize: 11, fontFamily: 'DM Mono, monospace' }, axisLine: { stroke: 'rgba(99,179,237,0.1)' }, tickLine: false };

  // Normal distribution curve data (mock)
  const normalCurve = Array.from({ length: 40 }, (_, i) => {
    const x = -3.5 + i * 0.175;
    const y = (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x) * 100;
    return { x: parseFloat(x.toFixed(2)), y };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1400, margin: '0 auto' }}>

      {/* Summary bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[
          { label: 'Total Anomalies', value: anomalies.length,     colour: '#60a5fa', suffix: ' detected' },
          { label: 'Critical (≥3σ)',  value: critCount,            colour: '#ef4444', suffix: ' flags' },
          { label: 'High (≥2σ)',      value: highCount,            colour: '#f59e0b', suffix: ' flags' },
          { label: 'Avg Z-Score',     value: +(anomalies.reduce((s, a) => s + a.zScore, 0) / anomalies.length).toFixed(1), colour: '#a78bfa', suffix: 'σ' },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            style={{ background: 'rgba(9,13,30,0.72)', backdropFilter: 'blur(16px)', border: '1px solid rgba(99,179,237,0.12)', borderRadius: 14, padding: '18px 20px', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}
          >
            <p style={{ fontSize: '0.63rem', fontFamily: 'DM Mono, monospace', color: '#4a6285', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>{item.label}</p>
            <p style={{ fontSize: '1.7rem', fontWeight: 700, fontFamily: 'Outfit, sans-serif', color: item.colour, margin: 0, letterSpacing: '-0.02em', lineHeight: 1 }}>
              {item.value}<span style={{ fontSize: '0.9rem', fontWeight: 400, fontFamily: 'DM Mono, monospace' }}>{item.suffix}</span>
            </p>
          </motion.div>
        ))}
      </div>

      {/* Anomaly cards */}
      <section>
        <h2 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: '0 0 16px' }}>Detected Anomalies</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          {anomalies.map((anomaly, i) => {
            const cfg = severityConfig[anomaly.severity];
            const deviation = ((anomaly.value - anomaly.expected) / anomaly.expected * 100).toFixed(1);
            const isOver = anomaly.value > anomaly.expected;
            return (
              <motion.div
                key={anomaly.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.08 }}
                style={{ background: 'rgba(9,13,30,0.72)', backdropFilter: 'blur(16px)', border: `1px solid ${cfg.border}`, borderRadius: 14, padding: '20px', boxShadow: '0 4px 24px rgba(0,0,0,0.3)', position: 'relative', overflow: 'hidden' }}
              >
                {/* Severity glow */}
                <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: `radial-gradient(circle, ${cfg.colour}20, transparent 70%)` }}/>

                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.colour, boxShadow: `0 0 8px ${cfg.colour}80`, flexShrink: 0 }}/>
                    <div>
                      <p style={{ fontSize: '0.84rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: 0 }}>{anomaly.field}</p>
                      <p style={{ fontSize: '0.65rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: 0 }}>{anomaly.month} anomaly</p>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.6rem', fontFamily: 'DM Mono, monospace', color: cfg.colour, background: cfg.bg, border: `1px solid ${cfg.border}`, padding: '3px 8px', borderRadius: 5, flexShrink: 0 }}>
                    {cfg.label}
                  </span>
                </div>

                {/* Values */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div style={{ background: 'rgba(99,179,237,0.04)', borderRadius: 8, padding: '10px 12px' }}>
                    <p style={{ fontSize: '0.6rem', fontFamily: 'DM Mono, monospace', color: '#4a6285', margin: '0 0 4px', textTransform: 'uppercase' }}>Actual</p>
                    <p style={{ fontSize: '1rem', fontWeight: 700, color: cfg.colour, fontFamily: 'Outfit, sans-serif', margin: 0 }}>
                      {anomaly.field.includes('Margin') ? `${anomaly.value}%` : formatCurrency(anomaly.value, true, sym)}
                    </p>
                  </div>
                  <div style={{ background: 'rgba(99,179,237,0.04)', borderRadius: 8, padding: '10px 12px' }}>
                    <p style={{ fontSize: '0.6rem', fontFamily: 'DM Mono, monospace', color: '#4a6285', margin: '0 0 4px', textTransform: 'uppercase' }}>Expected</p>
                    <p style={{ fontSize: '1rem', fontWeight: 700, color: '#4a6285', fontFamily: 'Outfit, sans-serif', margin: 0 }}>
                      {anomaly.field.includes('Margin') ? `${anomaly.expected}%` : formatCurrency(anomaly.expected, true, sym)}
                    </p>
                  </div>
                </div>

                {/* Deviation */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: '0.68rem', fontFamily: 'DM Mono, monospace', color: '#4a6285' }}>Deviation</span>
                  <span style={{ fontSize: '0.76rem', fontFamily: 'DM Mono, monospace', color: isOver ? '#ef4444' : '#10b981', fontWeight: 500 }}>
                    {isOver ? '+' : ''}{deviation}%
                  </span>
                </div>

                {/* Z-score gauge */}
                <ZScoreGauge score={anomaly.zScore} colour={cfg.colour}/>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Cost scatter plot */}
      <Card delay={0.2}>
        <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: '0 0 4px' }}>Cost Distribution — Anomaly Scatter</h3>
        <p style={{ fontSize: '0.68rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: '0 0 20px' }}>
          Monthly cost values plotted · Red = critical anomaly (≥3σ) · Amber = high (≥2σ)
        </p>
        <ResponsiveContainer width="100%" height={240}>
          <ScatterChart margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,179,237,0.07)"/>
            <XAxis dataKey="x" {...AXIS} label={{ value: 'Month Index', fill: '#4a6285', fontSize: 10, fontFamily: 'DM Mono, monospace', position: 'insideBottom', offset: -2 }}/>
            <YAxis dataKey="y" {...AXIS} tickFormatter={v => `${sym}${(v/1000).toFixed(0)}K`}/>
            <Tooltip content={<AnomalyTooltip/>}/>
            {/* ±2σ band */}
            <ReferenceLine y={130000} stroke="rgba(245,158,11,0.3)" strokeDasharray="6 3" label={{ value: '+2σ', fill: '#f59e0b', fontSize: 9, fontFamily: 'DM Mono, monospace' }}/>
            <ReferenceLine y={140000} stroke="rgba(239,68,68,0.3)" strokeDasharray="6 3" label={{ value: '+3σ', fill: '#ef4444', fontSize: 9, fontFamily: 'DM Mono, monospace' }}/>
            <Scatter data={scatterData} line={{ stroke: 'rgba(99,179,237,0.2)', strokeWidth: 1 }}>
              {scatterData.map((entry, i) => (
                <Cell key={i} fill={entry.colour} fillOpacity={0.85}/>
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </Card>

      {/* Z-score table */}
      <Card delay={0.25}>
        <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: '0 0 16px' }}>Full Z-Score Analysis</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(99,179,237,0.1)' }}>
                {['Month', 'Field', 'Actual', 'Expected', 'Deviation', 'Z-Score', 'Severity'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: '0.63rem', fontFamily: 'DM Mono, monospace', color: '#4a6285', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {anomalies.map((a, i) => {
                const cfg = severityConfig[a.severity];
                const dev = ((a.value - a.expected) / a.expected * 100).toFixed(1);
                return (
                  <motion.tr
                    key={a.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.06 }}
                    style={{ borderBottom: '1px solid rgba(99,179,237,0.05)', transition: 'background .15s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(99,179,237,0.04)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <td style={{ padding: '10px 12px', fontSize: '0.78rem', fontFamily: 'DM Mono, monospace', color: '#d4ddf0', fontWeight: 500 }}>{a.month}</td>
                    <td style={{ padding: '10px 12px', fontSize: '0.78rem', fontFamily: 'Outfit, sans-serif', color: '#d4ddf0' }}>{a.field}</td>
                    <td style={{ padding: '10px 12px', fontSize: '0.78rem', fontFamily: 'Outfit, sans-serif', color: '#e2eeff', fontWeight: 500 }}>
                      {a.field.includes('Margin') ? `${a.value}%` : formatCurrency(a.value, true, sym)}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '0.78rem', fontFamily: 'Outfit, sans-serif', color: '#4a6285' }}>
                      {a.field.includes('Margin') ? `${a.expected}%` : formatCurrency(a.expected, true, sym)}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '0.78rem', fontFamily: 'DM Mono, monospace', color: a.value > a.expected ? '#ef4444' : '#10b981', fontWeight: 500 }}>
                      {a.value > a.expected ? '+' : ''}{dev}%
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: '0.8rem', fontFamily: 'DM Mono, monospace', color: cfg.colour, fontWeight: 600 }}>{a.zScore.toFixed(1)}σ</span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: '0.6rem', fontFamily: 'DM Mono, monospace', color: cfg.colour, background: cfg.bg, border: `1px solid ${cfg.border}`, padding: '2px 8px', borderRadius: 4 }}>
                        {cfg.label}
                      </span>
                    </td>
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
