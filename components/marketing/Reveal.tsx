'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * Scroll-reveal wrapper for marketing sections.
 * Fade + 8–16px rise on enter (BRIEF §4). Honours prefers-reduced-motion via
 * useReducedMotion → collapses to an instant opacity-only state. The content is
 * always rendered (never display:none), so the page is fully usable if JS fails.
 */
export default function Reveal({
  children,
  delay = 0,
  y = 14,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25, margin: '0px 0px -10% 0px' }}
      transition={{ duration: 0.6, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
