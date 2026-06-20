'use client';

// Strategic Intelligence — vertical reveal composition:
//   1. the text, on the warm (white) background
//   2. a growth line that RISES as you scroll, right under the text — its
//      gradient "falls" and fades to reveal…
//   3. the GENUINE Strategic Brief below, rendered borderless on the dark band,
//      with the lower decisions feathered + blurred away (curiosity).
// Nothing is fabricated — the brief derives its own figures + recommendations
// from a coherent demo dataset (DEMO_BRIEF).
import { useRef } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import StrategicBriefView from '@/components/dashboard/StrategicBriefView';
import { DEMO_BRIEF } from '@/lib/demoData';

// rising left→right, in a 1200×200 band that straddles the white→dark seam
const LINE = 'M0,170 C 260,152 430,120 640,94 S 1010,48 1200,30';

export default function StrategicIntelligence() {
  const reduce = useReducedMotion();
  const zoneRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: zoneRef, offset: ['start end', 'center center'] });
  const drawn = useTransform(scrollYProgress, [0, 0.85], [0, 1]);
  const pathLength = reduce ? 1 : drawn;

  return (
    <section className="mkt-section si-section" aria-labelledby="si-h">
      {/* 1 · The text — on the warm background */}
      <div className="mkt-wrap si-top">
        <motion.p className="mkt-eyebrow" initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
          Decision intelligence, made visible
        </motion.p>
        <motion.h2 id="si-h" className="mkt-h2 si-headline" initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.08 }}>
          You’re not making bad decisions.<br />
          <span style={{ color: 'var(--cyan)' }}>You’re just making them without the numbers.</span>
        </motion.h2>
        <motion.p className="mkt-lead" style={{ marginTop: 22, maxWidth: 560 }} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.16 }}>
          The signals that decide whether a month works — a margin slipping, a
          customer drifting, cash tightening — stay invisible until it’s too late.
          AI-BOS surfaces them while you can still act, and writes the brief for you.
        </motion.p>
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.26 }} style={{ marginTop: 28 }}>
          <Link href="/login" className="mkt-btn mkt-btn-primary">See your brief — free</Link>
        </motion.div>
      </div>

      {/* 2 · the rising line  +  3 · the genuine brief, revealed beneath it */}
      <div className="si-brief-zone" data-theme="dark" ref={zoneRef}>
        <svg className="si-line" viewBox="0 0 1200 200" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="siLine" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--text-4)" stopOpacity="0.45" />
              <stop offset="45%" stopColor="var(--cyan)" stopOpacity="0.7" />
              <stop offset="100%" stopColor="var(--cyan)" />
            </linearGradient>
            <linearGradient id="siFall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* the gradient that "falls" from the line — the feathered reveal */}
          <path d={`${LINE} L1200,200 L0,200 Z`} fill="url(#siFall)" />
          <motion.path d={LINE} fill="none" stroke="url(#siLine)" strokeWidth={3} strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ pathLength }} />
        </svg>

        <div className="mkt-wrap si-brief">
          <StrategicBriefView {...DEMO_BRIEF} sym="K" />
        </div>
        <div className="si-brief-blur" aria-hidden />
      </div>
    </section>
  );
}
