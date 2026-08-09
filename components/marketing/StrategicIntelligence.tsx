'use client';

// Strategic Intelligence — vertical reveal:
//   1. text on warm white (tight to the line)
//   2. a rising graph line with data dots + a leading tip; below it a cyan
//      area-fill GRADIENT (like the fill under a chart line) that reveals…
//   3. the GENUINE Strategic Brief beneath, borderless; a "see your brief" CTA
//      floats at the brief's fade point; the deepest rows blur into the next
//      (dark) section. Nothing fabricated — derived from DEMO_BRIEF.
import { useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion, useMotionValue, useMotionValueEvent, animate } from 'framer-motion';
// NOTE: the line is drawn with a left→right CLIP WIPE, not stroke-dash/pathLength.
// The band is stretched (preserveAspectRatio="none" maps 1200 user units across a
// ~1900px viewport) and the stroke is non-scaling: with pathLength="1" the browser
// sizes the dash in USER space but dashes along the DEVICE-space path, so a "full"
// dash covered only ~1200/viewportWidth of the line and it stopped short of the
// last dot. Clipping by x has no such mismatch, and since the curve is monotonic
// in x it reveals identically.
import StrategicBriefView from '@/components/dashboard/StrategicBriefView';
import { DEMO_BRIEF } from '@/lib/demoData';

// One clean, confident upward curve (no dips), in a 1200×240 band. The curve
// ends at x=1176 (where the tip dot sits); a short flat tail runs to the right
// edge so the STROKE covers the white/fill boundary there (no faint sliver).
const CURVE = 'M0,132 C 260,126 460,104 680,78 C 880,54 1020,38 1176,22';
const LINE = `${CURVE} L1200,22`;
const TAIL = 24; // viewBox length of the flat tail (1200 - 1176); tip stops before it
const END_Y = 22;
const DOTS = [0.14, 0.33, 0.52, 0.7, 0.86]; // data points along the line

export default function StrategicIntelligence() {
  const reduce = useReducedMotion();
  const zoneElRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const wipeRef = useRef<SVGRectElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const startedRef = useRef(false);
  const progress = useMotionValue(0);

  // Position the tip + dots along the path and reveal them as the line draws.
  const paint = (v: number) => {
    const p = (pathRef.current ?? document.querySelector('.si-line path[data-siline]')) as SVGPathElement | null;
    if (!p) return;
    const total = p.getTotalLength();
    const f = Math.max(0, Math.min(1, v));
    // the wipe edge rides the head of the line, so at f=1 it reaches x=1200 and
    // the whole stroke (including the flat tail) is painted.
    const head = p.getPointAtLength(total * f);
    wipeRef.current?.setAttribute('width', String(head.x + 20));
    const t = tipRef.current;
    if (t) {
      // stop the tip at the end of the CURVE (before the flat tail) so it sits
      // exactly on the dot and the line clearly terminates there.
      const pt = p.getPointAtLength(Math.min(total * f, total - TAIL));
      t.style.left = `${(pt.x / 1200) * 100}%`;
      t.style.top = `${pt.y}px`;
      t.style.opacity = reduce || f > 0.015 ? '1' : '0';
    }
    zoneElRef.current?.querySelectorAll<HTMLElement>('.si-dot').forEach((el) => {
      const f = parseFloat(el.dataset.f || '0');
      const pt = p.getPointAtLength(total * f);
      el.style.left = `${(pt.x / 1200) * 100}%`;
      el.style.top = `${pt.y}px`;
      el.style.opacity = reduce || v >= f ? '1' : '0';
    });
  };
  useMotionValueEvent(progress, 'change', paint);

  useEffect(() => {
    if (reduce) { progress.set(1); paint(1); return; }
    paint(0);
    const el = zoneElRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !startedRef.current) {
        startedRef.current = true;
        animate(progress, 1, { duration: 1.9, ease: [0.22, 1, 0.36, 1] });
        io.disconnect();
      }
    }, { rootMargin: '0px 0px -20% 0px' });
    io.observe(el);
    return () => io.disconnect();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [reduce]);

  return (
    <section className="mkt-section si-section" aria-labelledby="si-h">
      {/* 1 · the text — tight to the line */}
      <div className="mkt-wrap si-top">
        <motion.p className="mkt-eyebrow" initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
          Decision intelligence, made visible
        </motion.p>
        <motion.h2 id="si-h" className="mkt-h2 si-headline" initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.08 }}>
          You’re not making bad decisions.<br />
          <span style={{ color: 'var(--cyan)' }}>You’re just making them without the numbers.</span>
        </motion.h2>
        <motion.p className="mkt-lead" style={{ marginTop: 20, maxWidth: 560 }} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.16 }}>
          The signals that decide whether a month works, like a margin slipping, a
          customer drifting, or cash tightening, stay invisible until it’s too late.
          AIBOS surfaces them while you can still act, and writes the brief for you.
        </motion.p>
      </div>

      {/* 2 · the line + cyan gradient · 3 · the genuine brief beneath */}
      <div className="si-brief-zone" data-theme="dark" ref={zoneElRef}>
        <svg className="si-line" viewBox="0 0 1200 240" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="siLine" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#0aa6dd" />
              <stop offset="55%" stopColor="#00d4ff" />
              <stop offset="100%" stopColor="#22ddff" />
            </linearGradient>
            {/* the gradient that falls from the line — a true chart area-fill:
                cyan right at the line (so the line stays vivid to the tip),
                spilling down and fading to transparent over the navy brief. */}
            <linearGradient id="siReveal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.46" />
              <stop offset="52%" stopColor="#00d4ff" stopOpacity="0.13" />
              <stop offset="100%" stopColor="#00d4ff" stopOpacity="0" />
            </linearGradient>
            {/* left→right wipe that draws the line (width set in paint()) */}
            <clipPath id="siWipe" clipPathUnits="userSpaceOnUse">
              <rect ref={wipeRef} x={-20} y={-60} width={0} height={360} />
            </clipPath>
          </defs>
          {/* solid white above the line; fills extend FLAT to the right edge (no wedge) */}
          <path d={`${LINE} L1200,${END_Y} L1200,0 L0,0 Z`} fill="#f4f3ef" />
          <path d={`${LINE} L1200,${END_Y} L1200,240 L0,240 Z`} fill="url(#siReveal)" />
          <g clipPath="url(#siWipe)">
            <path ref={pathRef} data-siline className="si-graphline" d={LINE} fill="none" stroke="url(#siLine)" strokeWidth={4} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </g>
        </svg>
        {DOTS.map((f) => (<span key={f} className="si-dot" data-f={f} aria-hidden />))}
        <span className="si-tip" ref={tipRef} aria-hidden />

        <div className="mkt-wrap si-brief">
          <StrategicBriefView {...DEMO_BRIEF} sym="K" />
        </div>
        <div className="si-brief-blur" aria-hidden />
        {/* CTA floats at the brief's fade point */}
        <div className="si-cta">
          <Link href="/login" className="mkt-btn mkt-btn-primary">See your brief for free</Link>
        </div>
      </div>
    </section>
  );
}
