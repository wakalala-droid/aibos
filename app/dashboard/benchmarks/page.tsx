'use client';

import { motion } from 'framer-motion';
import { useStore } from '@/lib/store';
import { tokens } from '@/lib/utils';
import { FADE, PageHeader, DataCard, LockOverlay } from '@/components/ui/PageShell';

const E3 = tokens.e3;

const STATUS_CFG = {
  good:  { colour: tokens.good, label: '✓ On Target'    },
  warn:  { colour: tokens.warn, label: '⚠ Below Target' },
  alert: { colour: tokens.crit, label: '✕ Critical'     },
};

function BenchmarkCard({ b, delay }: { b: any; delay?: number }) {
  const cfg  = STATUS_CFG[b.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.good;
  const pct  = Math.min(Math.abs(b.actual / Math.max(b.benchmark, 1)) * 100, 120);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: delay ?? 0 }}
      style={{
        background: `color-mix(in srgb, ${cfg.colour} 5%, var(--bg-surface))`,
        border: `1px solid color-mix(in srgb, ${cfg.colour} 20%, var(--border-subtle))`,
        borderRadius: 14, padding: '20px 22px', position: 'relative', overflow: 'hidden',
        boxShadow: tokens.shadow, transition: 'all 0.25s ease',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, color-mix(in srgb, ${cfg.colour} 60%, transparent), transparent)` }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0, maxWidth: 130 }}>{b.label}</p>
        <span style={{
          fontFamily: 'DM Mono, monospace', fontSize: '0.58rem', color: cfg.colour,
          padding: '2px 8px', borderRadius: 4,
          background: `color-mix(in srgb, ${cfg.colour} 14%, transparent)`,
          border: `1px solid color-mix(in srgb, ${cfg.colour} 30%, transparent)`,
          whiteSpace: 'nowrap',
        }}>
          {cfg.label}
        </span>
      </div>
      <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '2rem', fontWeight: 700, color: cfg.colour, letterSpacing: '-0.03em', margin: '0 0 6px' }}>
        {b.actual}{b.unit !== 'K' ? b.unit : ''}
      </p>
      <div style={{ height: 4, borderRadius: 4, background: tokens.tableHead, overflow: 'hidden', marginBottom: 10 }}>
        <motion.div style={{ height: '100%', background: cfg.colour, borderRadius: 4 }}
          initial={{ width: 0 }} animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 1, ease: 'easeOut', delay: (delay ?? 0) + 0.2 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.62rem', color: tokens.textMuted }}>Benchmark: {b.benchmark}{b.unit !== 'K' ? b.unit : ''}</span>
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.62rem', color: cfg.colour, fontWeight: 700 }}>
          {b.gap > 0 ? '+' : ''}{b.gap.toFixed(1)}{b.unit !== 'K' ? b.unit : ''}
        </span>
      </div>
    </motion.div>
  );
}

function AttachMeter({ label, value, benchmark, colour }: { label: string; value: number; benchmark: number; colour: string }) {
  const isGood = value >= benchmark;
  const width  = Math.min(value / benchmark * 100, 100);
  const barCol = isGood ? tokens.good : tokens.warn;
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.65rem', color: tokens.textSecondary }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: barCol }}>{value.toFixed(1)}%</span>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', color: tokens.textMuted }}>/ {benchmark}%</span>
        </div>
      </div>
      <div style={{ position: 'relative', height: 8, borderRadius: 8, background: tokens.tableHead, overflow: 'hidden' }}>
        <motion.div style={{ height: '100%', background: barCol, borderRadius: 8 }}
          initial={{ width: 0 }} animate={{ width: `${width}%` }}
          transition={{ duration: 1.1, ease: 'easeOut', delay: 0.3 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 3 }}>
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.58rem', color: barCol }}>
          {isGood ? `+${(value - benchmark).toFixed(1)}% above target` : `${(value - benchmark).toFixed(1)}% below target`}
        </span>
      </div>
    </div>
  );
}

export default function BenchmarksPage() {
  const { benchmarks, attachRates, menuGaps, hasEngine3Data, posBusinessName, posPeriod } = useStore();

  const goodCount  = benchmarks.filter(b => b.status === 'good').length;
  const warnCount  = benchmarks.filter(b => b.status === 'warn').length;
  const alertCount = benchmarks.filter(b => b.status === 'alert').length;
  const drinkAttach = attachRates?.drink_attach_pct ?? 0;
  const sideAttach  = attachRates?.side_attach_pct  ?? 0;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <motion.div {...FADE(0)}>
        <PageHeader engine="Engine 3" engineLabel="Engine 3 · Benchmarks" title="Operational Benchmarks" colour={E3}
          subtitle={[posBusinessName, posPeriod].filter(Boolean).join(' · ')} />
      </motion.div>

      {/* Summary strip */}
      <motion.div {...FADE(0.08)} style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        {[{ label: 'On Target', count: goodCount, colour: tokens.good }, { label: 'Below Target', count: warnCount, colour: tokens.warn }, { label: 'Critical', count: alertCount, colour: tokens.crit }].map(item => (
          <div key={item.label} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: tokens.bgSurface2,
            border: `1px solid color-mix(in srgb, ${item.colour} 18%, var(--border-subtle))`,
            borderRadius: 12, padding: '14px 18px', boxShadow: tokens.shadow,
            transition: 'all 0.25s ease',
          }}>
            <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.6rem', fontWeight: 800, color: item.colour }}>{item.count}</span>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.65rem', color: tokens.textMuted }}>{item.label}</span>
          </div>
        ))}
      </motion.div>

      {/* Benchmark cards */}
      {benchmarks.length > 0 && (
        <motion.div {...FADE(0.12)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
          {benchmarks.map((b, i) => <BenchmarkCard key={b.metric} b={b} delay={0.12 + i * 0.06} />)}
        </motion.div>
      )}

      {/* Attach rates */}
      <motion.div {...FADE(0.24)} style={{ marginBottom: 16 }}>
        <DataCard accentColour={E3}>
          <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem', fontWeight: 600, color: tokens.textPrimary, margin: '0 0 20px' }}>Attach Rates</p>
          <AttachMeter label="Drink Attach Rate" value={drinkAttach} benchmark={80} colour={E3} />
          <AttachMeter label="Side Attach Rate"  value={sideAttach}  benchmark={30} colour={tokens.info} />
          {drinkAttach < 80 && (
            <div style={{
              marginTop: 6, padding: '12px 14px', borderRadius: 10,
              background: `color-mix(in srgb, ${tokens.warn} 6%, var(--bg-base))`,
              border: `1px solid color-mix(in srgb, ${tokens.warn} 18%, var(--border-subtle))`,
            }}>
              <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.7rem', color: tokens.warn, margin: 0, lineHeight: 1.5 }}>
                ⚠ Drink attach {drinkAttach.toFixed(1)}% is {(80 - drinkAttach).toFixed(1)}% below the 80% QSR benchmark. Train staff on proactive drink recommendations at point-of-order.
              </p>
            </div>
          )}
        </DataCard>
      </motion.div>

      {/* Menu gaps */}
      {menuGaps.length > 0 && (
        <motion.div {...FADE(0.30)}>
          <DataCard style={{ position: 'relative' }}>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem', fontWeight: 600, color: tokens.textPrimary, margin: '0 0 16px' }}>Menu Optimisation Opportunities</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {menuGaps.map((gap, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + i * 0.06 }}
                  style={{
                    background: tokens.bgSurface2, border: `1px solid ${tokens.border}`,
                    borderRadius: 10, padding: '14px 16px',
                    display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem', fontWeight: 600, color: tokens.textPrimary }}>{gap.name}</span>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.58rem', color: tokens.textMuted, padding: '1px 7px', borderRadius: 4, background: tokens.bgHover, border: `1px solid ${tokens.border}` }}>{gap.category}</span>
                    </div>
                    <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.66rem', color: tokens.warn, margin: '0 0 4px' }}>⚠ {gap.issue}</p>
                    <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.66rem', color: tokens.good, margin: 0 }}>→ {gap.opportunity}</p>
                  </div>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', color: tokens.info, whiteSpace: 'nowrap', paddingTop: 2 }}>SKU: {gap.sku}</span>
                </motion.div>
              ))}
            </div>
            {!hasEngine3Data && <LockOverlay colour={E3} title="Engine 3 Locked" description="Upload a POS export to see benchmark comparisons" />}
          </DataCard>
        </motion.div>
      )}

      {/* Empty state */}
      {benchmarks.length === 0 && (
        <motion.div {...FADE(0.2)}>
          <DataCard style={{ position: 'relative', padding: '40px 24px', textAlign: 'center' }}>
            <LockOverlay colour={E3} title="Engine 3 Locked" description="Upload a POS export to see QSR benchmark comparisons" />
          </DataCard>
        </motion.div>
      )}
    </div>
  );
}
