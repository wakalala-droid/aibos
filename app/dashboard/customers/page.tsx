'use client';

import { motion } from 'framer-motion';
import { useStore } from '@/lib/store';
import { formatCurrency, tokens } from '@/lib/utils';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import {
  FADE, PageHeader, StatCard, DataCard, LockOverlay,
  CustomTooltip, TH, TR, TD, Chip,
} from '@/components/ui/PageShell';

const E2 = tokens.e2;

const SEG_COLOURS: Record<string, string> = {
  Champion:  tokens.good,
  Loyal:     tokens.info,
  Promising: tokens.purple,
  'At Risk': tokens.warn,
  Lost:      tokens.crit,
};

function RetentionRing({ rate }: { rate: number }) {
  const r = 42, circ = 2 * Math.PI * r, dash = (rate / 100) * circ;
  return (
    <div style={{ position: 'relative', width: 110, height: 110, flexShrink: 0 }}>
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={r} fill="none" stroke={`color-mix(in srgb, ${E2} 12%, transparent)`} strokeWidth="8" />
        <motion.circle
          cx="55" cy="55" r={r} fill="none" stroke={E2} strokeWidth="8"
          strokeLinecap="round" strokeDasharray={`${circ}`}
          strokeDashoffset={circ}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.4 }}
          style={{ transform: 'rotate(-90deg)', transformOrigin: '55px 55px' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.3rem', fontWeight: 700, color: E2 }}>{rate.toFixed(0)}%</span>
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.55rem', color: tokens.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>retention</span>
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const { rfm, segments, retention, clvTiers, hasEngine2Data, currencySymbol } = useStore();
  const sym = currencySymbol || 'K';

  const totalCustomers = retention?.total_customers ?? rfm.length;
  const retentionRate  = retention?.retention_rate ?? 0;
  const totalCLV       = rfm.reduce((a, r) => a + (r.clv ?? 0), 0);
  const avgCLV         = totalCustomers > 0 ? totalCLV / totalCustomers : 0;
  const highChurn      = rfm.filter(r => r.churn_risk >= 70).length;

  const pieSeg = segments.map(s => ({ name: s.segment, value: s.count, colour: SEG_COLOURS[s.segment] ?? tokens.textMuted }));

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <motion.div {...FADE(0)}>
        <PageHeader engine="Engine 2" engineLabel="Engine 2 · Customer Intelligence" title="Customer Intelligence" subtitle="RFM segmentation · CLV · Retention · Churn risk" colour={E2} />
      </motion.div>

      {/* Stat cards */}
      <motion.div {...FADE(0.08)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
        <StatCard label="TOTAL CUSTOMERS"  value={totalCustomers} colour={E2}          format="raw"  sym={sym} />
        <StatCard label="AVG CUSTOMER CLV" value={avgCLV}         colour={tokens.info}  format="currency" sym={sym} />
        <StatCard label="RETENTION RATE"   value={retentionRate}  colour={tokens.good}  format="pct"  sym={sym} />
        <StatCard label="HIGH CHURN RISK"  value={highChurn}      colour={tokens.crit}  format="raw"  sym={sym} pulse={highChurn > 0} />
      </motion.div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 16 }}>

        {/* Segment pie */}
        <motion.div {...FADE(0.14)}>
          <DataCard>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem', fontWeight: 600, color: tokens.textPrimary, margin: '0 0 16px' }}>Segment Distribution</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <ResponsiveContainer width={130} height={130}>
                <PieChart>
                  <Pie data={pieSeg} cx="50%" cy="50%" innerRadius={36} outerRadius={56} dataKey="value" stroke="none">
                    {pieSeg.map((e, i) => <Cell key={i} fill={e.colour} fillOpacity={0.85} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: tokens.bgHover }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1 }}>
                {segments.map(s => (
                  <div key={s.segment} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: SEG_COLOURS[s.segment] ?? tokens.textMuted }} />
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.68rem', color: tokens.textSecondary }}>{s.segment}</span>
                    </div>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.68rem', color: SEG_COLOURS[s.segment] ?? tokens.textMuted, fontWeight: 700 }}>{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </DataCard>
        </motion.div>

        {/* Retention ring */}
        <motion.div {...FADE(0.18)}>
          <DataCard>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem', fontWeight: 600, color: tokens.textPrimary, margin: '0 0 16px' }}>Customer Retention</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <RetentionRing rate={retentionRate} />
              <div>
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 3px' }}>Returning</p>
                  <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.3rem', fontWeight: 700, color: tokens.good, margin: 0 }}>{retention?.returning_customers ?? 0}</p>
                </div>
                <div>
                  <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 3px' }}>First-time</p>
                  <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.3rem', fontWeight: 700, color: tokens.info, margin: 0 }}>
                    {totalCustomers - (retention?.returning_customers ?? 0)}
                  </p>
                </div>
              </div>
            </div>
          </DataCard>
        </motion.div>

        {/* CLV tiers */}
        <motion.div {...FADE(0.22)}>
          <DataCard>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem', fontWeight: 600, color: tokens.textPrimary, margin: '0 0 16px' }}>CLV Tiers</p>
            {clvTiers.map(tier => {
              const c = tier.tier === 'High' ? tokens.good : tier.tier === 'Mid' ? tokens.info : tokens.textMuted;
              return (
                <div key={tier.tier} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: `color-mix(in srgb, ${c} 14%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', color: c, fontWeight: 700 }}>{tier.tier[0]}</span>
                    </div>
                    <div>
                      <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.78rem', fontWeight: 600, color: tokens.textPrimary, margin: 0 }}>{tier.tier} Value</p>
                      <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', color: tokens.textMuted, margin: 0 }}>{tier.count} customers</p>
                    </div>
                  </div>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.8rem', fontWeight: 700, color: c }}>
                    {formatCurrency(tier.total_clv, true, sym)}
                  </span>
                </div>
              );
            })}
          </DataCard>
        </motion.div>
      </div>

      {/* RFM table */}
      <motion.div {...FADE(0.28)}>
        <DataCard style={{ position: 'relative' }}>
          <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem', fontWeight: 600, color: tokens.textPrimary, margin: '0 0 16px' }}>
            RFM Customer Records
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <TH>Customer</TH><TH>Segment</TH><TH>Recency</TH>
                  <TH>Frequency</TH><TH>Monetary</TH><TH>RFM Score</TH>
                  <TH>CLV</TH><TH>Churn Risk</TH>
                </tr>
              </thead>
              <tbody>
                {rfm.map((row, i) => (
                  <TR key={row.customer_id} delay={0.3 + i * 0.04}>
                    <TD bold>{row.customer_id}</TD>
                    <TD><Chip label={row.segment} colour={SEG_COLOURS[row.segment] ?? tokens.textMuted} /></TD>
                    <TD>{row.recency_days}d</TD>
                    <TD>{row.frequency}×</TD>
                    <TD>{formatCurrency(row.monetary, false, sym)}</TD>
                    <TD colour={E2} bold>{row.rfm_score}</TD>
                    <TD colour={tokens.good}>{formatCurrency(row.clv, false, sym)}</TD>
                    <TD colour={row.churn_risk >= 70 ? tokens.crit : row.churn_risk >= 40 ? tokens.warn : tokens.good}>
                      {row.churn_label} {row.churn_risk.toFixed(0)}%
                    </TD>
                  </TR>
                ))}
              </tbody>
            </table>
          </div>
          {!hasEngine2Data && (
            <LockOverlay colour={E2} title="Engine 2 Locked" description="Upload transaction data to unlock customer intelligence"
              bullets={['RFM customer segments & scores', 'Customer Lifetime Value tiers', 'Churn risk ranking']} />
          )}
        </DataCard>
      </motion.div>
    </div>
  );
}
