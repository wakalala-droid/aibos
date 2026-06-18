'use client';

// BorderGlow — React Bits cursor-driven edge glow (its only job), plus an
// optional, independent Critical-KPI comet for cards scoring < 50.
//   • Cursor layer: glow follows the pointer near the edges. Idle = invisible.
//   • Comet layer (.severity-comet): autonomous; the ambient glow comes alive,
//     traces the perimeter once and reabsorbs. Only when severityScore < 50.

import { useCallback, useEffect, useRef } from 'react';
import './BorderGlow.css';

export type GlowStatus = 'neutral' | 'good' | 'warning' | 'critical';
type Band = 'warning' | 'high' | 'critical';

interface BorderGlowProps {
  children: React.ReactNode;
  className?: string;
  /** Cursor edge-glow colour — any CSS colour. */
  glowColor?: string;
  /** Drives the Critical-KPI comet. < 50 activates it (bands per spec). */
  severityScore?: number;
  /** Fallback comet trigger when no numeric score: 'critical' → high band. */
  status?: GlowStatus;
  backgroundColor?: string;
  borderRadius?: number;
  glowRadius?: number;
  glowIntensity?: number;
  edgeSensitivity?: number;
  coneSpread?: number;
  colors?: string[];
  fillOpacity?: number;
  style?: React.CSSProperties;
}

const BANDS: Record<Band, { tail: number; dur: number; intensity: number; color: string }> = {
  warning:  { tail: 16, dur: 18, intensity: 0.9,  color: 'var(--warn)' },
  high:     { tail: 26, dur: 14, intensity: 1.1,  color: 'var(--crit)' },
  critical: { tail: 38, dur: 11, intensity: 1.45, color: 'var(--crit)' },
};

function severityBand(score: number | undefined, status: GlowStatus | undefined): Band | null {
  if (typeof score === 'number') {
    if (score >= 50) return null;
    if (score >= 40) return 'warning';
    if (score >= 20) return 'high';
    return 'critical';
  }
  return status === 'critical' ? 'high' : null;
}

function glowVars(prefix: string, color: string, intensity: number): Record<string, string> {
  const steps: [string, number][] = [['', 100], ['-60', 60], ['-50', 50], ['-40', 40], ['-30', 30], ['-20', 20], ['-10', 10]];
  const vars: Record<string, string> = {};
  for (const [k, op] of steps) vars[`${prefix}${k}`] = `color-mix(in srgb, ${color} ${Math.min(op * intensity, 100)}%, transparent)`;
  return vars;
}

const GRADIENT_POS = ['80% 55%', '69% 34%', '8% 6%', '41% 38%', '86% 85%', '82% 18%', '51% 4%'];
const GRADIENT_KEYS = ['--gradient-one', '--gradient-two', '--gradient-three', '--gradient-four', '--gradient-five', '--gradient-six', '--gradient-seven'];
const COLOR_MAP = [0, 1, 2, 0, 1, 2, 1];
function gradientVars(colors: string[]): Record<string, string> {
  const vars: Record<string, string> = {};
  for (let i = 0; i < 7; i++) {
    const c = colors[Math.min(COLOR_MAP[i], colors.length - 1)];
    vars[GRADIENT_KEYS[i]] = `radial-gradient(at ${GRADIENT_POS[i]}, ${c} 0px, transparent 50%)`;
  }
  vars['--gradient-base'] = `linear-gradient(${colors[0]} 0 100%)`;
  return vars;
}

export default function BorderGlow({
  children,
  className = '',
  glowColor = 'var(--cyan)',
  severityScore,
  status,
  backgroundColor,
  borderRadius = 14,
  glowRadius = 40,
  glowIntensity = 1,
  edgeSensitivity = 30,
  coneSpread = 25,
  colors = ['#22d3ee', '#60a5fa', '#a78bfa'],
  fillOpacity = 0.45,
  style,
}: BorderGlowProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const cometRef = useRef<HTMLSpanElement>(null);
  const band = severityBand(severityScore, status);

  // ── Cursor edge glow — pointer drives --edge-proximity + --cursor-angle ──
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    const kx = dx !== 0 ? cx / Math.abs(dx) : Infinity;
    const ky = dy !== 0 ? cy / Math.abs(dy) : Infinity;
    const edge = Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);
    let deg = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (deg < 0) deg += 360;
    card.style.setProperty('--edge-proximity', (edge * 100).toFixed(2));
    card.style.setProperty('--cursor-angle', `${deg.toFixed(2)}deg`);
  }, []);

  // Desync comet cycles so they aren't in lockstep (client-only).
  useEffect(() => {
    if (band && cometRef.current) {
      cometRef.current.style.animationDelay = `${-(Math.random() * BANDS[band].dur).toFixed(2)}s`;
    }
  }, [band]);

  const cssVars = {
    '--card-bg': backgroundColor ?? 'var(--bg-card)',
    '--border-radius': `${borderRadius}px`,
    '--glow-padding': `${glowRadius}px`,
    '--edge-sensitivity': edgeSensitivity,
    '--cone-spread': coneSpread,
    '--fill-opacity': fillOpacity,
    ...glowVars('--glow-color', glowColor, glowIntensity),
    ...gradientVars(colors),
    ...(band
      ? {
          '--comet-tail': `${BANDS[band].tail}deg`,
          '--comet-duration': `${BANDS[band].dur}s`,
          ...glowVars('--sev-color', BANDS[band].color, BANDS[band].intensity),
        }
      : {}),
    ...style,
  } as React.CSSProperties;

  return (
    <div ref={cardRef} onPointerMove={handlePointerMove} className={`border-glow-card${className ? ` ${className}` : ''}`} style={cssVars}>
      <span className="edge-light" aria-hidden="true" />
      {band && <span ref={cometRef} className="severity-comet" aria-hidden="true" />}
      <div className="border-glow-inner">{children}</div>
    </div>
  );
}
