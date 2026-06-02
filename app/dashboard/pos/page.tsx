'use client';

import { motion } from 'framer-motion';
import { useStore } from '@/lib/store';
import { formatCurrency, tokens } from '@/lib/utils';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { FADE, PageHeader, StatCard, DataCard, LockOverlay, CustomTooltip, TH, TR, TD, Chip } from '@/components/ui/PageShell';

const E3 = tokens.e3;
const CAT_PAL = [tokens.e3, tokens.good, tokens.info, tokens.warn, tokens.purple, tokens.crit, tokens.textMuted];
const VEL_COL: Record<string, string> = { '🔥': tokens.crit, '✅': tokens.e3, '⚠': tokens.warn };

const BCG_CFG: Record<string, { colour: string }> = {
  '⭐ Star':          { colour: tokens.warn   },
  '🐄 Cash Cow':      { colour: tokens.good   },
  '❓ Question Mark': { colour: tokens.info   },
  '🐕 Dog':           { colour: tokens.textMuted },
};

export default function POSPage() {
  const { posBusinessName, posPeriod, posGrandTotals, categories, topItems, bcgItems, hasEngine3Data, currencySymbol } = useStore();
  const sym = currencySymbol || 'K';
  const gt  = posGrandTotals;

  const discountRate = gt ? (gt.discount_value / Math.max(gt.gross_revenue, 1) * 100) : 0;

  const catPie = categories.slice(0, 6).map((c, i) => ({ name: c.category, value: Math.round(c.revenue), colour: CAT_PAL[i % CAT_PAL.length] }));
  const catBar = categories.slice(0, 7).map(c => ({
    name: c.category.length > 10 ? c.category.slice(0, 10) + '…' : c.category,
    units: c.units,
  }));

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <motion.div {...FADE(0)}>
        <PageHeader engine="Engine 3" engineLabel="Engine 3 · POS Intelligence" title="POS Intelligence" colour={E3}
          subtitle={[posBusinessName, posPeriod].filter(Boolean).join(' · ')} />
      </motion.div>

      <motion.div {...FADE(0.08)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 16 }}>
        <StatCard label="GROSS REVENUE"  value={gt?.gross_revenue  ?? 0} colour={E3}          sym={sym} />
        <StatCard label="NET REVENUE"    value={gt?.net_revenue    ?? 0} colour={tokens.good}  sym={sym} />
        <StatCard label="TOTAL UNITS"    value={gt?.units_sold     ?? 0} colour={tokens.info}  format="raw" sym={sym} />
        <StatCard label="DISCOUNT VALUE" value={gt?.discount_value ?? 0} colour={tokens.warn}  sym={sym} />
      </motion.div>

      {/* Discount chip */}
      {gt && (
        <motion.div {...FADE(0.12)} style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: discountRate < 2
            ? `color-mix(in srgb, ${tokens.good} 8%, var(--bg-surface))`
            : `color-mix(in srgb, ${tokens.warn} 8%, var(--bg-surface))`,
          border: `1px solid ${discountRate < 2 ? `color-mix(in srgb, ${tokens.good} 25%, transparent)` : `color-mix(in srgb, ${tokens.warn} 25%, transparent)`}`,
          borderRadius: 8, padding: '6px 14px', marginBottom: 20,
        }}>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.65rem', color: tokens.textMuted }}>Discount Rate</span>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.72rem', fontWeight: 700, color: discountRate < 2 ? tokens.good : tokens.warn }}>
            {discountRate.toFixed(2)}%
          </span>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.62rem', color: tokens.textMuted }}>
            {discountRate < 2 ? '✓ below 2% benchmark' : '⚠ above 2% benchmark'}
          </span>
        </motion.div>
      )}

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 16 }}>
        <motion.div {...FADE(0.14)}>
          <DataCard>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem', fontWeight: 600, color: tokens.textPrimary, margin: '0 0 12px' }}>Revenue Mix</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <ResponsiveContainer width={130} height={130}>
                <PieChart>
                  <Pie data={catPie} cx="50%" cy="50%" innerRadius={32} outerRadius={58} dataKey="value" stroke="none">
                    {catPie.map((e, i) => <Cell key={i} fill={e.colour} fillOpacity={0.85} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: tokens.bgHover }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1 }}>
                {categories.slice(0, 6).map((c, i) => (
                  <div key={c.category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: CAT_PAL[i % CAT_PAL.length], flexShrink: 0 }} />
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.62rem', color: tokens.textSecondary, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.category}</span>
                    </div>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.62rem', color: CAT_PAL[i % CAT_PAL.length], fontWeight: 700 }}>{c.pct_of_total.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </DataCard>
        </motion.div>

        <motion.div {...FADE(0.18)}>
          <DataCard>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem', fontWeight: 600, color: tokens.textPrimary, margin: '0 0 12px' }}>Units by Category</p>
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={catBar} layout="vertical" barCategoryGap="22%">
                <XAxis type="number" tick={{ fontFamily: 'DM Mono, monospace', fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontFamily: 'DM Mono, monospace', fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: tokens.bgHover }} />
                <Bar dataKey="units" radius={[0, 5, 5, 0]}>
                  {catBar.map((_, i) => <Cell key={i} fill={CAT_PAL[i % CAT_PAL.length]} fillOpacity={0.75} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </DataCard>
        </motion.div>
      </div>

      {/* Top items table */}
      <motion.div {...FADE(0.22)} style={{ marginBottom: 16 }}>
        <DataCard style={{ position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem', fontWeight: 600, color: tokens.textPrimary, margin: 0 }}>Top Items by Revenue</p>
            <div style={{ display: 'flex', gap: 10 }}>
              {[['🔥', 'Top 10%'], ['✅', 'Mid'], ['⚠', 'Low']].map(([icon, lbl]) => (
                <span key={icon} style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', color: tokens.textMuted }}>{icon} {lbl}</span>
              ))}
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><TH>Rank</TH><TH>SKU</TH><TH>Name</TH><TH>Category</TH><TH>Units</TH><TH>Revenue</TH><TH>Velocity</TH></tr></thead>
              <tbody>
                {topItems.map((item, i) => (
                  <TR key={item.sku || i} delay={0.28 + i * 0.04}>
                    <TD colour={tokens.textMuted}>#{i + 1}</TD>
                    <TD colour={tokens.info}>{item.sku}</TD>
                    <TD mono={false} bold>{item.name}</TD>
                    <TD><Chip label={item.category} colour={tokens.info} /></TD>
                    <TD>{item.units_sold.toLocaleString()}</TD>
                    <TD colour={E3} bold>{formatCurrency(item.revenue, false, sym)}</TD>
                    <TD colour={VEL_COL[item.velocity_rank] ?? tokens.textMuted} style={{ fontSize: '0.82rem' }}>{item.velocity_rank}</TD>
                  </TR>
                ))}
              </tbody>
            </table>
          </div>
          {!hasEngine3Data && <LockOverlay colour={E3} title="Engine 3 Locked" description="Upload a POS export file to unlock operations intelligence" bullets={['Category & SKU revenue breakdown', 'Product velocity ranking', 'BCG matrix classification']} />}
        </DataCard>
      </motion.div>

      {/* BCG grid */}
      {bcgItems.length > 0 && (
        <motion.div {...FADE(0.3)}>
          <DataCard>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem', fontWeight: 600, color: tokens.textPrimary, margin: '0 0 16px' }}>BCG Product Classification</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
              {Object.entries(BCG_CFG).map(([classLabel, cfg]) => {
                const items = bcgItems.filter(p => p.bcg_class === classLabel);
                if (!items.length) return null;
                return (
                  <div key={classLabel} style={{
                    background: `color-mix(in srgb, ${cfg.colour} 7%, var(--bg-surface))`,
                    border: `1px solid color-mix(in srgb, ${cfg.colour} 20%, var(--border-subtle))`,
                    borderRadius: 12, padding: '14px 16px',
                  }}>
                    <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1rem', margin: '0 0 2px' }}>{classLabel}</p>
                    <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.58rem', color: tokens.textMuted, margin: '0 0 10px' }}>{items.length} items</p>
                    {items.slice(0, 4).map(item => (
                      <div key={item.sku} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: `1px solid color-mix(in srgb, ${cfg.colour} 15%, transparent)` }}>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.62rem', color: tokens.textSecondary, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.62rem', color: cfg.colour }}>{formatCurrency(item.revenue, false, sym)}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </DataCard>
        </motion.div>
      )}
    </div>
  );
}
