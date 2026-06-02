'use client';

import { motion } from 'framer-motion';
import { useStore } from '@/lib/store';
import { formatCurrency, tokens } from '@/lib/utils';
import { FADE, PageHeader, StatCard, DataCard, LockOverlay, TH, TR, TD, Chip } from '@/components/ui/PageShell';

const E2 = tokens.e2;

function RiskBar({ risk }: { risk: number }) {
  const colour = risk >= 70 ? tokens.crit : risk >= 40 ? tokens.warn : tokens.good;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 4, borderRadius: 4, background: tokens.tableHead, overflow: 'hidden' }}>
        <motion.div style={{ height: '100%', background: colour, borderRadius: 4 }}
          initial={{ width: 0 }} animate={{ width: `${risk}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }} />
      </div>
      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.65rem', color: colour, minWidth: 32, textAlign: 'right' }}>
        {risk.toFixed(0)}%
      </span>
    </div>
  );
}

export default function ChurnPage() {
  const { rfm, hasEngine2Data, currencySymbol } = useStore();
  const sym = currencySymbol || 'K';

  const highRisk = rfm.filter(r => r.churn_risk >= 70).sort((a, b) => b.churn_risk - a.churn_risk);
  const medRisk  = rfm.filter(r => r.churn_risk >= 40 && r.churn_risk < 70).sort((a, b) => b.churn_risk - a.churn_risk);
  const lowRisk  = rfm.filter(r => r.churn_risk < 40);

  const totalAtRisk = highRisk.reduce((s, r) => s + (r.monetary ?? 0), 0);
  const avgChurn    = rfm.length > 0 ? rfm.reduce((s, r) => s + r.churn_risk, 0) / rfm.length : 0;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <motion.div {...FADE(0)}>
        <PageHeader engine="Engine 2" engineLabel="Engine 2 · Churn Risk" title="Churn Risk Analysis" subtitle="Churn probability · CLV at risk · Interventions ranked by urgency" colour={E2} />
      </motion.div>

      <motion.div {...FADE(0.08)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
        <StatCard label="HIGH CHURN RISK" value={highRisk.length} colour={tokens.crit} format="raw" sym={sym} pulse={highRisk.length > 0} />
        <StatCard label="REVENUE AT RISK" value={totalAtRisk}     colour={tokens.warn} format="currency" sym={sym} />
        <StatCard label="AVG CHURN SCORE" value={avgChurn}        colour={E2}          format="pct" sym={sym} />
        <StatCard label="LOW RISK"        value={lowRisk.length}  colour={tokens.good} format="raw" sym={sym} />
      </motion.div>

      {/* High risk intervention cards */}
      {highRisk.length > 0 && (
        <motion.div {...FADE(0.14)} style={{ marginBottom: 16 }}>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.65rem', color: tokens.crit, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
            🔴 Urgent interventions ({highRisk.length})
          </p>
          {highRisk.map((r, i) => (
            <motion.div key={r.customer_id}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.06 }}
              style={{
                background: `color-mix(in srgb, ${tokens.crit} 5%, var(--bg-surface))`,
                border: `1px solid color-mix(in srgb, ${tokens.crit} 18%, var(--border-subtle))`,
                borderRadius: 12, padding: '16px 18px', marginBottom: 8,
                position: 'relative', overflow: 'hidden',
                boxShadow: tokens.shadow, transition: 'all 0.2s ease',
              }}
            >
              <motion.div
                animate={{ opacity: [0, 0.2, 0], scale: [0.95, 1.05, 0.95] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.5 }}
                style={{ position: 'absolute', inset: 0, borderRadius: 12, border: `1px solid ${tokens.crit}` }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, position: 'relative' }}>
                <div>
                  <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem', fontWeight: 700, color: tokens.textPrimary, margin: '0 0 2px' }}>
                    {r.customer_id}
                    <Chip label={r.segment} colour={tokens.crit} />
                  </p>
                  <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.68rem', color: tokens.textMuted, margin: 0 }}>
                    Last active {r.recency_days}d ago · {r.frequency}× purchases
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', color: tokens.textMuted, margin: '0 0 2px', textTransform: 'uppercase' }}>CLV at risk</p>
                  <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: tokens.crit, margin: 0 }}>{formatCurrency(r.monetary, false, sym)}</p>
                </div>
              </div>
              <RiskBar risk={r.churn_risk} />
              <div style={{
                marginTop: 12, padding: '10px 12px', borderRadius: 8,
                background: `color-mix(in srgb, ${tokens.crit} 6%, var(--bg-base))`,
                border: `1px solid color-mix(in srgb, ${tokens.crit} 14%, var(--border-subtle))`,
              }}>
                <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.68rem', color: tokens.crit, margin: 0 }}>⚡ {r.intervention}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Medium risk */}
      {medRisk.length > 0 && (
        <motion.div {...FADE(0.22)} style={{ marginBottom: 16 }}>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.65rem', color: tokens.warn, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
            🟡 Follow-up required ({medRisk.length})
          </p>
          {medRisk.map((r, i) => (
            <motion.div key={r.customer_id}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.06 }}
              style={{
                background: `color-mix(in srgb, ${tokens.warn} 4%, var(--bg-surface))`,
                border: `1px solid color-mix(in srgb, ${tokens.warn} 14%, var(--border-subtle))`,
                borderRadius: 12, padding: '14px 18px', marginBottom: 8,
                boxShadow: tokens.shadow, transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', fontWeight: 600, color: tokens.textPrimary, margin: '0 0 2px' }}>
                    {r.customer_id} <Chip label={r.segment} colour={tokens.warn} />
                  </p>
                  <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.66rem', color: tokens.textMuted, margin: 0 }}>{r.recency_days}d ago · {r.frequency}× purchases</p>
                </div>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.75rem', fontWeight: 700, color: tokens.warn }}>{formatCurrency(r.monetary, false, sym)}</span>
              </div>
              <RiskBar risk={r.churn_risk} />
              <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.66rem', color: tokens.warn, margin: '10px 0 0' }}>› {r.intervention}</p>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Full table */}
      <motion.div {...FADE(0.28)}>
        <DataCard style={{ position: 'relative' }}>
          <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem', fontWeight: 600, color: tokens.textPrimary, margin: '0 0 16px' }}>All Customers — Churn Ranking</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr><TH>Customer</TH><TH>Segment</TH><TH>Recency</TH><TH>Churn Score</TH><TH>Label</TH><TH>CLV</TH><TH>Action</TH></tr>
              </thead>
              <tbody>
                {[...rfm].sort((a, b) => b.churn_risk - a.churn_risk).map((row, i) => {
                  const col = row.churn_risk >= 70 ? tokens.crit : row.churn_risk >= 40 ? tokens.warn : tokens.good;
                  return (
                    <TR key={row.customer_id} delay={0.35 + i * 0.04}>
                      <TD bold>{row.customer_id}</TD>
                      <TD>{row.segment}</TD>
                      <TD>{row.recency_days}d</TD>
                      <TD>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 60, height: 4, borderRadius: 4, background: tokens.tableHead, overflow: 'hidden' }}>
                            <div style={{ width: `${row.churn_risk}%`, height: '100%', background: col, borderRadius: 4 }} />
                          </div>
                          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.65rem', color: col }}>{row.churn_risk.toFixed(0)}%</span>
                        </div>
                      </TD>
                      <TD><Chip label={row.churn_label} colour={col} /></TD>
                      <TD colour={tokens.good}>{formatCurrency(row.clv, false, sym)}</TD>
                      <TD style={{ maxWidth: 220, fontFamily: 'DM Mono, monospace', fontSize: '0.65rem', color: tokens.textMuted }}>{row.intervention}</TD>
                    </TR>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!hasEngine2Data && <LockOverlay colour={E2} title="Engine 2 Locked" description="Upload transaction data to unlock churn analysis" bullets={['Churn risk score per customer', 'CLV at risk calculation', 'Urgency-ranked interventions']} />}
        </DataCard>
      </motion.div>
    </div>
  );
}
