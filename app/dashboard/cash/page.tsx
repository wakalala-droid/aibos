'use client';

export const dynamic = 'force-dynamic';

import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { useStore } from '@/lib/store';
import { KPICard } from '@/components/cards/KPICard';
import { formatCurrency } from '@/lib/utils';

function Card({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay }}
      style={{ background: 'rgba(9,13,30,0.72)', backdropFilter: 'blur(16px)', border: '1px solid rgba(99,179,237,0.12)', borderRadius: 16, padding: '22px 24px', boxShadow: '0 4px 24px rgba(0,0,0,0.3)', position: 'relative', overflow: 'hidden' }}
    >
      <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: 'linear-gradient(90deg,transparent,rgba(99,179,237,0.3),transparent)' }} />
      {children}
    </motion.div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(9,13,30,0.96)', border: '1px solid rgba(99,179,237,0.25)', borderRadius: 10, padding: '10px 14px' }}>
      <p style={{ fontSize: '0.7rem', fontFamily: 'DM Mono, monospace', color: '#4a6285', margin: '0 0 8px' }}>{label}</p>
      {payload.map((e: any) => (
        <div key={e.name} style={{ display: 'flex', gap: 8, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: e.color || e.stroke, marginTop: 3, flexShrink: 0 }} />
          <span style={{ fontSize: '0.7rem', color: '#4a6285', fontFamily: 'DM Mono, monospace' }}>{e.name}:</span>
          <span style={{ fontSize: '0.76rem', color: '#e2eeff', fontFamily: 'Outfit, sans-serif', fontWeight: 500 }}>
            {formatCurrency(Number(e.value) || 0, true, sym)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function CashPage() {
  const cf  = useStore(s => s.cashflow);

  // Full null safety — never crash on empty/undefined data
  const rawProjections = cf?.projections ?? [];
  const projections    = rawProjections.filter((p: any) => p != null && typeof p.cash === 'number');
  const runway         = Number(cf?.runway)      || 0;
  const currentCash    = Number(cf?.currentCash) || 0;
  const monthlyBurn    = Number(cf?.monthlyBurn) || 0;

  const runwayPct    = Math.min((runway / 24) * 100, 100);
  const runwayColour = runway >= 18 ? '#10b981' : runway >= 12 ? '#f59e0b' : '#ef4444';

  const lastCash = projections.length > 0
    ? projections[projections.length - 1]?.cash ?? 0
    : 0;

  const AXIS = {
    tick: { fill: '#4a6285', fontSize: 11, fontFamily: 'DM Mono, monospace' },
    axisLine: { stroke: 'rgba(99,179,237,0.1)' },
    tickLine: false,
  };

  // If no projection data, show placeholder chart data from monthly
  const monthly = useStore(s => s.monthly);
  const chartData = projections.length > 0
    ? projections
    : monthly.slice(-6).map((m, i) => ({
        month:   m.month,
        cash:    currentCash + (m.profit * (i + 1)),
        inflow:  m.revenue,
        outflow: m.costs,
      }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1400, margin: '0 auto' }}>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        <KPICard title="Cash Position"  value={currentCash} format="currency" compact colour="#06b6d4" index={0} />
        <KPICard title="Monthly Burn"   value={monthlyBurn} format="currency" compact colour="#ef4444" index={1} />
        <KPICard title="Cash Runway"    value={runway}      format="months"   colour={runwayColour}   index={2} />
        <KPICard title="6M Projection"  value={lastCash}    format="currency" compact colour="#10b981" index={3} />
      </div>

      {/* Runway gauge */}
      <Card delay={0.1}>
        <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: '0 0 6px' }}>
          Cash Runway Status
        </h3>
        <p style={{ fontSize: '0.68rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: '0 0 20px' }}>
          {runway > 0
            ? `${runway} months remaining · ${runway >= 18 ? '✓ On target' : '⚠ Below 18mo target'}`
            : 'Upload a file to see runway analysis'}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, height: 12, background: 'rgba(99,179,237,0.1)', borderRadius: 999, overflow: 'hidden' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${runwayPct}%` }}
              transition={{ duration: 1.2, delay: 0.3 }}
              style={{ height: '100%', borderRadius: 999, background: runwayColour, boxShadow: `0 0 12px ${runwayColour}60` }}
            />
          </div>
          <span style={{ fontSize: '0.8rem', fontFamily: 'DM Mono, monospace', color: runwayColour, fontWeight: 500, flexShrink: 0 }}>
            {runway}mo / 24mo
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          {[0, 6, 12, 18, 24].map(m => (
            <span key={m} style={{ fontSize: '0.6rem', color: m === 18 ? '#f59e0b' : '#2d4a70', fontFamily: 'DM Mono, monospace' }}>
              {m}mo{m === 18 ? ' ⚑' : ''}
            </span>
          ))}
        </div>
      </Card>

      {/* Cash projection chart */}
      <Card delay={0.15}>
        <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: '0 0 4px' }}>
          Projected Cash Position
        </h3>
        <p style={{ fontSize: '0.68rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: '0 0 20px' }}>
          {projections.length > 0 ? 'Forward projection based on current trajectory' : 'Based on historical monthly data'}
        </p>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.4}/>
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,179,237,0.07)" vertical={false}/>
              <XAxis dataKey="month" {...AXIS}/>
              <YAxis {...AXIS} tickFormatter={v => `$${(Number(v)/1000).toFixed(0)}K`}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Area type="monotone" dataKey="cash" name="Cash Balance" stroke="#06b6d4" strokeWidth={2.5} fill="url(#cashGrad)"/>
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: '#4a6285', fontFamily: 'DM Mono, monospace', fontSize: '0.75rem' }}>No projection data available</p>
          </div>
        )}
      </Card>

      {/* Inflow vs Outflow */}
      <Card delay={0.2}>
        <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: '0 0 4px' }}>
          Inflow vs Outflow
        </h3>
        <p style={{ fontSize: '0.68rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: '0 0 20px' }}>
          Monthly cash movements
        </p>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,179,237,0.07)" vertical={false}/>
              <XAxis dataKey="month" {...AXIS}/>
              <YAxis {...AXIS} tickFormatter={v => `$${(Number(v)/1000).toFixed(0)}K`}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Bar dataKey="inflow"  name="Inflow"  fill="#10b981" fillOpacity={0.8} radius={[3,3,0,0]}/>
              <Bar dataKey="outflow" name="Outflow" fill="#ef4444" fillOpacity={0.7} radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: '#4a6285', fontFamily: 'DM Mono, monospace', fontSize: '0.75rem' }}>No data available</p>
          </div>
        )}
      </Card>

      {/* Projection table */}
      <Card delay={0.25}>
        <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: '0 0 16px' }}>
          Monthly Detail
        </h3>
        {chartData.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(99,179,237,0.1)' }}>
                  {['Month', 'Inflow', 'Outflow', 'Net', 'Cash Balance'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: '0.63rem', fontFamily: 'DM Mono, monospace', color: '#4a6285', textTransform: 'uppercase', fontWeight: 400 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chartData.map((row: any, i: number) => {
                  const inflow  = Number(row.inflow)  || 0;
                  const outflow = Number(row.outflow) || 0;
                  const net     = inflow - outflow;
                  const cash    = Number(row.cash)    || 0;
                  return (
                    <motion.tr
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.05 }}
                      style={{ borderBottom: '1px solid rgba(99,179,237,0.05)' }}
                    >
                      <td style={{ padding: '10px 12px', fontSize: '0.78rem', fontFamily: 'DM Mono, monospace', color: '#d4ddf0' }}>
                        {row.month ?? `M+${row.month_ahead ?? i+1}`}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '0.78rem', fontFamily: 'Outfit, sans-serif', color: '#10b981' }}>
                        {formatCurrency(inflow, true)}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '0.78rem', fontFamily: 'Outfit, sans-serif', color: '#ef4444' }}>
                        {formatCurrency(outflow, true)}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '0.78rem', fontFamily: 'DM Mono, monospace', color: net >= 0 ? '#10b981' : '#ef4444', fontWeight: 500 }}>
                        {net >= 0 ? '+' : ''}{formatCurrency(net, true)}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '0.78rem', fontFamily: 'Outfit, sans-serif', color: '#e2eeff', fontWeight: 500 }}>
                        {formatCurrency(cash, true)}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: '#4a6285', fontFamily: 'DM Mono, monospace', fontSize: '0.75rem', textAlign: 'center', padding: '24px 0' }}>
            Upload a financial file to see cash projections
          </p>
        )}
      </Card>
    </div>
  );
}
