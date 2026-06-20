'use client';

// Strategic Intelligence — vertical reveal:
//   1. the text, on the warm (white) background
//   2. a growth line that RISES as you scroll — it cuts the white cleanly
//      (no shadow) and below it the dark brief is revealed
//   3. the GENUINE Strategic Brief, borderless; the feather begins after the
//      Financial Health block and fades into the next (dark) section.
// Nothing fabricated — the brief derives its own figures + recommendations
// from a coherent demo dataset (DEMO_BRIEF).
import { useRef } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import StrategicBriefView from '@/components/dashboard/StrategicBriefView';
import { DEMO_BRIEF } from '@/lib/demoData';

// Organic data-style line (rises L→R with a dip near the right) in a 1200×1000
// viewBox that spans the whole dark zone; everything BELOW it is filled dark so
// the line is a crisp white→dark divider.
const LINE = 'M0,150 C 80,146 110,140 150,140 C 200,140 232,126 272,128 C 322,130 352,118 392,120 C 442,122 470,130 500,118 C 542,102 560,86 600,86 C 650,86 672,76 702,84 C 732,92 746,112 778,106 C 808,100 818,82 848,76 C 908,66 968,48 1028,42 C 1088,36 1138,32 1176,27';

export default function StrategicIntelligence() {
  const reduce = useReducedMotion();
  const zoneRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: zoneRef, offset: ['start end', 'center center'] });
  const drawn = useTransform(scrollYProgress, [0, 0.8], [0, 1]);
  const tipOpacity = useTransform(scrollYProgress, [0.5, 0.78], [0, 1]);
  const pathLength = reduce ? 1 : drawn;

  return (
    <section className="mkt-section si-section" aria-labelledby="si-h">
      {/* 1 · the text — on the warm background */}
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

      {/* 2 · the rising line cutting the white  +  3 · the genuine brief beneath */}
      <div className="si-brief-zone" data-theme="dark" ref={zoneRef}>
        <svg className="si-line" viewBox="0 0 1200 1000" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="siLine" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--text-4)" stopOpacity="0.4" />
              <stop offset="40%" stopColor="var(--cyan)" stopOpacity="0.75" />
              <stop offset="100%" stopColor="var(--cyan)" />
            </linearGradient>
          </defs>
          {/* everything below the line is dark — the crisp white→dark cut */}
          <path d={`${LINE} L1200,27 L1200,1000 L0,1000 Z`} fill="#0a0e1a" />
          <motion.path d={LINE} fill="none" stroke="url(#siLine)" strokeWidth={3} strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ pathLength }} />
        </svg>
        {/* glowing tip at the leading end of the line */}
        <motion.span className="si-tip" style={{ opacity: reduce ? 1 : tipOpacity }} aria-hidden />

        <div className="mkt-wrap si-brief">
          <StrategicBriefView {...DEMO_BRIEF} sym="K" />
        </div>
        <div className="si-brief-blur" aria-hidden />
      </div>
    </section>
  );
}
