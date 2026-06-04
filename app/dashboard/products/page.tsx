'use client';
import { useStore } from '@/lib/store';
import { fmt } from '@/lib/utils';
import KPICard from '@/components/ui/KPICard';
import SectionCard from '@/components/ui/SectionCard';
import LockOverlay from '@/components/ui/LockOverlay';
import ChartTooltip from '@/components/ui/ChartTooltip';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const BCG: Record<string, { color: string; border: string; bg: string; desc: string }> = {
  '⭐ Star':          { color: 'var(--warn)',   border: 'rgba(251,191,36,0.25)',  bg: 'rgba(251,191,36,0.06)',  desc: 'High revenue + high orders'  },
  '🐄 Cash Cow':      { color: 'var(--good)',   border: 'rgba(52,211,153,0.25)',  bg: 'rgba(52,211,153,0.06)',  desc: 'High revenue + low orders'   },
  '❓ Question Mark': { color: 'var(--blue)',   border: 'rgba(96,165,250,0.25)',  bg: 'rgba(96,165,250,0.06)',  desc: 'Low revenue + high orders'   },
  '🐕 Dog':           { color: 'var(--text-4)', border: 'rgba(71,85,105,0.25)',   bg: 'rgba(71,85,105,0.06)',   desc: 'Low revenue + low orders'    },
};

export default function ProductsPage() {
  const { productsE2, basketPairs, hasEngine2Data, currencySymbol } = useStore();
  const sym = currencySymbol || 'K';

  const stars        = productsE2.filter(p => p.bcg_class === '⭐ Star');
  const totalRevenue = productsE2.reduce((s, p) => s + p.total_revenue, 0);

  const barData = productsE2.slice(0, 10).map(p => ({
    ...p,
    name: p.product.length > 12 ? p.product.slice(0, 12) + '…' : p.product,
  }));

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'var(--e2)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }}>Customer Intelligence</p>
        <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.03em' }}>Product Intelligence</h1>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: 'var(--text-3)', margin: '4px 0 0' }}>BCG classification · revenue ranking · market basket analysis</p>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <KPICard label="TOTAL PRODUCTS" value={String(productsE2.length)} sub="tracked in system"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" stroke="var(--e2)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          iconBg="rgba(249,115,22,0.15)" sparkData={[2,3,3,4,4,productsE2.length]} sparkColor="var(--e2)" delay={0} />
        <KPICard label="STAR PRODUCTS" value={String(stars.length)} sub="high revenue + high orders"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="var(--warn)" strokeWidth="1.5" fill="none" strokeLinejoin="round"/></svg>}
          iconBg="rgba(251,191,36,0.15)" sparkData={[0,1,1,2,2,stars.length]} sparkColor="var(--warn)" delay={0.06} />
        <KPICard label="TOTAL REVENUE" value={fmt(totalRevenue, true, sym)} sub="across all products"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" stroke="var(--good)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><polyline points="16 7 22 7 22 13" stroke="var(--good)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          iconBg="rgba(52,211,153,0.15)" sparkData={[150000,175000,185000,190000,200000,totalRevenue]} sparkColor="var(--good)" delay={0.12} />
        <KPICard label="BASKET PAIRS" value={String(basketPairs.length)} sub="products bought together"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="var(--blue)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/><line x1="3" y1="6" x2="21" y2="6" stroke="var(--blue)" strokeWidth="1.5" strokeLinecap="round"/><path d="M16 10a4 4 0 01-8 0" stroke="var(--blue)" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
          iconBg="rgba(96,165,250,0.15)" sparkData={[0,1,2,2,3,basketPairs.length]} sparkColor="var(--blue)" delay={0.18} />
      </div>

      {/* BCG Quadrant tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        {Object.entries(BCG).map(([classLabel, cfg]) => {
          const items = productsE2.filter(p => p.bcg_class === classLabel);
          return (
            <div key={classLabel} style={{
              background: 'var(--bg-card)', border: `1px solid ${cfg.border}`,
              borderRadius: 12, padding: '18px 20px',
              boxShadow: 'var(--shadow-card)', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: cfg.color, opacity: 0.6 }} />
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1rem', margin: '0 0 3px' }}>{classLabel}</p>
              <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: 'var(--text-4)', margin: '0 0 14px', lineHeight: 1.4 }}>{cfg.desc}</p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.8rem', fontWeight: 800, color: cfg.color, margin: '0 0 4px', letterSpacing: '-0.03em' }}>{items.length}</p>
              <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: 'var(--text-4)', margin: '0 0 12px' }}>products</p>
              {items.slice(0, 3).map(p => (
                <div key={p.product} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'var(--text-2)', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.product}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: cfg.color, fontWeight: 600 }}>{fmt(p.total_revenue, true, sym)}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Revenue bar chart */}
      {barData.length > 0 && (
        <SectionCard title="Top Products by Revenue" subtitle={`${sym} ZMW · BCG-coloured`} delay={0.2} style={{ marginBottom: 20 }}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} barCategoryGap="28%">
              <XAxis dataKey="name" tick={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fill: 'var(--text-4)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fill: 'var(--text-4)' }} axisLine={false} tickLine={false} tickFormatter={v => `${sym}${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTooltip sym={sym} />} cursor={{ fill: 'var(--table-row-hover)' }} />
              <Bar dataKey="total_revenue" radius={[5, 5, 0, 0]}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={BCG[entry.bcg_class]?.color ?? 'var(--text-4)'} fillOpacity={0.75} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      )}

      {/* Basket pairs */}
      <SectionCard title="Market Basket Analysis" subtitle="Products frequently purchased together" delay={0.26} style={{ position: 'relative' }}>
        {basketPairs.length === 0 ? (
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: 'var(--text-4)', textAlign: 'center', padding: '20px 0' }}>No basket pairs detected</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {basketPairs.slice(0, 9).map((pair, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 + i * 0.04 }}
                style={{ background: 'var(--bg-badge)', border: '1px solid var(--border)', borderRadius: 8, padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: 'var(--text-1)', fontWeight: 600 }}>{pair.product_a}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: 'var(--text-4)' }}>+</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: 'var(--text-1)', fontWeight: 600 }}>{pair.product_b}</span>
                </div>
                <span className="badge" style={{ color: 'var(--e2)', background: 'rgba(249,115,22,0.10)', borderColor: 'rgba(249,115,22,0.22)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {pair.times_together}×
                </span>
              </motion.div>
            ))}
          </div>
        )}
        {!hasEngine2Data && <LockOverlay colour="var(--e2)" title="Customer Intelligence Locked" description="Upload transaction data with a product column to unlock product matrix" />}
      </SectionCard>
    </>
  );
}
