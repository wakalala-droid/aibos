'use client';
import { motion } from 'framer-motion';
import BorderGlow from './BorderGlow';

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  delay?: number;
  action?: React.ReactNode;
  /** Knowledge-base id — long-press the card to have the AI assistant explain it. */
  explainId?: string;
}

// React Bits cursor edge-glow, tuned to match the KPI cards so the whole
// dashboard shares one visual language. `style` stays on the outer motion.div
// (margins / position / minHeight behave exactly as before); the inner panel
// carries `glow-inner`, which strips its own border/shadow so the wrapper draws
// the cursor-reactive border.
const CURSOR_GLOW = '190 95 62';
const MESH = ['#22d3ee', '#60a5fa', '#a78bfa'];

export default function SectionCard({
  title, subtitle, children, style = {}, delay = 0, action, explainId,
}: SectionCardProps) {
  return (
    <motion.div
      style={style}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <BorderGlow
        glowColor={CURSOR_GLOW}
        backgroundColor="var(--bg-card)"
        borderRadius={14}
        glowRadius={48}
        glowIntensity={1.2}
        coneSpread={12}
        colors={MESH}
        style={{ height: '100%' }}
      >
        <div
          className="section-card glow-inner"
          data-ai-explain={explainId}
          data-ai-label={explainId ? title : undefined}
        >
          {(title || action) && (
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: subtitle ? 2 : 20 }}>
              {title && <h3 className="section-title">{title}</h3>}
              {action && <div>{action}</div>}
            </div>
          )}
          {subtitle && <p className="section-sub">{subtitle}</p>}
          {children}
        </div>
      </BorderGlow>
    </motion.div>
  );
}
