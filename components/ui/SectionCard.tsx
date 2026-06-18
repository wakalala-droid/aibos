'use client';
import { motion } from 'framer-motion';

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  delay?: number;
  action?: React.ReactNode;
}

export default function SectionCard({
  title, subtitle, children, style = {}, delay = 0, action,
}: SectionCardProps) {
  return (
    <motion.div
      className="section-card"
      style={style}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      {(title || action) && (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: subtitle ? 2 : 20 }}>
          {title && <h3 className="section-title">{title}</h3>}
          {action && <div>{action}</div>}
        </div>
      )}
      {subtitle && <p className="section-sub">{subtitle}</p>}
      {children}
    </motion.div>
  );
}
