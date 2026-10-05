'use client';
import { useStore, type RfmRow } from '@/lib/store';
import { useLiveCustomerIntel } from '@/hooks/useLiveCustomerIntel';
import { fmt } from '@/lib/utils';
import KPICard from '@/components/ui/KPICard';
import SectionCard from '@/components/ui/SectionCard';
import LockOverlay from '@/components/ui/LockOverlay';
import DataTable, { type DataTableColumn } from '@/components/ui/DataTable';
import { motion } from 'framer-motion';
import PageHeader from '@/components/ui/PageHeader';

function RiskBar({ risk }: { risk: number }) {
  const color = risk >= 70 ? 'var(--crit)' : risk >= 40 ? 'var(--warn)' : 'var(--good)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div className="progress-track" style={{ flex: 1 }}>
        <motion.div className="progress-fill" style={{ background: color }}
          initial={false} animate={{ width: `${risk}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }} />
      </div>
      <span style={{ fontSize: 'var(--fs-label)', color, minWidth: 30, textAlign: 'right' }}>
        {risk.toFixed(0)}%
      </span>
    </div>
  );
}

// Churn ranking columns — risk score renders the same track+percent treatment
// the summary cards use, so severity reads identically everywhere.
const churnColumns = (sym: string): DataTableColumn<RfmRow>[] => [
  { key: 'customer_id', label: 'Customer', sortValue: r => r.customer_id,
    render: r => <span style={{ fontWeight: 700, color: 'var(--text-1)' }}>{r.customer_id}</span> },
  { key: 'segment', label: 'Group', sortValue: r => r.segment, render: r => r.segment },
  { key: 'recency_days', label: 'Last visit', sortValue: r => r.recency_days, render: r => `${r.recency_days}d` },
  { key: 'churn_risk', label: 'Chance they stop', sortValue: r => r.churn_risk,
    render: r => {
      const col = r.churn_risk >= 70 ? 'var(--crit)' : r.churn_risk >= 40 ? 'var(--warn)' : 'var(--good)';
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="progress-track" style={{ width: 56 }}>
            <div className="progress-fill" style={{ width: `${r.churn_risk}%`, background: col }} />
          </div>
          <span style={{ color: col, fontWeight: 600 }}>{r.churn_risk.toFixed(0)}%</span>
        </div>
      );
    } },
  { key: 'clv', label: 'Worth to you', sortValue: r => r.clv,
    render: r => <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{fmt(r.clv, false, sym)}</span> },
  { key: 'intervention', label: 'Action',
    render: r => <span style={{ maxWidth: 220, display: 'inline-block', fontSize: 'var(--fs-data)', color: 'var(--text-3)' }}>{r.intervention}</span> },
];

export default function ChurnPage() {
  const { rfm, hasEngine2Data, currencySymbol } = useStore();
  useLiveCustomerIntel(); // hydrates the shared Engine-2 slices from the spine
  const sym = currencySymbol || 'K';

  const high = rfm.filter(r => r.churn_risk >= 70).sort((a, b) => b.churn_risk - a.churn_risk);
  const med  = rfm.filter(r => r.churn_risk >= 40 && r.churn_risk < 70).sort((a, b) => b.churn_risk - a.churn_risk);
  const low  = rfm.filter(r => r.churn_risk < 40);
  const totalAtRisk = high.reduce((s, r) => s + (r.monetary ?? 0), 0);
  const avgChurn    = rfm.length > 0 ? rfm.reduce((s, r) => s + r.churn_risk, 0) / rfm.length : 0;

  return (
    <>
      <PageHeader
        eyebrow="Reports"
        eyebrowColour="var(--e2)"
        title="Quiet customers"
        subtitle="Customers who have stopped coming, ranked by how much they used to spend."
      />

      {/* KPI cards */}
      <div className="grid-kpi" style={{ marginBottom: 24 }}>
        <KPICard label="Likely to stop" value={String(high.length)} sub="worth a message today"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 3L2 20h20L12 3z" stroke="var(--crit)" strokeWidth="1.5" strokeLinejoin="round" fill="none"/><path d="M12 10v4M12 17v.5" stroke="var(--crit)" strokeWidth="1.5" strokeLinecap="round"/></svg>}
          iconBg="rgba(239,68,68,0.15)" sparkColor="var(--crit)" delay={0} />
        <KPICard label="Sales at risk" value={fmt(totalAtRisk, false, sym)} sub="from high-risk customers"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="var(--warn)" strokeWidth="1.5" fill="none"/><path d="M12 8v4l3 3" stroke="var(--warn)" strokeWidth="1.5" strokeLinecap="round"/></svg>}
          iconBg="rgba(251,191,36,0.15)" sparkColor="var(--warn)" delay={0.06} />
        <KPICard label="Average chance of stopping" value={`${avgChurn.toFixed(0)}%`} sub="across all customers"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 12a9 9 0 11-6.219-8.56" stroke="var(--e2)" strokeWidth="1.5" fill="none" strokeLinecap="round"/><path d="M21 3v5h-5" stroke="var(--e2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          iconBg="rgba(249,115,22,0.15)" sparkColor="var(--e2)" delay={0.12} />
        <KPICard label="Coming back" value={String(low.length)} sub="healthy customers"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="var(--good)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          iconBg="rgba(52,211,153,0.15)" sparkColor="var(--good)" delay={0.18} />
      </div>

      {/* High risk cards */}
      {high.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--crit)', margin: '0 0 10px' }}>
            Urgent Interventions: {high.length} customer{high.length > 1 ? 's' : ''} require immediate action
          </p>
          {high.map((r, i) => (
            <motion.div key={r.customer_id}
              initial={false} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06 }}
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-md)', borderRadius: 'var(--radius-md)', padding: '18px 20px', marginBottom: 10, position: 'relative', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}
            >
              {/* Left accent bar */}
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--crit)', borderRadius: '10px 0 0 10px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text-1)' }}>{r.customer_id}</span>
                    <span className="badge" style={{ color: 'var(--red)', background: 'transparent', borderColor: 'color-mix(in srgb, var(--red) 35%, transparent)', fontSize: 'var(--fs-label)' }}>{r.segment}</span>
                  </div>
                  <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: 0 }}>
                    Last active {r.recency_days}d ago · {r.frequency}× purchases
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: '0 0 2px' }}>Worth to you, at risk</p>
                  <p style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>{fmt(r.monetary, false, sym)}</p>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}><RiskBar risk={r.churn_risk} /></div>
              <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--pill-bg)', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: 'var(--fs-data)', color: 'var(--crit)', margin: 0 }}>{r.intervention}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Medium risk */}
      {med.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--warn)', margin: '0 0 10px' }}>
            Follow-up Required: {med.length} customer{med.length > 1 ? 's' : ''} need attention this week
          </p>
          {med.map((r, i) => (
            <motion.div key={r.customer_id}
              initial={false} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.06 }}
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-md)', borderRadius: 'var(--radius-md)', padding: '16px 18px', marginBottom: 8, position: 'relative', boxShadow: 'var(--shadow-card)' }}
            >
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--warn)', borderRadius: '10px 0 0 10px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text-1)' }}>{r.customer_id}</span>
                    <span className="badge" style={{ color: 'var(--text-2)', background: 'transparent', borderColor: 'var(--border-md)', fontSize: 'var(--fs-label)' }}>{r.segment}</span>
                  </div>
                  <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: 0 }}>{r.recency_days}d ago · {r.frequency}× purchases</p>
                </div>
                <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-1)' }}>{fmt(r.monetary, false, sym)}</span>
              </div>
              <div style={{ marginBottom: 10 }}><RiskBar risk={r.churn_risk} /></div>
              <p style={{ fontSize: 'var(--fs-data)', color: 'var(--warn)', margin: 0 }}>→ {r.intervention}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Full table */}
      <SectionCard title="Everyone, most likely to stop first" subtitle="Most likely to stop first" delay={0.3} style={{ position: 'relative' }}>
        <DataTable
          ariaLabel="All customers, most likely to stop first"
          columns={churnColumns(sym)}
          rows={rfm}
          rowKey={r => r.customer_id}
          defaultSort={{ key: 'churn_risk', dir: 'desc' }}
          filters={[
            { label: 'High risk',   predicate: (r: RfmRow) => r.churn_risk >= 70 },
            { label: 'Medium risk', predicate: (r: RfmRow) => r.churn_risk >= 40 && r.churn_risk < 70 },
            { label: 'Low risk',    predicate: (r: RfmRow) => r.churn_risk < 40 },
          ]}
          emptyMessage="Add customers' names to your sales and AIBOS ranks who is likely to stop coming."
        />
        {!hasEngine2Data && <LockOverlay colour="var(--e2)" title="Needs your customer sales" description="Record sales with the customer's name, or upload a sales file, to see who has stopped coming." />}
      </SectionCard>
    </>
  );
}
