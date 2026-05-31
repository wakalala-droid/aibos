'use client';

export const dynamic = 'force-dynamic';

import { motion } from 'framer-motion';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell,
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

// ── Anomaly stat card — glow only, no accent border ────────────────────────────
function AnomalyStatCard({ label, value, suffix, colour, glow, delay = 0, pulse = false }: {
  label: string; value: number | string; suffix: string;
  colour: string; glow: string; delay?: number; pulse?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={pulse
        ? { opacity: 1, y: 0 }
        : { opacity: 1, y: 0 }}
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
      {/* Pulse ring for critical */}
      {pulse && (
        <motion.div
          animate={{ opacity: [0, 0.35, 0], scale: [0.85, 1.15, 0.85] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          style={{ position: 'absolute', inset: 0, borderRadius: 14, border: `1px solid ${colour}`, pointerEvents: 'none' }}
        />
      )}

      {/* Ambient glow orb */}
      <div style={{ position: 'absolute', top: -32, right: -32, width: 100, height: 100, borderRadius: '50%', background: `radial-gradient(circle, ${glow}, transparent 70%)`, pointerEvents: 'none' }} />
      {/* Floor gradient */}
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 80% 0%, ${colour}09 0%, transparent 65%)`, pointerEvents: 'none' }} />

      <p style={{ fontSize: '0.6rem', fontFamily: 'DM Mono, monospace', color: '#4a6285', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 14px' }}>{label}</p>

      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: delay + 0.15 }}
        style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'Outfit, sans-serif', color: colour, margin: 0, letterSpacing: '-0.03em', lineHeight: 1 }}
      >
        {value}<span style={{ fontSize: '1rem', fontWeight: 400, fontFamily: 'DM Mono, monospace', marginLeft: 4 }}>{suffix}</span>
      </motion.p>
    </motion.div>
  );
}

// ── Z-score gauge ──────────────────────────────────────────────────────────────
function ZScoreGauge({ score, colour }: { score: number; colour: string }) {
  const pct = Math.min((score / 5) * 100, 100);
  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: '0.58rem', color: '#2d4a70', fontFamily: 'DM Mono, monospace' }}>0σ</span>
        <span style={{ fontSize: '0.58rem', color: '#f59e0b', fontFamily: 'DM Mono, monospace' }}>2σ</span>
        <span style={{ fontSize: '0.58rem', color: '#ef4444', fontFamily: 'DM Mono, monospace' }}>3σ+</span>
      </div>
      <div style={{ height: 5, background: 'rgba(99,179,237,0.07)', borderRadius: 999, overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', left: '40%', top: 0, bottom: 0, width: 1, background: 'rgba(245,158,11,0.35)' }} />
        <div style={{ position: 'absolute', left: '60%', top: 0, bottom: 0, width: 1, background: 'rgba(239,68,68,0.35)' }} />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
          style={{ height: '100%', borderRadius: 999, background: colour, boxShadow: `0 0 8px ${colour}80` }}
        />
      </div>
      <div style={{ textAlign: 'right', marginTop: 4 }}>
        <span style={{ fontSize: '0.68rem', fontFamily: 'DM Mono, monospace', color: colour, fontWeight: 600 }}>{score.toFixed(1)}σ</span>
      </div>
    </div>
  );
}

// ── Scatter tooltip ────────────────────────────────────────────────────────────
function AnomalyTooltip({ active, payload, sym }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background:     'rgba(7,10,24,0.97)',
      border:         `1px solid ${d.colour}30`,
      borderRadius:   12,
      padding:        '12px 16px',
      boxShadow:      `0 16px 48px rgba(0,0,0,0.6), 0 0 20px ${d.colour}10`,
      backdropFilter: 'blur(16px)',
    }}>
      <p style={{ fontSize: '0.78rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: '0 0 6px' }}>{d.month}</p>
      <p style={{ fontSize: '0.68rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: '0 0 4px' }}>Costs: {formatCurrency(d.y, true, sym)}</p>
      <p style={{ fontSize: '0.68rem', color: d.colour, fontFamily: 'DM Mono, monospace', margin: 0, fontWeight: 600 }}>Z-score: {d.z.toFixed(2)}σ</p>
    </div>
  );
}

// ── Scatter data builder ───────────────────────────────────────────────────────
function buildScatterData(monthly: ReturnType<typeof useStore.getState>['monthly']) {
  if (!monthly.length) return { data: [], mean: 0, std: 0 };
  const mean = monthly.reduce((s, m) => s + m.costs, 0) / monthly.length;
  const std  = Math.sqrt(monthly.reduce((s, m) => s + Math.pow(m.costs - mean, 2), 0) / monthly.length) || 1;
  return {
    data: monthly.map((m, i) => {
      const z = Math.abs((m.costs - mean) / std);
      return {
        x:      i + 1,
        y:      m.costs,
        z,
        month:  m.month,
        colour: z >= 3 ? '#EF4444' : z >= 2 ? '#F59E0B' : '#60A5FA',
      };
    }),
    mean,
    std,
  };
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function AnomalyPage() {
  const anomalies  = useStore(s => s.anomalies);
  const monthly    = useStore(s => s.monthly);
  const sym        = useStore(s => s.currencySymbol);
  const { data: scatterData, mean, std } = buildScatterData(monthly);

  const critCount = anomalies.filter(a => a.severity === 'critical').length;
  const highCount = anomalies.filter(a => a.severity === 'high').length;
  const avgZ      = anomalies.length
    ? +(anomalies.reduce((s, a) => s + a.zScore, 0) / anomalies.length).toFixed(1)
    : 0;

  const sigma2 = mean + 2 * std;
  const sigma3 = mean + 3 * std;

  const AXIS = {
    tick:     { fill: '#4a6285', fontSize: 11, fontFamily: 'DM Mono, monospace' },
    axisLine: { stroke: 'rgba(99,179,237,0.07)' },
    tickLine: false,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1400, margin: '0 auto' }}>

      {/* ── Stat cards ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        <AnomalyStatCard label="Total Anomalies" value={anomalies.length} suffix="detected" colour="#60A5FA" glow="rgba(96,165,250,0.10)"   delay={0}    />
        <AnomalyStatCard label="Critical (≥3σ)"  value={critCount}       suffix="flags"    colour="#EF4444" glow="rgba(239,68,68,0.12)"    delay={0.07} pulse={critCount > 0} />
        <AnomalyStatCard label="High (≥2σ)"      value={highCount}       suffix="flags"    colour="#F59E0B" glow="rgba(245,158,11,0.10)"   delay={0.14} />
        <AnomalyStatCard label="Avg Z-Score"      value={avgZ}            suffix="σ"        colour="#A78BFA" glow="rgba(167,139,250,0.10)"  delay={0.21} />
      </div>

      {/* ── Anomaly cards ─────────────────────────────────────────────── */}
      <section>
        <h2 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: '0 0 16px', letterSpacing: '-0.01em' }}>Detected Anomalies</h2>
        {anomalies.length === 0 ? (
          <Card>
            <p style={{ fontSize: '0.78rem', fontFamily: 'DM Mono, monospace', color: '#4a6285', textAlign: 'center', padding: '24px 0' }}>No anomalies detected</p>
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            {anomalies.map((anomaly, i) => {
              const cfg       = severityConfig[anomaly.severity];
              const deviation = ((anomaly.value - anomaly.expected) / (anomaly.expected || 1) * 100).toFixed(1);
              const isOver    = anomaly.value > anomaly.expected;
              return (
                <motion.div
                  key={anomaly.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.08 }}
                  style={{
                    background:     'rgba(9,13,30,0.88)',
                    backdropFilter: 'blur(20px)',
                    border:         `1px solid ${cfg.colour}18`,
                    borderRadius:   14,
                    padding:        '20px',
                    boxShadow:      `0 4px 28px rgba(0,0,0,0.35), 0 0 32px ${cfg.bg}`,
                    position:       'relative',
                    overflow:       'hidden',
                  }}
                >
                  {/* Glow orb */}
                  <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: `radial-gradient(circle, ${cfg.colour}20, transparent 70%)`, pointerEvents: 'none' }} />
                  {/* Floor */}
                  <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 80% 0%, ${cfg.colour}07 0%, transparent 60%)`, pointerEvents: 'none' }} />

                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.colour, boxShadow: `0 0 8px ${cfg.colour}90`, flexShrink: 0 }} />
                      <div>
                        <p style={{ fontSize: '0.84rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: 0 }}>{anomaly.field}</p>
                        <p style={{ fontSize: '0.62rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: 0 }}>{anomaly.month} · anomaly</p>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.58rem', fontFamily: 'DM Mono, monospace', color: cfg.colour, background: cfg.bg, border: `1px solid ${cfg.border}`, padding: '3px 9px', borderRadius: 5, flexShrink: 0 }}>
                      {cfg.label}
                    </span>
                  </div>

                  {/* Actual vs Expected */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                    <div style={{ background: `${cfg.colour}08`, border: `1px solid ${cfg.colour}15`, borderRadius: 8, padding: '10px 12px' }}>
                      <p style={{ fontSize: '0.58rem', fontFamily: 'DM Mono, monospace', color: '#4a6285', margin: '0 0 5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Actual</p>
                      <p style={{ fontSize: '1rem', fontWeight: 700, color: cfg.colour, fontFamily: 'Outfit, sans-serif', margin: 0 }}>
                        {anomaly.field.includes('Margin') ? `${anomaly.value}%` : formatCurrency(anomaly.value, true, sym)}
                      </p>
                    </div>
                    <div style={{ background: 'rgba(99,179,237,0.04)', border: '1px solid rgba(99,179,237,0.08)', borderRadius: 8, padding: '10px 12px' }}>
                      <p style={{ fontSize: '0.58rem', fontFamily: 'DM Mono, monospace', color: '#4a6285', margin: '0 0 5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Expected</p>
                      <p style={{ fontSize: '1rem', fontWeight: 700, color: '#4a6285', fontFamily: 'Outfit, sans-serif', margin: 0 }}>
                        {anomaly.field.includes('Margin') ? `${anomaly.expected}%` : formatCurrency(anomaly.expected, true, sym)}
                      </p>
                    </div>
                  </div>

                  {/* Deviation */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, padding: '6px 0', borderTop: '1px solid rgba(99,179,237,0.06)' }}>
                    <span style={{ fontSize: '0.66rem', fontFamily: 'DM Mono, monospace', color: '#4a6285' }}>Deviation</span>
                    <span style={{ fontSize: '0.74rem', fontFamily: 'DM Mono, monospace', color: isOver ? cfg.colour : '#34D399', fontWeight: 600 }}>
                      {isOver ? '+' : ''}{deviation}%
                    </span>
                  </div>

                  <ZScoreGauge score={anomaly.zScore} colour={cfg.colour} />
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Scatter plot ──────────────────────────────────────────────── */}
      <Card delay={0.2}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: '0 0 4px' }}>Cost Distribution — Anomaly Scatter</h3>
            <p style={{ fontSize: '0.65rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: 0 }}>Monthly cost values plotted · σ thresholds shown</p>
          </div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            {[['#60A5FA','Normal'],['#F59E0B','≥2σ'],['#EF4444','≥3σ']].map(([c, l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: c as string, boxShadow: `0 0 6px ${c}80` }} />
                <span style={{ fontSize: '0.58rem', fontFamily: 'DM Mono, monospace', color: '#4a6285' }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <ScatterChart margin={{ top: 8, right: 8, bottom: 16, left: -4 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.03)" />
            <XAxis dataKey="x" {...AXIS} label={{ value: 'Month Index', fill: '#2d4a70', fontSize: 10, fontFamily: 'DM Mono, monospace', position: 'insideBottom', offset: -8 }} />
            <YAxis dataKey="y" {...AXIS} tickFormatter={v => `${sym}${(v / 1000).toFixed(0)}K`} />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.025)', stroke: 'none' }} content={<AnomalyTooltip sym={sym} />} />
            {sigma2 > 0 && (
              <ReferenceLine y={sigma2} stroke="rgba(245,158,11,0.3)" strokeDasharray="6 3"
                label={{ value: '+2σ', fill: '#f59e0b', fontSize: 9, fontFamily: 'DM Mono, monospace', position: 'insideTopRight' }} />
            )}
            {sigma3 > 0 && (
              <ReferenceLine y={sigma3} stroke="rgba(239,68,68,0.3)" strokeDasharray="6 3"
                label={{ value: '+3σ', fill: '#ef4444', fontSize: 9, fontFamily: 'DM Mono, monospace', position: 'insideTopRight' }} />
            )}
            <Scatter data={scatterData} line={{ stroke: 'rgba(99,179,237,0.15)', strokeWidth: 1.5 }} lineType="joint">
              {scatterData.map((entry, i) => (
                <Cell key={i} fill={entry.colour} fillOpacity={0.85}
                  style={{ filter: `drop-shadow(0 0 4px ${entry.colour}70)` }} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </Card>

      {/* ── Z-score table ─────────────────────────────────────────────── */}
      <Card delay={0.25}>
        <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: '0 0 16px' }}>Full Z-Score Analysis</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(99,179,237,0.08)' }}>
                {['Month','Field','Actual','Expected','Deviation','Z-Score','Severity'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: '0.6rem', fontFamily: 'DM Mono, monospace', color: '#4a6285', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {anomalies.map((a, i) => {
                const cfg = severityConfig[a.severity];
                const dev = ((a.value - a.expected) / (a.expected || 1) * 100).toFixed(1);
                return (
                  <motion.tr
                    key={a.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.06 }}
                    style={{ borderBottom: '1px solid rgba(99,179,237,0.05)', transition: 'background .15s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(99,179,237,0.03)'}
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
                    <td style={{ padding: '10px 12px', fontSize: '0.78rem', fontFamily: 'DM Mono, monospace', color: a.value > a.expected ? cfg.colour : '#34D399', fontWeight: 600 }}>
                      {a.value > a.expected ? '+' : ''}{dev}%
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: '0.8rem', fontFamily: 'DM Mono, monospace', color: cfg.colour, fontWeight: 700 }}>{a.zScore.toFixed(1)}σ</span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: '0.6rem', fontFamily: 'DM Mono, monospace', color: cfg.colour, background: cfg.bg, border: `1px solid ${cfg.border}`, padding: '2px 9px', borderRadius: 4 }}>{cfg.label}</span>
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
