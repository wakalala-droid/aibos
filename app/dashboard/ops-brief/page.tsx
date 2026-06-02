'use client';

import { motion } from 'framer-motion';
import { useStore } from '@/lib/store';
import { tokens } from '@/lib/utils';
import { FADE, PageHeader, DataCard, BriefPoints } from '@/components/ui/PageShell';

const E3    = tokens.e3;
const INTEL = tokens.e1;

const PRIORITY_CFG = {
  high:   { colour: tokens.crit, tag: 'HIGH'   },
  medium: { colour: tokens.warn, tag: 'MEDIUM' },
  low:    { colour: tokens.info, tag: 'LOW'    },
};

function scoreColour(score: number) {
  if (score >= 80) return tokens.good;
  if (score >= 60) return tokens.info;
  if (score >= 40) return tokens.warn;
  return tokens.crit;
}

function EngineBadge({ engine }: { engine: string }) {
  const colour = engine === 'E1' ? INTEL : engine === 'E2' ? tokens.e2 : E3;
  return (
    <span style={{
      fontFamily: 'DM Mono, monospace', fontSize: '0.57rem', fontWeight: 700,
      padding: '1px 7px', borderRadius: 4, color: colour,
      background: `color-mix(in srgb, ${colour} 14%, transparent)`,
      border: `1px solid color-mix(in srgb, ${colour} 28%, transparent)`,
    }}>
      {engine}
    </span>
  );
}

export default function OpsBriefPage() {
  const {
    opsIntelBrief, crossInsights, unifiedBrief,
    intelligenceScores, posBusinessName, posPeriod,
  } = useStore();

  const scores = intelligenceScores;
  const orderedInsights = [
    ...crossInsights.filter(i => i.priority === 'high'),
    ...crossInsights.filter(i => i.priority === 'medium'),
    ...crossInsights.filter(i => i.priority === 'low'),
  ];

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <motion.div {...FADE(0)}>
        <PageHeader engine="Engine 3" engineLabel="Engine 3 · Operations Brief"
          title="Operations Intelligence Brief" colour={E3}
          subtitle={[posBusinessName, posPeriod].filter(Boolean).join(' · ')} />
      </motion.div>

      {/* Score strip */}
      {scores && (
        <motion.div {...FADE(0.08)} style={{
          display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: 14, marginBottom: 22,
        }}>
          {/* Hero */}
          <div style={{
            background: tokens.bgSurface2,
            border: `1px solid color-mix(in srgb, ${INTEL} 20%, var(--border-subtle))`,
            borderRadius: 16, padding: '24px 32px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            boxShadow: tokens.shadow, position: 'relative', overflow: 'hidden', minWidth: 130,
            transition: 'all 0.25s ease',
          }}>
            <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: tokens.shimmer }} />
            <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 0%, color-mix(in srgb, ${INTEL} 8%, transparent), transparent 60%)` }} />
            <motion.p
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 0.2 }}
              style={{ fontFamily: 'Outfit, sans-serif', fontSize: '3.2rem', fontWeight: 800, color: scoreColour(scores.overall_score), letterSpacing: '-0.05em', margin: 0, lineHeight: 1, position: 'relative' }}
            >
              {scores.overall_score}
            </motion.p>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.65rem', color: INTEL, margin: '4px 0 0', letterSpacing: '0.06em', textAlign: 'center', position: 'relative' }}>
              {scores.overall_label.toUpperCase()}
            </p>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.58rem', color: tokens.textMuted, margin: '2px 0 0', position: 'relative' }}>OVERALL</p>
          </div>

          {/* E1/E2/E3 scores */}
          {[
            { label: 'Financial (E1)',  score: scores.e1_score, colour: INTEL },
            { label: 'Customer (E2)',   score: scores.e2_score, colour: tokens.e2 },
            { label: 'Operations (E3)', score: scores.e3_score, colour: E3 },
          ].map(item => {
            const barCol = scoreColour(item.score);
            return (
              <div key={item.label} style={{
                background: tokens.bgSurface2,
                border: `1px solid color-mix(in srgb, ${item.colour} 15%, var(--border-subtle))`,
                borderRadius: 14, padding: '18px 20px',
                boxShadow: tokens.shadow, position: 'relative', overflow: 'hidden',
                transition: 'all 0.25s ease',
              }}>
                <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
                  {item.label}
                </p>
                <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '2rem', fontWeight: 700, color: barCol, margin: '0 0 8px' }}>
                  {item.score}
                </p>
                <div style={{ height: 3, borderRadius: 3, background: tokens.tableHead, overflow: 'hidden' }}>
                  <motion.div style={{ height: '100%', background: barCol, borderRadius: 3 }}
                    initial={{ width: 0 }} animate={{ width: `${item.score}%` }}
                    transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }} />
                </div>
              </div>
            );
          })}
        </motion.div>
      )}

      {/* AI Ops Brief */}
      <motion.div {...FADE(0.16)} style={{ marginBottom: 16 }}>
        <DataCard accentColour={E3}>
          <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 0% 0%, color-mix(in srgb, ${E3} 5%, transparent) 0%, transparent 60%)`, borderRadius: 16, pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, position: 'relative' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: `color-mix(in srgb, ${E3} 15%, transparent)`,
              border: `1px solid color-mix(in srgb, ${E3} 25%, transparent)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" stroke={E3} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem', fontWeight: 700, color: tokens.textPrimary, margin: 0 }}>AI Ops Intelligence Brief</p>
              <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', color: tokens.textMuted, margin: 0 }}>Engine 3 · llama-3.3-70b · POS + Kwacha analysis</p>
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            {opsIntelBrief ? (
              <BriefPoints text={opsIntelBrief} colour={E3} />
            ) : (
              <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.72rem', color: tokens.textMuted, textAlign: 'center', padding: '20px 0' }}>
                Upload POS data to generate operations intelligence
              </p>
            )}
          </div>
        </DataCard>
      </motion.div>

      {/* Cross-Engine Insights */}
      {orderedInsights.length > 0 && (
        <motion.div {...FADE(0.22)} style={{ marginBottom: 16 }}>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.65rem', color: INTEL, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>
            ⚡ Cross-Engine Compound Insights ({orderedInsights.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {orderedInsights.map((ins, i) => {
              const cfg = PRIORITY_CFG[ins.priority] ?? PRIORITY_CFG.low;
              return (
                <motion.div key={i}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.28 + i * 0.07 }}
                  style={{
                    background: tokens.bgSurface, backdropFilter: tokens.blur,
                    border: `1px solid color-mix(in srgb, ${cfg.colour} 18%, var(--border-subtle))`,
                    borderRadius: 14, padding: '16px 18px',
                    position: 'relative', overflow: 'hidden',
                    boxShadow: tokens.shadow, transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, color-mix(in srgb, ${cfg.colour} 40%, transparent), transparent)` }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{
                      fontFamily: 'DM Mono, monospace', fontSize: '0.58rem', fontWeight: 700,
                      padding: '2px 8px', borderRadius: 4, color: cfg.colour,
                      background: `color-mix(in srgb, ${cfg.colour} 12%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${cfg.colour} 28%, transparent)`,
                    }}>{cfg.tag}</span>
                    {ins.source_engines.map(e => <EngineBadge key={e} engine={e} />)}
                  </div>
                  <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.72rem', color: tokens.textSecondary, lineHeight: 1.65, margin: '0 0 10px' }}>
                    {ins.insight}
                  </p>
                  <div style={{
                    padding: '9px 12px', borderRadius: 8,
                    background: `color-mix(in srgb, ${cfg.colour} 6%, var(--bg-base))`,
                    border: `1px solid color-mix(in srgb, ${cfg.colour} 18%, var(--border-subtle))`,
                  }}>
                    <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.68rem', color: cfg.colour, margin: 0 }}>
                      → {ins.action}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Unified Executive Brief */}
      {unifiedBrief && (
        <motion.div {...FADE(0.32)}>
          <DataCard accentColour={INTEL}>
            <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 100% 0%, color-mix(in srgb, ${INTEL} 5%, transparent) 0%, transparent 60%)`, borderRadius: 16, pointerEvents: 'none' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, position: 'relative' }}>
              <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: `color-mix(in srgb, ${INTEL} 15%, transparent)`,
                border: `1px solid color-mix(in srgb, ${INTEL} 25%, transparent)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2a10 10 0 110 20A10 10 0 0112 2zM12 8v5l3 2" stroke={INTEL} strokeWidth="1.5" fill="none" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem', fontWeight: 700, color: tokens.textPrimary, margin: 0 }}>Unified Executive Action Plan</p>
                <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', color: tokens.textMuted, margin: 0 }}>AI-BOS Intelligence · E1 + E2 + E3 synthesis · ZMW Kwacha</p>
              </div>
            </div>
            <div style={{ position: 'relative' }}>
              <BriefPoints text={unifiedBrief} colour={INTEL} />
            </div>
          </DataCard>
        </motion.div>
      )}
    </div>
  );
}
