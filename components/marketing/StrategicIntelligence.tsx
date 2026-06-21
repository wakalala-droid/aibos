'use client';

// Strategic Intelligence — vertical reveal:
//   1. the text, on the warm (white) background
//   2. a white→navy GRADIENT that reveals the brief, with a growth line that
//      draws as you scroll and a glowing tip that travels along it
//   3. the GENUINE Strategic Brief, borderless; the feather/blur begins well
//      past the Financial Health block and fades into the next dark section.
// Nothing fabricated — the brief derives its own figures + recommendations
// from a coherent demo dataset (DEMO_BRIEF).
import { useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion, useScroll, useTransform, useMotionValueEvent } from 'framer-motion';
import StrategicBriefView from '@/components/dashboard/StrategicBriefView';
import { DEMO_BRIEF } from '@/lib/demoData';

// Smooth, organic data line (rises L→R with a gentle dip) — matches the
// hand-drawn reference. viewBox 1200×1000 spans the whole zone.
const LINE = 'M0,150 C 60,146 110,140 150,142 C 210,145 262,154 300,150 C 360,144 402,124 430,120 C 482,114 532,121 560,118 C 612,114 650,98 680,96 C 716,94 746,109 772,104 C 802,99 826,88 860,86 C 922,81 966,66 1000,58 C 1056,45 1112,40 1176,30';

export default function StrategicIntelligence() {
  const reduce = useReducedMotion();
  const zoneRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const { scrollYProgress } = useScroll({ target: zoneRef, offset: ['start end', 'center center'] });
  const drawn = useTransform(scrollYProgress, [0, 0.82], [0, 1]);
  const pathLength = reduce ? 1 : drawn;

  // Move the glowing tip to the leading end of the drawn line (viewBox coords →
  // % of the zone, since the SVG covers the zone via preserveAspectRatio=none).
  const placeTip = (v: number) => {
    const p = pathRef.current, t = tipRef.current;
    if (!p || !t) return;
    const f = Math.max(0, Math.min(1, v));
    const pt = p.getPointAtLength(p.getTotalLength() * f);
    t.style.left = `${(pt.x / 1200) * 100}%`;
    t.style.top = `${(pt.y / 1000) * 100}%`;
    t.style.opacity = reduce || v > 0.015 ? '1' : '0';
  };
  useMotionValueEvent(drawn, 'change', placeTip);
  useEffect(() => { placeTip(reduce ? 1 : drawn.get()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

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

      {/* 2 · the gradient reveal + rising line  ·  3 · the genuine brief beneath */}
      <div className="si-brief-zone" data-theme="dark" ref={zoneRef}>
        <svg className="si-line" viewBox="0 0 1200 1000" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="siLine" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--text-4)" stopOpacity="0.35" />
              <stop offset="40%" stopColor="var(--cyan)" stopOpacity="0.75" />
              <stop offset="100%" stopColor="var(--cyan)" />
            </linearGradient>
          </defs>
          <motion.path ref={pathRef} d={LINE} fill="none" stroke="url(#siLine)" strokeWidth={3} strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ pathLength }} />
        </svg>
        <span className="si-tip" ref={tipRef} aria-hidden />

        <div className="mkt-wrap si-brief">
          <StrategicBriefView {...DEMO_BRIEF} sym="K" />
        </div>
        <div className="si-brief-blur" aria-hidden />
      </div>
    </section>
  );
}
