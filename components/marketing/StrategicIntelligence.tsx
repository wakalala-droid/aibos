'use client';

// Strategic Intelligence — vertical reveal:
//   1. text on warm white
//   2. a fixed-height reveal band: SOLID white above the rising line (no shadow),
//      a white→navy GRADIENT below it that uncovers the brief; the line draws as
//      you scroll with a glowing tip that travels along it
//   3. the GENUINE Strategic Brief beneath, borderless; only the deepest
//      decisions blur, fading into the next dark section.
// Nothing fabricated — the brief derives its figures + recommendations from a
// coherent demo dataset (DEMO_BRIEF).
import { useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion, useMotionValue, useMotionValueEvent, animate } from 'framer-motion';
import StrategicBriefView from '@/components/dashboard/StrategicBriefView';
import { DEMO_BRIEF } from '@/lib/demoData';

// Smooth, organic rising line with a gentle dip — in a fixed 1200×380 band.
const LINE = 'M0,230 C 60,224 110,216 150,218 C 210,221 262,232 300,226 C 360,218 402,192 430,186 C 482,178 532,188 560,184 C 612,178 650,152 680,150 C 716,148 746,168 772,160 C 802,152 826,134 860,130 C 922,120 966,98 1000,88 C 1056,72 1112,64 1176,52';

export default function StrategicIntelligence() {
  const reduce = useReducedMotion();
  const zoneElRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const startedRef = useRef(false);

  // One progress value drives BOTH the line draw and the tip, so the point
  // always travels with the line.
  const progress = useMotionValue(0);

  const placeTip = (v: number) => {
    const t = tipRef.current;
    const p = (pathRef.current ?? document.querySelector('.si-line path[data-siline]')) as SVGPathElement | null;
    if (!p || !t) return;
    const f = Math.max(0, Math.min(1, v));
    const pt = p.getPointAtLength(p.getTotalLength() * f);
    t.style.left = `${(pt.x / 1200) * 100}%`;
    t.style.top = `${pt.y}px`;
    t.style.opacity = reduce || f > 0.02 ? '1' : '0';
  };
  useMotionValueEvent(progress, 'change', placeTip);

  // Draw the line + travel the tip once the band genuinely enters the viewport
  // (IntersectionObserver fires after layout settles, so it can't trigger early).
  useEffect(() => {
    if (reduce) { progress.set(1); placeTip(1); return; }
    placeTip(0);
    const el = zoneElRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !startedRef.current) {
        startedRef.current = true;
        animate(progress, 1, { duration: 1.8, ease: [0.22, 1, 0.36, 1] });
        io.disconnect();
      }
    }, { rootMargin: '0px 0px -20% 0px' });
    io.observe(el);
    return () => io.disconnect();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [reduce]);

  return (
    <section className="mkt-section si-section" aria-labelledby="si-h">
      {/* 1 · the text — warm white background */}
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

      {/* 2 · reveal band (white above line, gradient below) · 3 · genuine brief */}
      <div className="si-brief-zone" data-theme="dark" ref={zoneElRef}>
        <svg className="si-line" viewBox="0 0 1200 380" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="siLine" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--text-4)" stopOpacity="0.35" />
              <stop offset="40%" stopColor="var(--cyan)" stopOpacity="0.8" />
              <stop offset="100%" stopColor="var(--cyan)" />
            </linearGradient>
            {/* White fading to TRANSPARENT (over the navy brief beneath) — a
                clean reveal, no grey mud. */}
            <linearGradient id="siReveal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f4f3ef" stopOpacity="1" />
              <stop offset="64%" stopColor="#f4f3ef" stopOpacity="0" />
              <stop offset="100%" stopColor="#f4f3ef" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* solid white above the line — no shadow */}
          <path d={`${LINE} L1200,0 L0,0 Z`} fill="#f4f3ef" />
          {/* the gradient below the line — reveals the brief */}
          <path d={`${LINE} L1200,380 L0,380 Z`} fill="url(#siReveal)" />
          <motion.path ref={pathRef} data-siline d={LINE} fill="none" stroke="url(#siLine)" strokeWidth={3} strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ pathLength: progress }} />
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
