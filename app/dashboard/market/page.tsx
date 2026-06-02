'use client';

import { motion } from 'framer-motion';
import { useStore } from '@/lib/store';
import { formatCurrency, tokens } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { FADE, PageHeader, StatCard, DataCard, LockOverlay, BriefPoints, CustomTooltip } from '@/components/ui/PageShell';

const E2 = tokens.e2;

const SEG_COLOURS: Record<string, string> = {
  Champion:  tokens.good,
  Loyal:     tokens.info,
  Promising: tokens.purple,
  'At Risk': tokens.warn,
  Lost:      tokens.crit,
};

export default function MarketPage() {
  const { segments, clvTiers, productsE2, customerIntelBrief, hasEngine2Data, currencySymbol } = useStore();
  const sym = currencySymbol || 'K';

  const totalRevenue   = segments.reduce((s, sg) => s + sg.total_revenue, 0);
  const totalCustomers = segments.reduce((s, sg) => s + sg.count, 0);
  const totalCLV       = clvTiers.reduce((s, t) => s + t.total_clv, 0);

  const segData = segments.map(s => ({
    name: s.segment, revenue: Math.round(s.total_revenue),
    colour: SEG_COLOURS[s.segment] ?? tokens.textMuted,
  }));

  const clvData = clvTiers.map(t => ({
    name: t.tier, clv: Math.round(t.total_clv),
    colour: t.tier === 'High' ? tokens.good : t.tier === 'Mid' ? tokens.info : tokens.textMuted,
  }));

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <motion.div {...FADE(0)}>
        <PageHeader engine="Engine 2" engineLabel="Engine 2 · Market Intelligence" title="Market Intelligence"
          subtitle="Segment revenue breakdown · CLV distribution · AI-generated strategic brief" colour={E2} />
      </motion.div>

      <motion.div {...FADE(0.08)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
        <StatCard label="MARKET REVENUE"    value={totalRevenue}         colour={E2}           format="currency" compact sym={sym} />
        <StatCard label="TOTAL CUSTOMERS"   value={totalCustomers}       colour={tokens.info}  format="raw"      sym={sym} />
        <StatCard label="TOTAL CLV POOL"    value={totalCLV}             colour={tokens.good}  format="currency" compact sym={sym} />
        <StatCard label="PRODUCT COUNT"     value={productsE2.length}    colour={tokens.purple} format="raw"     sym={sym} />
      </motion.div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 16 }}>

        {/* Segment revenue */}
        <motion.div {...FADE(0.14)}>
          <DataCard>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem', fontWeight: 600, color: tokens.textPrimary, margin: '0 0 16px' }}>Revenue by Segment</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={segData} barCategoryGap="35%">
                <XAxis dataKey="name" tick={{ fontFamily: 'DM Mono, monospace', fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontFamily: 'DM Mono, monospace', fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${sym}${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: tokens.bgHover }} />
                <Bar dataKey="revenue" radius={[5, 5, 0, 0]}>
                  {segData.map((e, i) => <Cell key={i} fill={e.colour} fillOpacity={0.8} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </DataCard>
        </motion.div>

        {/* CLV chart */}
        <motion.div {...FADE(0.18)}>
          <DataCard>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem', fontWeight: 600, color: tokens.textPrimary, margin: '0 0 16px' }}>CLV Distribution</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={clvData} barCategoryGap="35%">
                <XAxis dataKey="name" tick={{ fontFamily: 'DM Mono, monospace', fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontFamily: 'DM Mono, monospace', fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${sym}${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: tokens.bgHover }} />
                <Bar dataKey="clv" radius={[5, 5, 0, 0]}>
                  {clvData.map((e, i) => <Cell key={i} fill={e.colour} fillOpacity={0.8} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </DataCard>
        </motion.div>

        {/* Segment table */}
        <motion.div {...FADE(0.22)}>
          <DataCard>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem', fontWeight: 600, color: tokens.textPrimary, margin: '0 0 16px' }}>Segment Breakdown</p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${tokens.tableHead}` }}>
                  {['Segment', 'Count', 'Avg Spend', 'Revenue'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontFamily: 'DM Mono, monospace', fontSize: '0.58rem', color: tokens.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 400 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {segments.map((s, i) => (
                  <motion.tr key={s.segment}
                    initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.28 + i * 0.05 }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = tokens.tableHover}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    style={{ borderBottom: `1px solid ${tokens.tableBorder}`, transition: 'background 0.15s' }}
                  >
                    <td style={{ padding: '9px 8px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: SEG_COLOURS[s.segment] ?? tokens.textMuted, flexShrink: 0 }} />
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.68rem', color: tokens.textSecondary }}>{s.segment}</span>
                      </span>
                    </td>
                    <td style={{ padding: '9px 8px', fontFamily: 'DM Mono, monospace', fontSize: '0.68rem', color: SEG_COLOURS[s.segment] ?? tokens.textMuted, fontWeight: 700 }}>{s.count}</td>
                    <td style={{ padding: '9px 8px', fontFamily: 'DM Mono, monospace', fontSize: '0.68rem', color: tokens.textSecondary }}>{formatCurrency(s.avg_spend, false, sym)}</td>
                    <td style={{ padding: '9px 8px', fontFamily: 'DM Mono, monospace', fontSize: '0.68rem', color: tokens.textSecondary }}>{formatCurrency(s.total_revenue, false, sym)}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </DataCard>
        </motion.div>
      </div>

      {/* AI Intelligence Brief */}
      <motion.div {...FADE(0.28)}>
        <DataCard accentColour={E2} style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 0% 0%, color-mix(in srgb, ${E2} 5%, transparent) 0%, transparent 60%)`, borderRadius: 16, pointerEvents: 'none' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, position: 'relative' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: `color-mix(in srgb, ${E2} 15%, transparent)`,
              border: `1px solid color-mix(in srgb, ${E2} 25%, transparent)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2a10 10 0 110 20A10 10 0 0112 2z" stroke={E2} strokeWidth="1.5" fill="none" />
                <path d="M12 8v5M12 16v.5" stroke={E2} strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem', fontWeight: 700, color: tokens.textPrimary, margin: 0 }}>AI Market Intelligence Brief</p>
              <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', color: tokens.textMuted, margin: 0 }}>Engine 2 · llama-3.3-70b · Kwacha analysis</p>
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            {customerIntelBrief ? (
              <BriefPoints text={customerIntelBrief} colour={E2} />
            ) : (
              <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.72rem', color: tokens.textMuted, textAlign: 'center', padding: '20px 0' }}>
                Upload transaction data to generate AI market intelligence
              </p>
            )}
          </div>

          {!hasEngine2Data && (
            <LockOverlay colour={E2} title="Engine 2 Locked" description="Upload transaction data to unlock AI market intelligence" />
          )}
        </DataCard>
      </motion.div>
    </div>
  );
}
