'use client';

import { motion } from 'framer-motion';
import { useStore } from '@/lib/store';
import { formatCurrency, tokens } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { FADE, PageHeader, StatCard, DataCard, LockOverlay, CustomTooltip } from '@/components/ui/PageShell';

const E2 = tokens.e2;

const BCG_CFG: Record<string, { colour: string; desc: string }> = {
  '⭐ Star':          { colour: tokens.warn,     desc: 'High revenue + high orders'  },
  '🐄 Cash Cow':      { colour: tokens.good,     desc: 'High revenue + low orders'   },
  '❓ Question Mark': { colour: tokens.info,     desc: 'Low revenue + high orders'   },
  '🐕 Dog':           { colour: tokens.textMuted, desc: 'Low revenue + low orders'   },
};

export default function ProductsPage() {
  const { productsE2, basketPairs, hasEngine2Data, currencySymbol } = useStore();
  const sym = currencySymbol || 'K';

  const stars       = productsE2.filter(p => p.bcg_class === '⭐ Star');
  const totalRevenue = productsE2.reduce((s, p) => s + p.total_revenue, 0);

  const barData = productsE2.slice(0, 10).map(p => ({
    ...p,
    name: p.product.length > 13 ? p.product.slice(0, 13) + '…' : p.product,
  }));

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <motion.div {...FADE(0)}>
        <PageHeader engine="Engine 2" engineLabel="Engine 2 · Product Matrix" title="Product Intelligence"
          subtitle="BCG classification · revenue ranking · market basket analysis" colour={E2} />
      </motion.div>

      {/* Stats */}
      <motion.div {...FADE(0.08)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
        <StatCard label="TOTAL PRODUCTS" value={productsE2.length}  colour={E2}          format="raw"      sym={sym} />
        <StatCard label="STAR PRODUCTS"  value={stars.length}       colour={tokens.warn}  format="raw"      sym={sym} />
        <StatCard label="TOTAL REVENUE"  value={totalRevenue}       colour={tokens.good}  format="currency" compact sym={sym} />
        <StatCard label="BASKET PAIRS"   value={basketPairs.length} colour={tokens.info}  format="raw"      sym={sym} />
      </motion.div>

      {/* BCG quadrant tiles */}
      <motion.div {...FADE(0.14)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
        {Object.entries(BCG_CFG).map(([classLabel, cfg]) => {
          const items = productsE2.filter(p => p.bcg_class === classLabel);
          return (
            <div key={classLabel} style={{
              background: `color-mix(in srgb, ${cfg.colour} 6%, var(--bg-surface))`,
              border: `1px solid color-mix(in srgb, ${cfg.colour} 22%, var(--border-subtle))`,
              borderRadius: 14, padding: '18px 20px',
              position: 'relative', overflow: 'hidden',
              boxShadow: tokens.shadow, transition: 'all 0.25s ease',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, color-mix(in srgb, ${cfg.colour} 50%, transparent), transparent)` }} />
              <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.2rem', margin: '0 0 4px' }}>{classLabel}</p>
              <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', color: tokens.textMuted, letterSpacing: '0.06em', margin: '0 0 14px' }}>{cfg.desc}</p>
              <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.6rem', fontWeight: 700, color: cfg.colour, margin: '0 0 6px' }}>{items.length}</p>
              <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', color: tokens.textMuted, margin: '0 0 12px' }}>products</p>
              {items.slice(0, 3).map(p => (
                <div key={p.product} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '5px 0', borderTop: `1px solid color-mix(in srgb, ${cfg.colour} 15%, var(--border-subtle))`,
                }}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.65rem', color: tokens.textSecondary, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.product}
                  </span>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.65rem', color: cfg.colour }}>
                    {formatCurrency(p.total_revenue, false, sym)}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </motion.div>

      {/* Revenue bar chart */}
      {barData.length > 0 && (
        <motion.div {...FADE(0.20)}>
          <DataCard style={{ marginBottom: 16 }}>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem', fontWeight: 600, color: tokens.textPrimary, margin: '0 0 16px' }}>
              Top 10 Products by Revenue
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} barCategoryGap="30%">
                <XAxis dataKey="name" tick={{ fontFamily: 'DM Mono, monospace', fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontFamily: 'DM Mono, monospace', fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${sym}${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: tokens.bgHover }} />
                <Bar dataKey="total_revenue" radius={[5, 5, 0, 0]}>
                  {barData.map((entry, i) => {
                    const cfg = BCG_CFG[entry.bcg_class];
                    return <Cell key={i} fill={cfg?.colour ?? E2} fillOpacity={0.78} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </DataCard>
        </motion.div>
      )}

      {/* Basket pairs */}
      <motion.div {...FADE(0.26)}>
        <DataCard style={{ position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem', fontWeight: 600, color: tokens.textPrimary, margin: 0 }}>Market Basket Pairs</p>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', color: tokens.textMuted }}>Products bought together</span>
          </div>

          {basketPairs.length === 0 ? (
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.72rem', color: tokens.textMuted, textAlign: 'center', padding: '20px 0' }}>
              No basket pairs detected yet
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
              {basketPairs.slice(0, 9).map((pair, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.04 }}
                  style={{
                    background: tokens.bgSurface2,
                    border: `1px solid ${tokens.border}`,
                    borderRadius: 10, padding: '12px 14px',
                    display: 'flex', alignItems: 'center', gap: 10,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.68rem', color: tokens.textPrimary, fontWeight: 600 }}>{pair.product_a}</span>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.62rem', color: tokens.textMuted }}>+</span>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.68rem', color: tokens.textPrimary, fontWeight: 600 }}>{pair.product_b}</span>
                    </div>
                  </div>
                  <div style={{
                    background: `color-mix(in srgb, ${E2} 12%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${E2} 25%, transparent)`,
                    borderRadius: 6, padding: '3px 9px',
                  }}>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.65rem', fontWeight: 700, color: E2 }}>
                      {pair.times_together}×
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
          {!hasEngine2Data && (
            <LockOverlay colour={E2} title="Engine 2 Locked"
              description="Upload transaction data with a product column to unlock product matrix" />
          )}
        </DataCard>
      </motion.div>
    </div>
  );
}
