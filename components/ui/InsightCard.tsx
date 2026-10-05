'use client';

// A finding, as a bento card (5 Oct 2026): how much it matters as the title,
// the part of the business as the tag, the finding in plain words and the
// next step under it. Monochrome: the words carry the urgency, not colour.

import { AlertTriangle, Activity, Lightbulb, ArrowRight } from 'lucide-react';
import BentoCard from './BentoCard';

interface InsightCardProps {
  insight: string;
  action: string;
  priority: 'high' | 'medium' | 'low';
  sourceEngines?: string[];
  index?: number;
  /** Grid placement inside a .bento-grid. */
  className?: string;
}

const PRIORITY = {
  high:   { title: 'Act now',      icon: <AlertTriangle />, motion: 'pulse' as const },
  medium: { title: 'Worth a look', icon: <Activity />,      motion: 'float' as const },
  low:    { title: 'Good to know', icon: <Lightbulb />,     motion: 'tilt' as const },
};

const AREA: Record<string, string> = { E1: 'Money', E2: 'Customers', E3: 'Operations' };

export default function InsightCard({ insight, action, priority, sourceEngines = [], className }: InsightCardProps) {
  const cfg = PRIORITY[priority] ?? PRIORITY.low;
  const area = sourceEngines.map((e) => AREA[e] ?? e).join(' and ');
  return (
    <BentoCard icon={cfg.icon} title={cfg.title} tag={area || undefined} text={insight} motion={cfg.motion} className={className}>
      {action && (
        <p style={{ margin: '12px 0 0', display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 'var(--fs-body)', lineHeight: 1.6, color: 'var(--text-1)', fontWeight: 500 }}>
          <ArrowRight aria-hidden="true" style={{ width: 18, height: 18, flexShrink: 0, marginTop: 5 }} />
          {action}
        </p>
      )}
    </BentoCard>
  );
}
