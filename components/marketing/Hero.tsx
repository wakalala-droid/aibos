'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import EngineCluster from './EngineCluster';

export default function Hero() {
  const reduce = useReducedMotion();
  const rise = (delay: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, delay, ease: 'easeOut' as const },
  });

  return (
    <section
      style={{ position: 'relative', overflow: 'hidden', paddingTop: 'clamp(36px, 6vw, 72px)', paddingBottom: 'clamp(48px, 7vw, 96px)' }}
    >
      {/* Warm golden-hour wash — placeholder for the painterly Lusaka scene
          (BRIEF §11b). Swap for the AI-generated WebP when ready. */}
      <span className="mkt-glow" style={{ top: '-12%', right: '-6%', width: 540, height: 540, background: 'radial-gradient(circle, rgba(224,121,42,0.30), transparent 60%)' }} />
      <span className="mkt-glow" style={{ bottom: '-20%', left: '-8%', width: 460, height: 460, background: 'radial-gradient(circle, rgba(124,92,240,0.22), transparent 62%)' }} />

      <div
        className="mkt-wrap mkt-hero-grid"
        style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 'clamp(28px, 5vw, 64px)', alignItems: 'center' }}
      >
        {/* Copy */}
        <div>
          <motion.p className="mkt-eyebrow" {...rise(0)}>
            The brain behind every business
          </motion.p>
          <motion.h1 className="mkt-h1" {...rise(0.08)}>
            Ask your business anything.{' '}
            <span style={{ color: 'var(--cyan)' }}>Get the answer, in Kwacha, instantly.</span>
          </motion.h1>
          <motion.p className="mkt-lead" style={{ marginTop: 22, maxWidth: 540 }} {...rise(0.18)}>
            AI-BOS is the AI business operating system for African SMEs — a CFO,
            analyst and consultant in your pocket. Upload your data and stop guessing.
          </motion.p>

          <motion.div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 30 }} {...rise(0.28)}>
            <Link href="/login" className="mkt-btn mkt-btn-primary">
              Start free — upload your data
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Link>
            <Link href="/pricing" className="mkt-btn mkt-btn-secondary">
              See pricing
            </Link>
          </motion.div>

          <motion.p style={{ marginTop: 18, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: 'var(--text-4)' }} {...rise(0.36)}>
            No card required · Free forever tier · Your numbers never train anyone’s AI
          </motion.p>
        </div>

        {/* Engine cluster */}
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.1, delay: 0.2, ease: 'easeOut' }}
        >
          <EngineCluster />
        </motion.div>
      </div>
    </section>
  );
}
