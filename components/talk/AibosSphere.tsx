'use client';

// components/talk/AibosSphere.tsx
// The AIBOS sphere (owner, 17 Nov 2026): what the owner sees while they talk
// to AIBOS. A glass sphere with water moving inside it, blue and white with
// one gold light, the AIBOS mark in the middle, and the voice drawn either
// side as bars. Drawn on a canvas, so it is one element however lively it is.
//
// It moves with the conversation, never on its own clock for show:
//   speaking / briefing  the water runs fast and the bars follow a voice
//   listening            calm water that jumps each time a word is heard
//   thinking             a slow swirl, the gold light brighter
//   idle                 almost still (the small sphere on a button)
// With reduced motion it is one still picture.

import { useEffect, useRef } from 'react';
import { BrandMark } from '@/components/kit';

export type SpherePhase = 'idle' | 'listening' | 'speaking' | 'briefing' | 'thinking';

const TARGET: Record<SpherePhase, number> = { idle: 0.05, listening: 0.2, speaking: 0.7, briefing: 0.7, thinking: 0.14 };

/** Something like the loudness of a voice: a few sines, never smooth. */
function voice(t: number): number {
  const v = Math.sin(t * 7.3) + 0.6 * Math.sin(t * 11.1 + 1.3) + 0.8 * Math.sin(t * 3.1 + 0.5) + 0.4 * Math.sin(t * 17.9);
  return Math.min(1, Math.abs(v) / 2.2);
}

export default function AibosSphere({ size = 280, phase = 'idle', pulse = 0, bars = false, width, still = false, label }: {
  /** The sphere's height and width in px. */
  size?: number;
  phase?: SpherePhase;
  /** Change it (a word heard) and the water jumps. */
  pulse?: number | string;
  /** The voice bars either side. */
  bars?: boolean;
  /** Width of the whole drawing when bars are shown. */
  width?: number;
  /** Draw one picture and stop. */
  still?: boolean;
  label?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef(phase);
  const bump = useRef(0);
  phaseRef.current = phase;

  useEffect(() => { bump.current = 0.75; }, [pulse]);

  const W = bars ? Math.max(size, width ?? size * 3) : size;
  const H = size;

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    el.width = Math.round(W * dpr);
    el.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const cx = W / 2;
    const cy = H / 2;
    const R = size * 0.4;
    let level = TARGET[phaseRef.current];
    let raf = 0;
    let water = 0;          // how far the water has run, faster when louder
    const start = performance.now();

    const ribbon = (t: number, k: number, lv: number) => {
      // Four bands of water, each a strip between two waves, tilted and turning slowly.
      const spec = [
        { off: -0.46, amp: 0.16, freq: 2.1, speed: 0.9, thick: 0.26, tilt: -0.5, tone: 'blue' },
        { off: 0.40, amp: 0.18, freq: 1.7, speed: -0.7, thick: 0.30, tilt: -0.35, tone: 'blue' },
        { off: -0.30, amp: 0.10, freq: 2.6, speed: 1.2, thick: 0.10, tilt: -0.62, tone: 'gold' },
        { off: 0.62, amp: 0.12, freq: 2.3, speed: 1.0, thick: 0.14, tilt: -0.2, tone: 'white' },
      ][k];
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(spec.tilt + Math.sin(t * 0.13 + k) * 0.08);
      const amp = R * spec.amp * (1 + lv * 1.4);
      const phaseShift = water * spec.speed + k * 1.7;
      ctx.beginPath();
      for (let i = 0; i <= 48; i++) {
        const x = -R * 1.2 + (2.4 * R * i) / 48;
        const y = R * spec.off + amp * Math.sin((x / R) * spec.freq + phaseShift);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      for (let i = 48; i >= 0; i--) {
        const x = -R * 1.2 + (2.4 * R * i) / 48;
        const th = R * spec.thick * (0.65 + 0.35 * Math.sin((x / R) * 1.3 + water * 0.6 + k));
        const y = R * spec.off + amp * Math.sin((x / R) * spec.freq + phaseShift + 0.5) + th;
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      const g = ctx.createLinearGradient(-R, 0, R, 0);
      if (spec.tone === 'gold') {
        const a = 0.35 + (phaseRef.current === 'thinking' ? 0.3 : 0) + lv * 0.2;
        g.addColorStop(0, 'rgba(255,190,90,0)');
        g.addColorStop(0.55, `rgba(255,200,110,${a})`);
        g.addColorStop(1, 'rgba(255,190,90,0)');
      } else if (spec.tone === 'white') {
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.4, 'rgba(220,235,255,0.45)');
        g.addColorStop(1, 'rgba(59,130,246,0.1)');
      } else {
        g.addColorStop(0, 'rgba(37,99,235,0)');
        g.addColorStop(0.35, 'rgba(96,165,250,0.55)');
        g.addColorStop(0.6, 'rgba(235,244,255,0.6)');
        g.addColorStop(1, 'rgba(29,78,216,0.15)');
      }
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();
    };

    const voiceBars = (t: number, lv: number) => {
      const side = cx - R * 1.45;
      if (side < 24) return;
      const n = Math.max(8, Math.floor(side / 14));
      for (const dir of [-1, 1]) {
        for (let i = 0; i < n; i++) {
          const x = cx + dir * (R * 1.45 + i * (side / n));
          const along = i / (n - 1);
          // Tallest a third of the way out, dots at the far ends.
          const env = Math.exp(-Math.pow((along - 0.32) / 0.28, 2));
          const wobble = 0.55 + 0.45 * Math.sin(t * 9 + i * 1.7 + (dir > 0 ? 0.9 : 0));
          const h = Math.max(3, H * 0.42 * env * (0.12 + lv * 0.88) * wobble);
          const bright = env > 0.6 && lv > 0.3;
          ctx.fillStyle = bright ? 'rgba(226,236,255,0.95)' : `rgba(59,130,246,${0.35 + env * 0.55})`;
          const bw = h <= 3.5 ? 3 : 2.5;
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') ctx.roundRect(x - bw / 2, cy - h / 2, bw, h, bw / 2);
          else ctx.rect(x - bw / 2, cy - h / 2, bw, h);    // older Safari
          ctx.fill();
        }
      }
    };

    const draw = (now: number) => {
      const t = (now - start) / 1000;
      const p = phaseRef.current;
      let target = TARGET[p];
      if (p === 'speaking' || p === 'briefing') target = 0.3 + 0.7 * voice(t);
      bump.current *= 0.94;
      target = Math.min(1, target + bump.current);
      level += (target - level) * 0.15;
      water += 0.016 * (0.6 + level * 3.2) * (p === 'thinking' ? 0.7 : 1);

      ctx.clearRect(0, 0, W, H);

      // The light under it and around it.
      const glow = ctx.createRadialGradient(cx, cy, R * 0.85, cx, cy, R * 1.45);
      glow.addColorStop(0, `rgba(37,99,235,${0.4 + level * 0.35})`);
      glow.addColorStop(1, 'rgba(37,99,235,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.45, 0, Math.PI * 2); ctx.fill();

      if (bars) voiceBars(t, level);

      // The glass: dark in the middle, blue at the rim.
      const body = ctx.createRadialGradient(cx - R * 0.15, cy - R * 0.15, R * 0.1, cx, cy, R);
      body.addColorStop(0, '#02040c');
      body.addColorStop(0.62, '#050d26');
      body.addColorStop(0.9, '#0c2f86');
      body.addColorStop(1, '#3b7bff');
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

      // The water, inside the glass.
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.985, 0, Math.PI * 2); ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 4; k++) ribbon(t, k, level);
      ctx.globalCompositeOperation = 'source-over';
      // Keep the middle dark enough for the mark.
      const hole = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.42);
      hole.addColorStop(0, 'rgba(2,4,12,0.85)');
      hole.addColorStop(1, 'rgba(2,4,12,0)');
      ctx.fillStyle = hole;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      ctx.restore();

      // The rim and its shine.
      const rim = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      rim.addColorStop(0, 'rgba(255,255,255,0.9)');
      rim.addColorStop(0.45, 'rgba(96,165,250,0.7)');
      rim.addColorStop(1, 'rgba(147,197,253,0.9)');
      ctx.strokeStyle = rim;
      ctx.lineWidth = Math.max(1.5, R * 0.018);
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      const shine = ctx.createRadialGradient(cx - R * 0.42, cy - R * 0.5, 0, cx - R * 0.42, cy - R * 0.5, R * 0.55);
      shine.addColorStop(0, 'rgba(255,255,255,0.22)');
      shine.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = shine;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

      if (!still && !reduce) raf = requestAnimationFrame(draw);
    };

    // The first picture now, so the sphere is never an empty box while the
    // page waits for its first animation frame; draw() carries on from there.
    draw(still || reduce ? start + 1200 : performance.now());
    return () => cancelAnimationFrame(raf);
  }, [W, H, size, bars, still]);

  return (
    <div className="aibos-sphere" style={{ width: W, height: H }} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <canvas ref={canvas} style={{ width: W, height: H, display: 'block' }} />
      <span className="aibos-sphere-mark"><BrandMark size={Math.round(size * 0.17)} theme="dark" /></span>
    </div>
  );
}
