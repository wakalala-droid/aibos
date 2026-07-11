'use client';
import { useStore } from '@/lib/store';
import { fmt, formatAxis } from '@/lib/utils';
import KPICard from '@/components/ui/KPICard';
import SectionCard from '@/components/ui/SectionCard';
import LockOverlay from '@/components/ui/LockOverlay';
import ChartTooltip from '@/components/ui/ChartTooltip';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const SEG_COLORS: Record<string, string> = {
  Champion: 'var(--good)', Loyal: 'var(--blue)', Promising: 'var(--purple)',
  'At Risk': 'var(--warn)', Lost: 'var(--crit)',
};

export default function MarketPage() {
  const { segments, clvTiers, productsE2, customerIntelBrief, hasEngine2Data, currencySymbol } = useStore();
  const sym = currencySymbol || 'K';

  const totalRevenue   = segments.reduce((s, sg) => s + sg.total_revenue, 0);
  const totalCustomers = segments.reduce((s, sg) => s + sg.count, 0);
  const totalCLV       = clvTiers.reduce((s, t) => s + t.total_clv, 0);

  const segData = segments.map(s => ({ name: s.segment, revenue: Math.round(s.total_revenue), colour: SEG_COLORS[s.segment] ?? 'var(--text-4)' }));
  const clvData = clvTiers.map(t => ({
    name: t.tier, clv: Math.round(t.total_clv),
    colour: t.tier === 'High' ? 'var(--good)' : t.tier === 'Mid' ? 'var(--blue)' : 'var(--text-4)',
  }));

  const briefLines = (customerIntelBrief || '').split('\n').filter(l => l.trim() && /^\d+\./.test(l.trim()));

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 'var(--fs-label)', color: 'var(--e2)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }}>Customer Intelligence</p>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.03em' }}>Market Intelligence</h1>
        <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: '4px 0 0' }}>Segment revenue breakdown · CLV distribution · AI strategic brief</p>
      </div>

      {/* KPI cards */}
      <div className="grid-kpi" style={{ marginBottom: 24 }}>
        <KPICard label="MARKET REVENUE" value={fmt(totalRevenue, true, sym)} sub="across all segments"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="var(--e2)" strokeWidth="1.5" fill="none"/><path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20" stroke="var(--e2)" strokeWidth="1.2" fill="none"/></svg>}
          iconBg="rgba(249,115,22,0.15)" sparkColor="var(--e2)" delay={0} />
        <KPICard label="TOTAL CUSTOMERS" value={String(totalCustomers)} sub="tracked customers"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="7" r="4" stroke="var(--blue)" strokeWidth="1.5" fill="none"/><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" stroke="var(--blue)" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
          iconBg="rgba(96,165,250,0.15)" sparkColor="var(--blue)" delay={0.06} />
        <KPICard label="TOTAL CLV POOL" value={fmt(totalCLV, true, sym)} sub="combined lifetime value"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" stroke="var(--good)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          iconBg="rgba(52,211,153,0.15)" sparkColor="var(--good)" delay={0.12} />
        <KPICard label="PRODUCT COUNT" value={String(productsE2.length)} sub="distinct products"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" stroke="var(--purple)" strokeWidth="1.5" fill="none"/><rect x="14" y="3" width="7" height="7" rx="1" stroke="var(--purple)" strokeWidth="1.5" fill="none"/><rect x="3" y="14" width="7" height="7" rx="1" stroke="var(--purple)" strokeWidth="1.5" fill="none"/><rect x="14" y="14" width="7" height="7" rx="1" stroke="var(--purple)" strokeWidth="1.5" fill="none"/></svg>}
          iconBg="rgba(167,139,250,0.15)" sparkColor="var(--purple)" delay={0.18} />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <SectionCard title="Revenue by Segment" delay={0.1}>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={segData} barCategoryGap="32%">
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-4)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: 'var(--text-4)' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatAxis(v)} />
              <Tooltip content={<ChartTooltip sym={sym} />} cursor={{ fill: 'var(--table-row-hover)' }} />
              <Bar dataKey="revenue" radius={[5,5,0,0]}>
                {segData.map((e, i) => <Cell key={i} fill={e.colour} fillOpacity={0.8} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="CLV Distribution" delay={0.14}>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={clvData} barCategoryGap="32%">
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-4)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: 'var(--text-4)' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatAxis(v)} />
              <Tooltip content={<ChartTooltip sym={sym} />} cursor={{ fill: 'var(--table-row-hover)' }} />
              <Bar dataKey="clv" radius={[5,5,0,0]}>
                {clvData.map((e, i) => <Cell key={i} fill={e.colour} fillOpacity={0.8} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      {/* Segment table */}
      <SectionCard title="Segment Breakdown" delay={0.18} style={{ marginBottom: 20 }}>
        <table className="data-table">
          <thead><tr><th>Segment</th><th>Count</th><th>Avg Spend</th><th>Total Revenue</th><th>Revenue Share</th></tr></thead>
          <tbody>
            {segments.map((s, i) => {
              const share = totalRevenue > 0 ? (s.total_revenue / totalRevenue * 100).toFixed(1) : '0.0';
              return (
                <tr key={s.segment}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: SEG_COLORS[s.segment] ?? 'var(--text-4)', flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{s.segment}</span>
                    </div>
                  </td>
                  <td style={{ fontWeight: 700, color: SEG_COLORS[s.segment] ?? 'var(--text-3)' }}>{s.count}</td>
                  <td>{fmt(s.avg_spend, false, sym)}</td>
                  <td style={{ color: 'var(--text-1)', fontWeight: 600 }}>{fmt(s.total_revenue, false, sym)}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="progress-track" style={{ width: 60 }}>
                        <div className="progress-fill" style={{ width: `${share}%`, background: SEG_COLORS[s.segment] ?? 'var(--text-4)' }} />
                      </div>
                      <span style={{ fontSize: 'var(--fs-label)', color: SEG_COLORS[s.segment] ?? 'var(--text-3)' }}>{share}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </SectionCard>

      {/* AI Brief */}
      <SectionCard title="AI Market Intelligence Brief" subtitle="Customer Intelligence · Kwacha analysis" delay={0.24} style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--e2)', borderRadius: '12px 12px 0 0', opacity: 0.6 }} />
        {briefLines.length > 0 ? (
          briefLines.map((line, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.08 }}
              style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, background: 'rgba(249,115,22,0.10)', border: '1px solid rgba(249,115,22,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-label)', fontWeight: 700, color: 'var(--e2)' }}>{i + 1}</span>
              <p style={{ fontSize: 'var(--fs-data)', color: 'var(--text-2)', lineHeight: 1.55, margin: 0 }}>{line.replace(/^\d+\.\s*/, '')}</p>
            </motion.div>
          ))
        ) : (
          <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', textAlign: 'center', padding: '20px 0' }}>Upload transaction data to generate AI market intelligence</p>
        )}
        {!hasEngine2Data && <LockOverlay colour="var(--e2)" title="Customer Intelligence Locked" description="Upload transaction data to unlock AI-generated market insights" />}
      </SectionCard>
    </>
  );
}
