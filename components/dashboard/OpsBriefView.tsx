'use client';

// OpsBriefView — the Operations brief as a component (audit #9): score strip,
// Engine-3 brief points, cross-engine insights, unified action plan. Moved
// verbatim from app/dashboard/ops-brief/page.tsx (which now redirects here
// via the Briefs page's Ops tab).

import { useStore } from '@/lib/store';
import { scoreColor } from '@/lib/utils';
import SectionCard from '@/components/ui/SectionCard';
import InsightCard from '@/components/ui/InsightCard';
import { motion } from 'framer-motion';

function BriefPoint({ text, index }: { text: string; index: number }) {
  const content = text.replace(/^\d+\.\s*/, '').trim();
  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + index * 0.07 }}
      style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0', borderTop: index > 0 ? '1px solid var(--border)' : 'none' }}>
      <span style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, background: 'var(--cyan-dim)', border: '1px solid rgba(0,212,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-label)', fontWeight: 700, color: 'var(--cyan)' }}>{index + 1}</span>
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
          <div className="kpi-card" style={{ minWidth: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 24px' }}>
            <p style={{ fontSize: '3rem', fontWeight: 900, color: scoreColor(scores.overall_score), letterSpacing: '-0.05em', margin: 0, lineHeight: 1 }}>
              {scores.overall_score}
            </p>
            <p style={{ fontSize: 'var(--fs-label)', color: 'var(--cyan)', margin: '5px 0 0', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {scores.overall_label}
            </p>
            <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: '2px 0 0' }}>OVERALL</p>
          </div>
          {[
            { l: 'FINANCIAL',              s: scores.e1_score, c: 'var(--e1)' },
            { l: 'CUSTOMER INTELLIGENCE',  s: scores.e2_score, c: 'var(--e2)' },
            { l: 'OPERATIONS',             s: scores.e3_score, c: 'var(--e3)' },
          ].map(item => (
            <div key={item.l} className="kpi-card">
              <p className="kpi-label" style={{ color: item.c }}>{item.l}</p>
              <p style={{ fontSize: '2rem', fontWeight: 800, color: scoreColor(item.s), margin: '8px 0 10px', letterSpacing: '-0.03em' }}>{item.s}</p>
              <div className="progress-track">
                <motion.div className="progress-fill" style={{ background: scoreColor(item.s) }} initial={{ width: 0 }} animate={{ width: `${item.s}%` }} transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Operations AI Brief */}
      <SectionCard title="AI Operations Brief" subtitle="Operations · POS analysis · AI-generated" delay={0.1} style={{ marginBottom: 20 }}>
        {opsBriefLines.length > 0
          ? opsBriefLines.map((l, i) => <BriefPoint key={i} text={l} index={i} />)
          : <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', textAlign: 'center', padding: '20px 0' }}>Upload POS data to generate operations intelligence</p>
        }
      </SectionCard>

      {/* Cross-engine insights */}
      {orderedInsights.length > 0 && (
        <SectionCard title="Cross-Engine Intelligence" subtitle="Compound insights from Financial · Customer Intelligence · Operations data" delay={0.16} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {orderedInsights.map((ins, i) => (
              <InsightCard key={i} index={i} insight={ins.insight} action={ins.action} priority={ins.priority as any} sourceEngines={ins.source_engines} />
            ))}
          </div>
        </SectionCard>
      )}

      {/* Unified executive brief */}
      {unifiedLines.length > 0 && (
        <SectionCard title="Unified Executive Action Plan" subtitle="AIBOS Intelligence · Financial + Customer Intelligence + Operations synthesis" delay={0.22}>
          {unifiedLines.map((l, i) => <BriefPoint key={i} text={l} index={i} />)}
        </SectionCard>
      )}
    </>
  );
}
