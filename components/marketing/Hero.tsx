'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { DashboardPanel } from './ProductPanels';

export default function Hero() {
  const reduce = useReducedMotion();
  const rise = (delay: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, delay, ease: 'easeOut' as const },
  });

  return (
    <section style={{ position: 'relative', overflow: 'hidden', paddingTop: 'clamp(40px, 6vw, 80px)', paddingBottom: 'clamp(40px, 6vw, 80px)' }}>
      <span className="mkt-glow" style={{ top: '-14%', right: '-8%', width: 600, height: 600, background: 'radial-gradient(circle, rgba(224,121,42,0.26), transparent 60%)' }} />
      <span className="mkt-glow" style={{ bottom: '-24%', left: '-10%', width: 520, height: 520, background: 'radial-gradient(circle, rgba(124,92,240,0.20), transparent 62%)' }} />

      <div
        className="mkt-wrap mkt-hero-grid"
        style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: '1.02fr 1.18fr', gap: 'clamp(28px, 5vw, 64px)', alignItems: 'center' }}
      >
        {/* Copy */}
        <div>
          <motion.p className="mkt-eyebrow" {...rise(0)}>
            The brain behind every business
          </motion.p>
          <motion.h1 className="mkt-display" {...rise(0.08)}>
            Ask your business{' '}
            <span style={{ color: 'var(--cyan)' }}>anything.</span>
          </motion.h1>
          <motion.p className="mkt-lead" style={{ marginTop: 24, maxWidth: 480 }} {...rise(0.18)}>
            Upload your numbers and get the answer — in Kwacha, in seconds. AI-BOS is
            the AI business operating system that gives African SMEs a CFO, analyst
            and consultant in their pocket.
          </motion.p>

          <motion.div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 32 }} {...rise(0.28)}>
            <Link href="/login" className="mkt-btn mkt-btn-primary">
              Start free — upload your data
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Link>
            <Link href="/pricing" className="mkt-btn mkt-btn-secondary">See pricing</Link>
          </motion.div>

          <motion.p style={{ marginTop: 20, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.74rem', color: 'var(--text-4)' }} {...rise(0.36)}>
            No card required · Free forever tier · Your numbers never train anyone’s AI
          </motion.p>
        </div>

        {/* Real dashboard panel — the product, with data, on day one */}
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, delay: 0.2, ease: 'easeOut' }}
        >
          <DashboardPanel />
        </motion.div>
      </div>
    </section>
  );
}
