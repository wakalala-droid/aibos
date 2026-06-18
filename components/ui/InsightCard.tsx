'use client';
import { motion } from 'framer-motion';
import BorderGlow, { type GlowStatus } from './BorderGlow';

interface InsightCardProps {
  insight: string;
  action: string;
  priority: 'high' | 'medium' | 'low';
  sourceEngines?: string[];
  index?: number;
}

const PRIORITY_MAP = {
  high:   { color: 'var(--crit)',  label: 'HIGH',   dot: '#ef4444' },
  medium: { color: 'var(--warn)',  label: 'MEDIUM', dot: '#fbbf24' },
  low:    { color: 'var(--info)',  label: 'LOW',     dot: '#60a5fa' },
};

const PRIORITY_GLOW: Record<string, GlowStatus> = { high: 'critical', medium: 'warning', low: 'neutral' };

const ENGINE_COLORS: Record<string, string> = {
  E1: 'var(--e1)', E2: 'var(--e2)', E3: 'var(--e3)',
};

export default function InsightCard({ insight, action, priority, sourceEngines = [], index = 0 }: InsightCardProps) {
  const cfg = PRIORITY_MAP[priority] ?? PRIORITY_MAP.low;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07 }}
    >
    <BorderGlow status={PRIORITY_GLOW[priority] ?? 'neutral'} glowColor={cfg.color} borderRadius={10}>
    <div className="insight-card glow-inner">
      {/* Left: severity indicator */}
      <div className="insight-severity">
        <div className="severity-dot" style={{ background: cfg.dot }} />
        <div className="severity-line" style={{ background: `color-mix(in srgb, ${cfg.dot} 20%, transparent)` }} />
      </div>

      {/* Middle: content */}
      <div className="insight-body">
        <p className="insight-label" style={{ color: cfg.color }}>
          {cfg.label}
        </p>
        <p className="insight-text">{insight}</p>
        <p className="insight-action">
          <span style={{ color: cfg.color, marginRight: 6 }}>→</span>
          {action}
        </p>
      </div>

      {/* Right: engine tags */}
      <div className="insight-engines">
        {sourceEngines.map(e => (
          <span
            key={e}
            className="engine-tag"
            style={{ color: ENGINE_COLORS[e] ?? 'var(--text-3)', borderColor: `color-mix(in srgb, ${ENGINE_COLORS[e] ?? 'var(--text-3)'} 30%, transparent)` }}
          >
            {e}
          </span>
        ))}
      </div>
    </div>
    </BorderGlow>
    </motion.div>
  );
}
