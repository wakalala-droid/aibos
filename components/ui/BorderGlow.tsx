'use client';

// BorderGlow — the existing top-right ambient glow, brought to life as a comet
// that traces the card perimeter and returns home (see BorderGlow.css).
// Severity scales brightness, orbit speed, tail length and cycle frequency:
//   healthy (neutral/good) — very subtle, slow, small tail, long idle
//   warning — brighter, a little faster, medium tail
//   critical — brightest, fastest, longest tail, most frequent

import { useEffect, useRef } from 'react';
import './BorderGlow.css';

export type GlowStatus = 'neutral' | 'good' | 'warning' | 'critical';

interface BorderGlowProps {
  children: React.ReactNode;
  className?: string;
  status?: GlowStatus;
  /** Comet colour for healthy cards — any CSS colour (hex or var()). */
  glowColor?: string;
  backgroundColor?: string;
  borderRadius?: number;
  glowRadius?: number;
  style?: React.CSSProperties;
}

// Per-severity tuning. `color` of undefined → use the card's accent (glowColor).
const CFG: Record<GlowStatus, { tail: number; dur: number; intensity: number; color?: string }> = {
  neutral:  { tail: 11, dur: 18, intensity: 0.7 },
  good:     { tail: 11, dur: 18, intensity: 0.75 },
  warning:  { tail: 22, dur: 15, intensity: 1.05, color: 'var(--warn)' },
  critical: { tail: 36, dur: 12, intensity: 1.35, color: 'var(--crit)' },
};

function buildGlowVars(color: string, intensity: number): Record<string, string> {
  const steps: [string, number][] = [['', 100], ['-60', 60], ['-50', 50], ['-40', 40], ['-30', 30], ['-20', 20], ['-10', 10]];
  const vars: Record<string, string> = {};
  for (const [k, op] of steps) {
    vars[`--glow-color${k}`] = `color-mix(in srgb, ${color} ${Math.min(op * intensity, 100)}%, transparent)`;
  }
  return vars;
}

export default function BorderGlow({
  children,
  className = '',
  status = 'neutral',
  glowColor = 'var(--cyan)',
  backgroundColor,
  borderRadius = 14,
  glowRadius = 32,
  style,
}: BorderGlowProps) {
  const lightRef = useRef<HTMLSpanElement>(null);
  const cfg = CFG[status];
  const color = cfg.color ?? glowColor;

  // Desync each card's cycle so comets don't all move in lockstep (more
  // cinematic, and spreads the paint cost). Client-only to avoid SSR mismatch.
  useEffect(() => {
    if (lightRef.current) {
      lightRef.current.style.animationDelay = `${-(Math.random() * cfg.dur).toFixed(2)}s`;
    }
  }, [cfg.dur]);

  const cssVars = {
    '--card-bg': backgroundColor ?? 'var(--bg-card)',
    '--border-radius': `${borderRadius}px`,
    '--glow-padding': `${glowRadius}px`,
    '--orbit-duration': `${cfg.dur}s`,
    '--comet-tail': `${cfg.tail}deg`,
    ...buildGlowVars(color, cfg.intensity),
    ...style,
  } as React.CSSProperties;

  return (
    <div className={`border-glow-card${className ? ` ${className}` : ''}`} style={cssVars}>
      <span ref={lightRef} className="edge-light" aria-hidden="true" />
      <div className="border-glow-inner">{children}</div>
    </div>
  );
}
