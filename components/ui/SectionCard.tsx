'use client';
import { motion } from 'framer-motion';
import BorderGlow, { type GlowStatus } from './BorderGlow';

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  delay?: number;
  action?: React.ReactNode;
  /** Severity for the attention glow around the panel / chart bounds. */
  status?: GlowStatus;
}

export default function SectionCard({
  title, subtitle, children, style = {}, delay = 0, action, status = 'neutral',
}: SectionCardProps) {
  return (
    <motion.div
      style={style}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <BorderGlow status={status} borderRadius={14}>
        <div className="section-card glow-inner">
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
