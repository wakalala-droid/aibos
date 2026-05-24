'use client';

import { motion } from 'framer-motion';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useStore } from '@/lib/store';
import { KPICard } from '@/components/cards/KPICard';
import { formatCurrency } from '@/lib/utils';

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(9,13,30,0.95)', border: '1px solid rgba(99,179,237,0.25)', borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
      <p style={{ fontSize: '0.72rem', fontFamily: 'DM Mono, monospace', color: '#4a6285', margin: '0 0 8px' }}>{label}</p>
      {payload.map((e: any) => (
        <div key={e.name} style={{ display: 'flex', gap: 8, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: e.color, flexShrink: 0, marginTop: 3 }} />
          <span style={{ fontSize: '0.72rem', color: '#4a6285', fontFamily: 'DM Mono, monospace' }}>{e.name}:</span>
          <span style={{ fontSize: '0.78rem', color: '#e2eeff', fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>{formatCurrency(e.value, true)}</span>
        </div>
      ))}
    </div>
  );
}

function Card({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      style={{ background: 'rgba(9,13,30,0.72)', backdropFilter: 'blur(16px)', border: '1px solid rgba(99,179,237,0.12)', borderRadius: 16, padding: '22px 24px', boxShadow: '0 4px 24px rgba(0,0,0,0.3)', position: 'relative', overflow: 'hidden' }}
    >
      <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(99,179,237,0.3), transparent)' }} />
      {children}
    </motion.div>
  );
}

export default function CashPage() {
  const cf = useStore(s => s.cashflow);
  const AXIS = { tick: { fill: '#4a6285', fontSize: 11, fontFamily: 'DM Mono, monospace' }, axisLine: { stroke: 'rgba(99,179,237,0.1)' }, tickLine: false };

  // Burn rate progress
  const runwayPct  = Math.min((cf.runway / 24) * 100, 100);
  const runwayColour = cf.runway >= 18 ? '#10b981' : cf.runway >= 12 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1400, margin: '0 auto' }}>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        <KPICard title="Cash Position"  value={cf.currentCash}  format="currency" compact colour="#06b6d4" index={0} />
        <KPICard title="Monthly Burn"   value={cf.monthlyBurn}  format="currency" compact colour="#ef4444" index={1} />
        <KPICard title="Cash Runway"    value={cf.runway}       format="months"   colour={runwayColour}   index={2} />
        <KPICard title="6M Projection"  value={cf.projections[5].cash} format="currency" compact colour="#10b981" index={3} />
      </div>

      {/* Runway gauge */}
      <Card delay={0.1}>
        <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: '0 0 6px' }}>Cash Runway Status</h3>
        <p style={{ fontSize: '0.68rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: '0 0 20px' }}>
          {cf.runway} months remaining · Target: 18 months · {cf.runway >= 18 ? '✓ On target' : '⚠ Below target'}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, height: 12, background: 'rgba(99,179,237,0.1)', borderRadius: 999, overflow: 'hidden' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${runwayPct}%` }}
              transition={{ duration: 1.2, delay: 0.3 }}
              style={{ height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${runwayColour}, ${runwayColour}cc)`, boxShadow: `0 0 12px ${runwayColour}60` }}
            />
          </div>
          <span style={{ fontSize: '0.8rem', fontFamily: 'DM Mono, monospace', color: runwayColour, fontWeight: 500, flexShrink: 0 }}>{cf.runway}mo / 24mo</span>
        </div>

        {/* Month markers */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          {[0, 6, 12, 18, 24].map(m => (
            <span key={m} style={{ fontSize: '0.6rem', color: m === 18 ? '#f59e0b' : '#2d4a70', fontFamily: 'DM Mono, monospace' }}>{m}mo{m === 18 ? ' ⚑' : ''}</span>
          ))}
        </div>
      </Card>

      {/* Cash position chart */}
      <Card delay={0.15}>
        <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: '0 0 4px' }}>Projected Cash Position</h3>
        <p style={{ fontSize: '0.68rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: '0 0 20px' }}>6-month forward projection based on current trajectory</p>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={cf.projections} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
            <defs>
              <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.4}/>
                <stop offset="100%" stopColor="#06b6d4" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,179,237,0.07)" vertical={false}/>
            <XAxis dataKey="month" {...AXIS}/>
            <YAxis {...AXIS} tickFormatter={v => `$${v/1000}K`}/>
            <Tooltip content={<CustomTooltip/>}/>
            <Area type="monotone" dataKey="cash" name="Cash Balance" stroke="#06b6d4" strokeWidth={2.5} fill="url(#cashGrad)"/>
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Inflow vs Outflow */}
      <Card delay={0.2}>
        <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: '0 0 4px' }}>Inflow vs Outflow</h3>
        <p style={{ fontSize: '0.68rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: '0 0 20px' }}>Monthly cash movements · 6-month projection</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={cf.projections} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,179,237,0.07)" vertical={false}/>
            <XAxis dataKey="month" {...AXIS}/>
            <YAxis {...AXIS} tickFormatter={v => `$${v/1000}K`}/>
            <Tooltip content={<CustomTooltip/>}/>
            <Bar dataKey="inflow"  name="Inflow"  fill="#10b981" fillOpacity={0.8} radius={[3,3,0,0]}/>
            <Bar dataKey="outflow" name="Outflow" fill="#ef4444" fillOpacity={0.7} radius={[3,3,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Projection table */}
      <Card delay={0.25}>
        <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: '0 0 16px' }}>Monthly Projection Detail</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(99,179,237,0.1)' }}>
                {['Month', 'Opening Cash', 'Inflow', 'Outflow', 'Net', 'Closing Cash'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: '0.65rem', fontFamily: 'DM Mono, monospace', color: '#4a6285', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cf.projections.map((row, i) => {
                const prev = i === 0 ? cf.currentCash : cf.projections[i - 1].cash;
                const net  = row.inflow - row.outflow;
                return (
                  <motion.tr
                    key={row.month}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                    style={{ borderBottom: '1px solid rgba(99,179,237,0.05)' }}
                  >
                    {[
                      row.month,
                      formatCurrency(prev, true),
                      formatCurrency(row.inflow, true),
                      formatCurrency(row.outflow, true),
                      formatCurrency(net, true),
                      formatCurrency(row.cash, true),
                    ].map((cell, ci) => (
                      <td key={ci} style={{ padding: '10px 12px', fontSize: '0.78rem', fontFamily: ci === 0 ? 'DM Mono, monospace' : 'Outfit, sans-serif', color: ci === 4 ? (net >= 0 ? '#10b981' : '#ef4444') : ci === 5 ? '#e2eeff' : '#d4ddf0', fontWeight: ci >= 4 ? 500 : 400 }}>
                        {cell}
                      </td>
                    ))}
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
