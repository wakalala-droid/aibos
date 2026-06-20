'use client';

// Strategic Intelligence — "you're just making decisions without the numbers".
// Dark section so the GENUINE Strategic Brief (the real StrategicBriefView, fed
// seeded data) renders borderless and blends into the background. A rising
// growth line sits IN FRONT of the brief — it's what "reveals" it: above the
// line the brief is clear; below, a feathered, colour-preserving blur fades the
// lower decisions into the dark bg (curiosity). Nothing is fabricated — the
// brief derives its own figures and recommendations from the demo dataset.
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import StrategicBriefView from '@/components/dashboard/StrategicBriefView';
import { DEMO_BRIEF } from '@/lib/demoData';

const NODES = [
  { x: 60, y: 470, delay: 0.2 },
  { x: 430, y: 410, delay: 0.7 },
  { x: 720, y: 300, delay: 1.2 },
  { x: 1150, y: 130, delay: 1.7, end: true },
];
const LINE = 'M60,470 C 250,458 320,432 430,410 S 620,362 720,300 S 1010,180 1150,130';

export default function StrategicIntelligence() {
  const reduce = useReducedMotion();

  return (
    <section className="mkt-section mkt-dark si-section" data-theme="dark" aria-labelledby="si-h">
      {/* Rising growth line — IN FRONT of the brief (z above), the reveal edge */}
      <svg className="si-graph" viewBox="0 0 1200 600" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="siLine" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--text-4)" stopOpacity="0.5" />
            <stop offset="45%" stopColor="var(--cyan)" stopOpacity="0.7" />
            <stop offset="100%" stopColor="var(--cyan)" />
          </linearGradient>
          <linearGradient id="siFall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* soft gradient "fall" beneath the line — the feather it casts downward */}
        <motion.path
          d={`${LINE} L1150,600 L60,600 Z`} fill="url(#siFall)"
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1.4, delay: 0.6 }}
        />
        <motion.path
          d={LINE} fill="none" stroke="url(#siLine)" strokeWidth={3} strokeLinecap="round" vectorEffect="non-scaling-stroke"
          initial={reduce ? { pathLength: 1 } : { pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: 1.8, ease: 'easeInOut' }}
        />
      </svg>
      <div className="si-nodes" aria-hidden>
        {NODES.map((nd, i) => (
          <motion.span key={i} className={`si-node${nd.end ? ' si-node-end' : ''}`} style={{ left: `${nd.x / 12}%`, top: `${nd.y / 6}%` }}
            initial={reduce ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.2 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: reduce ? 0 : nd.delay }} />
        ))}
      </div>

      <div className="mkt-wrap si-grid">
        {/* LEFT — the problem (front-most so it stays readable) */}
        <div className="si-left">
          <motion.p className="mkt-eyebrow" initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
            Decision intelligence, made visible
          </motion.p>
          <motion.h2 id="si-h" className="mkt-h2" initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.08 }}>
            You’re not making bad decisions.<br />
            <span style={{ color: 'var(--cyan)' }}>You’re just making them without the numbers.</span>
          </motion.h2>
          <motion.p className="mkt-lead" style={{ marginTop: 24, maxWidth: 440 }} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.18 }}>
            The signals that decide whether a month works — a margin slipping, a
            customer drifting, cash tightening — stay invisible until it’s too late.
            AI-BOS surfaces them while you can still act, and writes the brief for you.
          </motion.p>
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.3 }} style={{ marginTop: 30 }}>
            <Link href="/login" className="mkt-btn mkt-btn-primary">See your brief — free</Link>
          </motion.div>
        </div>

        {/* RIGHT — the GENUINE Strategic Brief, borderless, feathered at the bottom */}
        <div className="si-brief-wrap">
          <div className="si-brief">
            <StrategicBriefView {...DEMO_BRIEF} sym="K" />
          </div>
          <div className="si-brief-blur" aria-hidden />
        </div>
      </div>
    </section>
  );
}
