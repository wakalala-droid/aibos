'use client';
import { useStore } from '@/lib/store';
import { fmt } from '@/lib/utils';
import KPICard from '@/components/ui/KPICard';
import SectionCard from '@/components/ui/SectionCard';
import LockOverlay from '@/components/ui/LockOverlay';
import ChartTooltip from '@/components/ui/ChartTooltip';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';

const CAT_COLORS = ['var(--e3)','var(--blue)','var(--warn)','var(--purple)','var(--e2)','var(--crit)','var(--text-3)'];
const VEL_COLOR: Record<string, string> = { '🔥': 'var(--crit)', '✅': 'var(--good)', '⚠': 'var(--warn)' };

export default function POSPage() {
  const { posBusinessName, posPeriod, posGrandTotals, categories, topItems, hasEngine3Data, currencySymbol } = useStore();
  const sym = currencySymbol || 'K';
  const gt = posGrandTotals;
  const discRate = gt ? (gt.discount_value ?? 0) / Math.max(gt.gross_revenue ?? 0, 1) * 100 : 0;
  const pieData = categories.slice(0, 6).map((c, i) => ({ name: c.category, value: Math.round(c.revenue), colour: CAT_COLORS[i % CAT_COLORS.length] }));
  const barData = categories.slice(0, 7).map(c => ({ name: c.category.slice(0, 9), units: c.units }));

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'var(--e3)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }}>Operations</p>
        <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.03em' }}>POS Intelligence</h1>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: 'var(--text-3)', margin: '4px 0 0' }}>
          {[posBusinessName, posPeriod].filter(Boolean).join(' · ')}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid-kpi" style={{ marginBottom: 24 }}>
        <KPICard label="GROSS REVENUE" value={fmt(gt?.gross_revenue ?? 0, false, sym)} sub="total sales incl. discount"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="20" height="14" rx="2" stroke="var(--e3)" strokeWidth="1.5" fill="none"/><path d="M2 9h20" stroke="var(--e3)" strokeWidth="1.3" strokeLinecap="round"/></svg>}
          iconBg="rgba(16,185,129,0.15)" sparkColor="var(--e3)" delay={0} />
        <KPICard label="NET REVENUE" value={fmt(gt?.net_revenue ?? 0, false, sym)} sub="after discounts"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" stroke="var(--good)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          iconBg="rgba(52,211,153,0.15)" sparkColor="var(--good)" delay={0.06} />
        <KPICard label="TOTAL UNITS SOLD" value={(gt?.units_sold ?? 0).toLocaleString()} sub="across all categories"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" stroke="var(--blue)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          iconBg="rgba(96,165,250,0.15)" sparkColor="var(--blue)" delay={0.12} />
        <KPICard label="DISCOUNT VALUE" value={fmt(gt?.discount_value ?? 0, false, sym)} sub={`${discRate.toFixed(2)}% of gross revenue`}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 14.5L14.5 9M9 9h.01M14.5 14.5h.01" stroke="var(--warn)" strokeWidth="1.8" strokeLinecap="round"/><circle cx="12" cy="12" r="10" stroke="var(--warn)" strokeWidth="1.4" fill="none"/></svg>}
          iconBg="rgba(251,191,36,0.15)" sparkColor="var(--warn)" delay={0.18} />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <SectionCard title="Revenue Mix by Category" delay={0.1}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <ResponsiveContainer width={130} height={130}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={34} outerRadius={56} dataKey="value" stroke="none">
                  {pieData.map((e, i) => <Cell key={i} fill={e.colour} fillOpacity={0.85} />)}
                </Pie>
                <Tooltip content={<ChartTooltip sym={sym} />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1 }}>
              {categories.slice(0, 6).map((c, i) => (
                <div key={c.category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: CAT_COLORS[i % CAT_COLORS.length], flexShrink: 0 }} />
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'var(--text-2)', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.category}</span>
                  </div>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.68rem', fontWeight: 700, color: CAT_COLORS[i % CAT_COLORS.length] }}>{c.pct_of_total.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Units Sold by Category" delay={0.14}>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={barData} layout="vertical" barCategoryGap="22%">
              <XAxis type="number" tick={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fill: 'var(--text-4)' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={75} tick={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip currency={false} />} cursor={{ fill: 'var(--table-row-hover)' }} />
              <Bar dataKey="units" radius={[0, 5, 5, 0]}>
                {barData.map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} fillOpacity={0.75} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      {/* Top Items Table */}
      <SectionCard title="Top Items by Revenue" subtitle="Ranked by revenue · velocity indicator" delay={0.2} style={{ position: 'relative' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr><th>#</th><th>SKU</th><th>Name</th><th>Category</th><th>Units</th><th>Revenue</th><th>Velocity</th></tr></thead>
            <tbody>
              {topItems.map((item, i) => (
                <motion.tr key={item.sku || i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.04 }}>
                  <td style={{ color: 'var(--text-4)' }}>#{i + 1}</td>
                  <td style={{ color: 'var(--blue)', fontWeight: 600 }}>{item.sku}</td>
                  <td style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, color: 'var(--text-1)' }}>{item.name}</td>
                  <td><span className="badge" style={{ color: 'var(--text-3)', background: 'var(--bg-badge)', borderColor: 'var(--border)' }}>{item.category}</span></td>
                  <td>{item.units_sold.toLocaleString()}</td>
                  <td style={{ fontWeight: 700, color: 'var(--e3)' }}>{fmt(item.revenue, false, sym)}</td>
                  <td style={{ fontSize: '1rem', color: VEL_COLOR[item.velocity_rank] ?? 'var(--text-3)' }}>{item.velocity_rank}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {!hasEngine3Data && <LockOverlay colour="var(--e3)" title="Operations Locked" description="Upload a POS export file (XLS/XLSX) to unlock operations intelligence" bullets={['Category & SKU revenue breakdown','Product velocity ranking','BCG matrix classification']} />}
      </SectionCard>
    </>
  );
}
