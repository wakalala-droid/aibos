'use client';
import { useStore, type RfmRow } from '@/lib/store';
import { useLiveCustomerIntel } from '@/hooks/useLiveCustomerIntel';
import { fmt } from '@/lib/utils';
import KPICard from '@/components/ui/KPICard';
import SectionCard from '@/components/ui/SectionCard';
import LockOverlay from '@/components/ui/LockOverlay';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { type DataTableColumn } from '@/components/ui/DataTable';
import SimpleSummary from '@/components/dashboard/SimpleSummary';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import ChartTooltip from '@/components/ui/ChartTooltip';

const SEG_COLORS: Record<string, string> = {
  Champion: '#34d399', Loyal: '#60a5fa', Promising: '#a78bfa',
  'At Risk': '#fbbf24', Lost: '#ef4444',
};

function RetentionRing({ rate }: { rate: number }) {
  const r = 44, circ = 2 * Math.PI * r, dash = (rate / 100) * circ;
  return (
    <div style={{ position: 'relative', width: 110, height: 110, flexShrink: 0 }}>
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
        <motion.circle cx="55" cy="55" r={r} fill="none" stroke="var(--e2)" strokeWidth="8"
          strokeLinecap="round" strokeDasharray={`${circ}`} strokeDashoffset={circ}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
          style={{ transform: 'rotate(-90deg)', transformOrigin: '55px 55px' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--e2)' }}>{rate.toFixed(0)}%</span>
        <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', letterSpacing: '0.08em' }}>RETENTION</span>
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const { rfm, segments, retention, clvTiers, hasEngine2Data, customerIntelSource, currencySymbol } = useStore();
  const liveProgress = useLiveCustomerIntel();
  const sym = currencySymbol || 'K';
  const total = retention?.total_customers ?? rfm.length;
  const retRate = retention?.retention_rate ?? 0;
  const avgCLV = rfm.length > 0 ? rfm.reduce((a, r) => a + (r.clv ?? 0), 0) / rfm.length : 0;
  const highChurn = rfm.filter(r => r.churn_risk >= 70).length;
  const pieSeg = segments.map(s => ({ name: s.segment, value: s.count, colour: SEG_COLORS[s.segment] ?? 'var(--text-4)' }));

  // RFM table: default sort = highest churn risk first — the question this
  // table exists to answer ("who am I about to lose?") is answered before any
  // interaction. Segment chips filter; DataTable paginates past 25 rows.
  const rfmColumns: DataTableColumn<RfmRow>[] = [
    { key: 'customer_id', label: 'Customer', sortValue: r => r.customer_id,
      render: r => <span style={{ fontWeight: 700, color: 'var(--text-1)' }}>{r.customer_id}</span> },
    { key: 'segment', label: 'Segment', sortValue: r => r.segment,
      render: r => (
        <span className="badge" style={{ color: SEG_COLORS[r.segment] ?? 'var(--text-3)', background: `color-mix(in srgb, ${SEG_COLORS[r.segment] ?? '#fff'} 12%, transparent)`, borderColor: `color-mix(in srgb, ${SEG_COLORS[r.segment] ?? '#fff'} 30%, transparent)` }}>
          {r.segment}
        </span>
      ) },
    { key: 'recency_days', label: 'Recency', sortValue: r => r.recency_days, render: r => `${r.recency_days}d ago` },
    { key: 'frequency', label: 'Frequency', sortValue: r => r.frequency, render: r => `${r.frequency}×` },
    { key: 'monetary', label: 'Monetary', sortValue: r => r.monetary, render: r => fmt(r.monetary, false, sym) },
    { key: 'rfm_score', label: 'RFM Score', sortValue: r => r.rfm_score,
      render: r => <span style={{ fontWeight: 700, color: 'var(--e2)' }}>{r.rfm_score}</span> },
    { key: 'clv', label: 'CLV', sortValue: r => r.clv,
      render: r => <span style={{ color: 'var(--good)', fontWeight: 600 }}>{fmt(r.clv, false, sym)}</span> },
    { key: 'churn_risk', label: 'Churn Risk', sortValue: r => r.churn_risk,
      render: r => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="progress-track" style={{ width: 50 }}>
            <div className="progress-fill" style={{ width: `${r.churn_risk}%`, background: r.churn_risk >= 70 ? 'var(--crit)' : r.churn_risk >= 40 ? 'var(--warn)' : 'var(--good)' }} />
          </div>
          <span style={{ color: r.churn_risk >= 70 ? 'var(--crit)' : r.churn_risk >= 40 ? 'var(--warn)' : 'var(--good)', fontSize: 'var(--fs-label)' }}>{r.churn_risk.toFixed(0)}%</span>
        </div>
      ) },
  ];
  const segmentFilters = segments.map(s => ({
    label: s.segment,
    predicate: (r: RfmRow) => r.segment === s.segment,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Engine 2 · Customer"
        eyebrowColour="var(--e2)"
        title="Customer Intelligence"
        subtitle="RFM segmentation · CLV · Retention · Churn risk"
      />

      <SimpleSummary page="customers" />

      {customerIntelSource === 'spine' && (
        <p style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: '0 0 16px', fontSize: 'var(--fs-label)', color: 'var(--e2)', fontWeight: 600 }}>
          <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--e2)' }} />
          Live from your records — updates as you record sales
        </p>
      )}

      {liveProgress && !hasEngine2Data && (
        <SectionCard title="Live customer intelligence — almost on" style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', margin: '0 0 8px' }}>
            {liveProgress.coverage.sales_with_customer} of {liveProgress.needed?.transactions ?? 10} named sales
            {' · '}{liveProgress.coverage.customers} of {liveProgress.needed?.customers ?? 3} customers
          </p>
          <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: 0 }}>
            {liveProgress.hint}
          </p>
        </SectionCard>
      )}

      {/* KPI cards - E1 style */}
      <div className="grid-kpi" style={{ marginBottom: 24 }}>
        <KPICard label="TOTAL CUSTOMERS" value={String(total)} sub="active customers"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="7" r="4" stroke="var(--e2)" strokeWidth="1.5" fill="none"/><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" stroke="var(--e2)" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
          iconBg="rgba(249,115,22,0.15)" sparkColor="var(--e2)" delay={0} />
        <KPICard label="AVG CUSTOMER CLV" value={fmt(avgCLV, false, sym)} sub="lifetime value"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" stroke="var(--good)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><polyline points="16 7 22 7 22 13" stroke="var(--good)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          iconBg="rgba(52,211,153,0.15)" sparkColor="var(--good)" delay={0.06} />
        <KPICard label="RETENTION RATE" value={`${retRate.toFixed(1)}%`} sub="returning customers"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 12a9 9 0 11-6.219-8.56" stroke="var(--blue)" strokeWidth="1.5" fill="none" strokeLinecap="round"/><path d="M21 3v5h-5" stroke="var(--blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          iconBg="rgba(96,165,250,0.15)" sparkColor="var(--blue)" delay={0.12} />
        <KPICard label="HIGH CHURN RISK" value={String(highChurn)} sub="immediate action required"
          growth={highChurn > 0 ? undefined : undefined}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 3L2 20h20L12 3z" stroke="var(--crit)" strokeWidth="1.5" strokeLinejoin="round" fill="none"/><path d="M12 10v4M12 17v.5" stroke="var(--crit)" strokeWidth="1.5" strokeLinecap="round"/></svg>}
          iconBg="rgba(239,68,68,0.15)" sparkColor="var(--crit)" delay={0.18} />
      </div>

      {/* Charts row */}
      <div className="grid-3" style={{ marginBottom: 20 }}>
        {/* Segment pie */}
        <SectionCard title="Segment Distribution" delay={0.1}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div role="img" aria-label={`Donut chart of customer segments: ${pieSeg.map(sg => `${sg.name} ${sg.value}`).join(', ')}`}>
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie data={pieSeg} cx="50%" cy="50%" innerRadius={34} outerRadius={52} dataKey="value" stroke="none">
                  {pieSeg.map((e, i) => <Cell key={i} fill={e.colour} fillOpacity={0.9} />)}
                </Pie>
                <Tooltip content={<ChartTooltip currency={false} />} />
              </PieChart>
            </ResponsiveContainer>
            </div>
            <div style={{ flex: 1 }}>
              {segments.map(s => (
                <div key={s.segment} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: SEG_COLORS[s.segment] ?? 'var(--text-4)' }} />
                    <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-2)' }}>{s.segment}</span>
                  </div>
                  <span style={{ fontSize: 'var(--fs-data)', fontWeight: 700, color: SEG_COLORS[s.segment] ?? 'var(--text-4)' }}>{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

        {/* Retention ring */}
        <SectionCard title="Customer Retention" delay={0.14}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <RetentionRing rate={retRate} />
            <div>
              <div style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 3px' }}>Returning</p>
                <p style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--good)', margin: 0 }}>{retention?.returning_customers ?? 0}</p>
              </div>
              <div>
                <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 3px' }}>First-time</p>
                <p style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--blue)', margin: 0 }}>{total - (retention?.returning_customers ?? 0)}</p>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* CLV tiers */}
        <SectionCard title="CLV Tiers" delay={0.18}>
          {clvTiers.map(tier => {
            const c = tier.tier === 'High' ? 'var(--good)' : tier.tier === 'Mid' ? 'var(--blue)' : 'var(--text-4)';
            return (
              <div key={tier.tier} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--bg-badge)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 'var(--fs-label)', color: c, fontWeight: 700 }}>{tier.tier[0]}</span>
                  </div>
                  <div>
                    <p style={{ fontSize: 'var(--fs-data)', fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>{tier.tier} Value</p>
                    <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: 0 }}>{tier.count} customers</p>
                  </div>
                </div>
                <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: c }}>{fmt(tier.total_clv, true, sym)}</span>
              </div>
            );
          })}
        </SectionCard>
      </div>

      {/* RFM Table */}
      <SectionCard title="RFM Customer Records" subtitle="Recency · Frequency · Monetary · Segment · CLV · Churn" delay={0.22} style={{ position: 'relative' }}>
        <DataTable
          ariaLabel="RFM customer records"
          columns={rfmColumns}
          rows={rfm}
          rowKey={r => r.customer_id}
          defaultSort={{ key: 'churn_risk', dir: 'desc' }}
          filters={segmentFilters}
          emptyMessage="Upload customer transaction data to populate RFM records."
        />
        {!hasEngine2Data && <LockOverlay colour="var(--e2)" title="Customer Intelligence Locked" description="Upload transaction data with customer_id, date, amount, product columns" bullets={['RFM segmentation & scoring','Customer Lifetime Value tiers','Churn risk + intervention actions']} />}
      </SectionCard>
    </>
  );
}
