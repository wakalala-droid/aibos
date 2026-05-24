'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { useStore, severityConfig } from '@/lib/store';
import { formatCurrency, formatPercent } from '@/lib/utils';

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

function VarianceTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(9,13,30,0.95)', border: '1px solid rgba(99,179,237,0.25)', borderRadius: 10, padding: '10px 14px' }}>
      <p style={{ fontSize: '0.72rem', fontFamily: 'DM Mono, monospace', color: '#4a6285', margin: '0 0 6px' }}>{label}</p>
      {payload.map((e: any) => (
        <div key={e.name} style={{ fontSize: '0.76rem', color: e.value >= 0 ? '#10b981' : '#ef4444', fontFamily: 'DM Mono, monospace' }}>
          {e.name}: {e.value >= 0 ? '+' : ''}{formatCurrency(e.value, true)}
        </div>
      ))}
    </div>
  );
}

export default function VariancePage() {
  const monthly = useStore(s => s.monthly);
  const alerts  = useStore(s => s.alerts);
  const [sortCol, setSortCol] = useState<'month' | 'revenue' | 'costs' | 'profit' | 'margin'>('month');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Budget assumption: 10% growth from Jan baseline
  const budget = monthly.map((m, i) => ({
    ...m,
    budgetRevenue: Math.round(142000 * (1 + i * 0.015)),
    budgetCosts:   Math.round(98000  * (1 + i * 0.012)),
  }));

  const varianceData = budget.map(m => ({
    month:           m.month,
    revenueVariance: m.revenue - m.budgetRevenue,
    costsVariance:   m.budgetCosts - m.costs,  // positive = under budget (good)
    profitVariance:  m.profit - (m.budgetRevenue - m.budgetCosts),
  }));

  const thStyle = { textAlign: 'left' as const, padding: '8px 12px', fontSize: '0.63rem', fontFamily: 'DM Mono, monospace', color: '#4a6285', textTransform: 'uppercase' as const, letterSpacing: '0.05em', fontWeight: 400, cursor: 'pointer', userSelect: 'none' as const };
  const AXIS = { tick: { fill: '#4a6285', fontSize: 11, fontFamily: 'DM Mono, monospace' }, axisLine: { stroke: 'rgba(99,179,237,0.1)' }, tickLine: false };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1400, margin: '0 auto' }}>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {[
          { label: 'Revenue Variance', value: varianceData.reduce((s, m) => s + m.revenueVariance, 0), positive: true },
          { label: 'Cost Variance',    value: varianceData.reduce((s, m) => s + m.costsVariance, 0),   positive: true },
          { label: 'Profit Variance',  value: varianceData.reduce((s, m) => s + m.profitVariance, 0),  positive: true },
          { label: 'Alerts Active',    value: alerts.filter(a => a.severity === 'critical' || a.severity === 'high').length, isCount: true },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            style={{ background: 'rgba(9,13,30,0.72)', backdropFilter: 'blur(16px)', border: '1px solid rgba(99,179,237,0.12)', borderRadius: 14, padding: '18px 20px', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}
          >
            <p style={{ fontSize: '0.65rem', fontFamily: 'DM Mono, monospace', color: '#4a6285', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>{item.label}</p>
            <p style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: 'Outfit, sans-serif', color: item.isCount ? '#f59e0b' : (item.value >= 0 ? '#10b981' : '#ef4444'), margin: 0, letterSpacing: '-0.02em' }}>
              {item.isCount ? item.value : (item.value >= 0 ? '+' : '') + formatCurrency(item.value, true)}
            </p>
            <p style={{ fontSize: '0.62rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: 0, marginTop: 4 }}>vs budget FY</p>
          </motion.div>
        ))}
      </div>

      {/* Variance waterfall chart */}
      <Card delay={0.1}>
        <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: '0 0 4px' }}>Monthly Profit Variance vs Budget</h3>
        <p style={{ fontSize: '0.68rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: '0 0 20px' }}>Positive = ahead of budget · Negative = behind budget</p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={varianceData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,179,237,0.07)" vertical={false}/>
            <XAxis dataKey="month" {...AXIS}/>
            <YAxis {...AXIS} tickFormatter={v => `${v >= 0 ? '+' : ''}$${v/1000}K`}/>
            <Tooltip content={<VarianceTooltip/>}/>
            <ReferenceLine y={0} stroke="rgba(99,179,237,0.3)" strokeWidth={1}/>
            <Bar dataKey="profitVariance" name="Profit Variance" radius={[3,3,0,0]}>
              {varianceData.map((entry, i) => (
                <Cell key={i} fill={entry.profitVariance >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.8}/>
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Variance table */}
      <Card delay={0.15}>
        <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: '0 0 4px' }}>Budget vs Actuals Detail</h3>
        <p style={{ fontSize: '0.68rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: '0 0 16px' }}>Click column headers to sort</p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(99,179,237,0.1)' }}>
                {[
                  { key: 'month',   label: 'Month' },
                  { key: 'budgRev', label: 'Budget Rev' },
                  { key: 'actRev',  label: 'Actual Rev' },
                  { key: 'revVar',  label: 'Rev Variance' },
                  { key: 'actCost', label: 'Actual Cost' },
                  { key: 'budgCost',label: 'Budget Cost' },
                  { key: 'costVar', label: 'Cost Variance' },
                  { key: 'margin',  label: 'Margin' },
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
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(99,179,237,0.04)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <td style={{ padding: '10px 12px', fontSize: '0.78rem', fontFamily: 'DM Mono, monospace', color: '#d4ddf0', fontWeight: 500 }}>{row.month}</td>
                    <td style={{ padding: '10px 12px', fontSize: '0.78rem', fontFamily: 'Outfit, sans-serif', color: '#4a6285' }}>{formatCurrency(row.budgetRevenue, true)}</td>
                    <td style={{ padding: '10px 12px', fontSize: '0.78rem', fontFamily: 'Outfit, sans-serif', color: '#e2eeff' }}>{formatCurrency(row.revenue, true)}</td>
                    <td style={{ padding: '10px 12px', fontSize: '0.78rem', fontFamily: 'DM Mono, monospace', color: rv >= 0 ? '#10b981' : '#ef4444', fontWeight: 500 }}>{rv >= 0 ? '+' : ''}{formatCurrency(rv, true)}</td>
                    <td style={{ padding: '10px 12px', fontSize: '0.78rem', fontFamily: 'Outfit, sans-serif', color: '#e2eeff' }}>{formatCurrency(row.costs, true)}</td>
                    <td style={{ padding: '10px 12px', fontSize: '0.78rem', fontFamily: 'Outfit, sans-serif', color: '#4a6285' }}>{formatCurrency(row.budgetCosts, true)}</td>
                    <td style={{ padding: '10px 12px', fontSize: '0.78rem', fontFamily: 'DM Mono, monospace', color: cv >= 0 ? '#10b981' : '#ef4444', fontWeight: 500 }}>{cv >= 0 ? '+' : ''}{formatCurrency(cv, true)}</td>
                    <td style={{ padding: '10px 12px', fontSize: '0.78rem', fontFamily: 'DM Mono, monospace', color: row.margin >= 32 ? '#10b981' : row.margin >= 28 ? '#f59e0b' : '#ef4444', fontWeight: 500 }}>{row.margin.toFixed(1)}%</td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Active alerts */}
      <Card delay={0.2}>
        <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: '0 0 16px' }}>Variance Alert Detail</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {alerts.map((alert, i) => {
            const cfg = severityConfig[alert.severity];
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.05 }}
                style={{ display: 'flex', gap: 14, padding: '12px 16px', background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 10, alignItems: 'flex-start' }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.colour, flexShrink: 0, marginTop: 5, boxShadow: `0 0 8px ${cfg.colour}80` }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 500, color: '#d4ddf0', fontFamily: 'Outfit, sans-serif' }}>{alert.title}</span>
                    <span style={{ fontSize: '0.58rem', fontFamily: 'DM Mono, monospace', color: cfg.colour, background: `${cfg.colour}20`, padding: '1px 7px', borderRadius: 4 }}>{cfg.label}</span>
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
