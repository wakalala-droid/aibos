'use client';

// OpsBriefView — the Operations brief as a component (audit #9): score strip,
// Engine-3 brief points, cross-engine insights, unified action plan. Moved
// verbatim from app/dashboard/ops-brief/page.tsx (which now redirects here
// via the Briefs page's Ops tab).

import { useStore } from '@/lib/store';
import { scoreColor } from '@/lib/utils';
import SectionCard from '@/components/ui/SectionCard';
import InsightCard from '@/components/ui/InsightCard';
import { bentoSpans } from '@/components/ui/BentoCard';
import { motion } from 'framer-motion';

function BriefPoint({ text, index }: { text: string; index: number }) {
  const content = text.replace(/^\d+\.\s*/, '').trim();
  return (
    <motion.div initial={false} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + index * 0.07 }}
      style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0', borderTop: index > 0 ? '1px solid var(--border)' : 'none' }}>
      <span className="avatar" aria-hidden="true" style={{ width: 32, height: 32 }}>{index + 1}</span>
      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', lineHeight: 1.55, margin: 0 }}>{content}</p>
    </motion.div>
  );
}

export default function OpsBriefView() {
  const { opsIntelBrief, crossInsights, unifiedBrief, intelligenceScores, posBusinessName, posPeriod } = useStore();
  const scores = intelligenceScores;

  const orderedInsights = [
    ...crossInsights.filter(i => i.priority === 'high'),
    ...crossInsights.filter(i => i.priority === 'medium'),
    ...crossInsights.filter(i => i.priority === 'low'),
  ];

  const opsBriefLines  = (opsIntelBrief || '').split('\n').filter(l => l.trim() && /^\d+\./.test(l.trim()));
  const unifiedLines   = (unifiedBrief  || '').split('\n').filter(l => l.trim() && /^\d+\./.test(l.trim()));

  return (
    <>
      {(posBusinessName || posPeriod) && (
        <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: '0 0 16px' }}>
          {[posBusinessName, posPeriod].filter(Boolean).join(' · ')}
        </p>
      )}

      {/* Score strip */}
      {scores && (
        <div className="grid-engines" style={{ marginBottom: 24 }}>
          {/* Overall hero */}
          <div className="kpi-card" style={{ minWidth: 120 }}>
            <p className="kpi-label">Overall</p>
            <p className="money money-hero" style={{ display: 'block', margin: '12px 0 4px' }}>
              {scores.overall_score}
            </p>
            <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: 0 }}>
              {scores.overall_label}
            </p>
          </div>
          {/* An engine with no data behind it scored 0 and was printed as a big
              bold zero in the same type as a real score. "Operations 0" is a
              verdict; "no data yet" is the truth. */}
          {[
            { l: 'Money',      s: scores.e1_score, c: 'var(--e1)', measured: scores.measured?.e1 ?? true },
            { l: 'Customers',  s: scores.e2_score, c: 'var(--e2)', measured: scores.measured?.e2 ?? true },
            { l: 'Operations', s: scores.e3_score, c: 'var(--e3)', measured: scores.measured?.e3 ?? true },
          ].map(item => (
            <div key={item.l} className="kpi-card">
              <p className="kpi-label">{item.l}</p>
              {item.measured ? (
                <>
                  <p className="money money-lg" style={{ display: 'block', margin: '12px 0 12px' }}>{item.s}</p>
                  <div className="progress-track">
                    <motion.div className="progress-fill" style={{ background: scoreColor(item.s) }} initial={false} animate={{ width: `${item.s}%` }} transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }} />
                  </div>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text-4)', margin: '8px 0 10px' }}>No data yet</p>
                  <div className="progress-track" />
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Operations AI Brief */}
      <SectionCard title="The till, read by AIBOS" subtitle="What your till's sales say, in plain words." style={{ marginBottom: 16 }}>
        {opsBriefLines.length > 0
          ? opsBriefLines.map((l, i) => <BriefPoint key={i} text={l} index={i} />)
          : <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: 0 }}>Upload your till&apos;s sales report and AIBOS reads it here.</p>
        }
      </SectionCard>

      {/* Cross-engine insights */}
      {orderedInsights.length > 0 && (
        <section className="bento-section" style={{ marginTop: 24, marginBottom: 24 }} aria-label="What AIBOS found">
          <header className="bento-section-head">
            <div>
              <p className="eyebrow">Across your business</p>
              <h2 className="bento-section-title">What AIBOS found</h2>
            </div>
            <p className="bento-section-sub">Money, customers and the till read together, the most pressing first.</p>
          </header>
          <div className="bento-grid">
            {orderedInsights.map((ins, i) => (
              <InsightCard key={i} index={i} insight={ins.insight} action={ins.action} priority={ins.priority as any} sourceEngines={ins.source_engines}
                className={bentoSpans(orderedInsights.length)[i]} />
            ))}
          </div>
        </section>
      )}

      {/* Unified executive brief */}
      {unifiedLines.length > 0 && (
        <SectionCard title="What to do next" subtitle="From everything AIBOS has read: money, customers and the till.">
          {unifiedLines.map((l, i) => <BriefPoint key={i} text={l} index={i} />)}
        </SectionCard>
      )}
    </>
  );
}
