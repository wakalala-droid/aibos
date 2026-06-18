'use client';
import { useStore } from '@/lib/store';
import { fmt } from '@/lib/utils';
import KPICard from '@/components/ui/KPICard';
import SectionCard from '@/components/ui/SectionCard';
import LockOverlay from '@/components/ui/LockOverlay';
import { motion } from 'framer-motion';

function RiskBar({ risk }: { risk: number }) {
  const color = risk >= 70 ? 'var(--crit)' : risk >= 40 ? 'var(--warn)' : 'var(--good)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div className="progress-track" style={{ flex: 1 }}>
        <motion.div className="progress-fill" style={{ background: color }}
          initial={{ width: 0 }} animate={{ width: `${risk}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }} />
      </div>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color, minWidth: 30, textAlign: 'right' }}>
        {risk.toFixed(0)}%
      </span>
    </div>
  );
}

export default function ChurnPage() {
  const { rfm, hasEngine2Data, currencySymbol } = useStore();
  const sym = currencySymbol || 'K';

  const high = rfm.filter(r => r.churn_risk >= 70).sort((a, b) => b.churn_risk - a.churn_risk);
  const med  = rfm.filter(r => r.churn_risk >= 40 && r.churn_risk < 70).sort((a, b) => b.churn_risk - a.churn_risk);
  const low  = rfm.filter(r => r.churn_risk < 40);
  const totalAtRisk = high.reduce((s, r) => s + (r.monetary ?? 0), 0);
  const avgChurn    = rfm.length > 0 ? rfm.reduce((s, r) => s + r.churn_risk, 0) / rfm.length : 0;

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'var(--e2)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }}>Customer Intelligence</p>
        <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.03em' }}>Churn Risk Analysis</h1>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: 'var(--text-3)', margin: '4px 0 0' }}>Churn probability · CLV at risk · Interventions ranked by urgency</p>
      </div>

      {/* KPI cards */}
      <div className="grid-kpi" style={{ marginBottom: 24 }}>
        <KPICard label="HIGH CHURN RISK" value={String(high.length)} sub="immediate action required"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 3L2 20h20L12 3z" stroke="var(--crit)" strokeWidth="1.5" strokeLinejoin="round" fill="none"/><path d="M12 10v4M12 17v.5" stroke="var(--crit)" strokeWidth="1.5" strokeLinecap="round"/></svg>}
          iconBg="rgba(239,68,68,0.15)" sparkColor="var(--crit)" delay={0} />
        <KPICard label="REVENUE AT RISK" value={fmt(totalAtRisk, false, sym)} sub="from high-risk customers"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="var(--warn)" strokeWidth="1.5" fill="none"/><path d="M12 8v4l3 3" stroke="var(--warn)" strokeWidth="1.5" strokeLinecap="round"/></svg>}
          iconBg="rgba(251,191,36,0.15)" sparkColor="var(--warn)" delay={0.06} />
        <KPICard label="AVG CHURN SCORE" value={`${avgChurn.toFixed(0)}%`} sub="across all customers"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 12a9 9 0 11-6.219-8.56" stroke="var(--e2)" strokeWidth="1.5" fill="none" strokeLinecap="round"/><path d="M21 3v5h-5" stroke="var(--e2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          iconBg="rgba(249,115,22,0.15)" sparkColor="var(--e2)" delay={0.12} />
        <KPICard label="LOW RISK" value={String(low.length)} sub="healthy customers"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="var(--good)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          iconBg="rgba(52,211,153,0.15)" sparkColor="var(--good)" delay={0.18} />
      </div>

      {/* High risk cards */}
      {high.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', fontWeight: 600, color: 'var(--crit)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
            Urgent Interventions — {high.length} customer{high.length > 1 ? 's' : ''} require immediate action
          </p>
          {high.map((r, i) => (
            <motion.div key={r.customer_id}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06 }}
              style={{ background: 'var(--bg-card)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: '18px 20px', marginBottom: 10, position: 'relative', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}
            >
              {/* Left accent bar */}
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--crit)', borderRadius: '12px 0 0 12px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-1)' }}>{r.customer_id}</span>
                    <span className="badge" style={{ color: 'var(--crit)', background: 'rgba(239,68,68,0.10)', borderColor: 'rgba(239,68,68,0.25)', fontSize: '0.58rem' }}>{r.segment}</span>
                  </div>
                  <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'var(--text-4)', margin: 0 }}>
                    Last active {r.recency_days}d ago · {r.frequency}× purchases
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: 'var(--text-4)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>CLV at risk</p>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.1rem', fontWeight: 800, color: 'var(--crit)', margin: 0 }}>{fmt(r.monetary, false, sym)}</p>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}><RiskBar risk={r.churn_risk} /></div>
              <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.14)' }}>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: 'var(--crit)', margin: 0 }}>⚡ {r.intervention}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Medium risk */}
      {med.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', fontWeight: 600, color: 'var(--warn)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
            Follow-up Required — {med.length} customer{med.length > 1 ? 's' : ''} need attention this week
          </p>
          {med.map((r, i) => (
            <motion.div key={r.customer_id}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.06 }}
              style={{ background: 'var(--bg-card)', border: '1px solid rgba(251,191,36,0.20)', borderRadius: 12, padding: '16px 18px', marginBottom: 8, position: 'relative', boxShadow: 'var(--shadow-card)' }}
            >
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--warn)', borderRadius: '12px 0 0 12px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-1)' }}>{r.customer_id}</span>
                    <span className="badge" style={{ color: 'var(--warn)', background: 'rgba(251,191,36,0.10)', borderColor: 'rgba(251,191,36,0.25)', fontSize: '0.58rem' }}>{r.segment}</span>
                  </div>
                  <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: 'var(--text-4)', margin: 0 }}>{r.recency_days}d ago · {r.frequency}× purchases</p>
                </div>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', fontWeight: 700, color: 'var(--warn)' }}>{fmt(r.monetary, false, sym)}</span>
              </div>
              <div style={{ marginBottom: 10 }}><RiskBar risk={r.churn_risk} /></div>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.78rem', color: 'var(--warn)', margin: 0 }}>→ {r.intervention}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Full table */}
      <SectionCard title="All Customers — Churn Ranking" subtitle="Sorted by churn probability (highest risk first)" delay={0.3} style={{ position: 'relative' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr><th>Customer</th><th>Segment</th><th>Recency</th><th>Churn Score</th><th>CLV</th><th>Action</th></tr></thead>
            <tbody>
              {[...rfm].sort((a, b) => b.churn_risk - a.churn_risk).map((row, i) => {
                const col = row.churn_risk >= 70 ? 'var(--crit)' : row.churn_risk >= 40 ? 'var(--warn)' : 'var(--good)';
                return (
                  <motion.tr key={row.customer_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 + i * 0.04 }}>
                    <td style={{ fontWeight: 700, color: 'var(--text-1)' }}>{row.customer_id}</td>
                    <td>{row.segment}</td>
                    <td>{row.recency_days}d</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="progress-track" style={{ width: 56 }}>
                          <div className="progress-fill" style={{ width: `${row.churn_risk}%`, background: col }} />
                        </div>
                        <span style={{ color: col, fontWeight: 600 }}>{row.churn_risk.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--good)', fontWeight: 600 }}>{fmt(row.clv, false, sym)}</td>
                    <td style={{ maxWidth: 220, fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: 'var(--text-3)' }}>{row.intervention}</td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!hasEngine2Data && <LockOverlay colour="var(--e2)" title="Customer Intelligence Locked" description="Upload transaction data to unlock churn risk analysis" />}
      </SectionCard>
    </>
  );
}
