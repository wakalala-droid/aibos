'use client';

// BorderGlow — AI-BOS adaptation (rest → orbit → rest). A card rests with its
// corner bloom at the top-right; every ~10s a comet emerges, orbits the border
// and settles back. Severity tints the comet amber/red. See BorderGlow.css.

import './BorderGlow.css';

export type GlowStatus = 'neutral' | 'good' | 'warning' | 'critical';

interface BorderGlowProps {
  children: React.ReactNode;
  className?: string;
  status?: GlowStatus;
  /** Comet/halo colour for non-severity cards — any CSS colour (hex or var()). */
  glowColor?: string;
  backgroundColor?: string;
  borderRadius?: number;
  glowRadius?: number;
  glowIntensity?: number;
  /** Full rest+orbit cycle length. Default 13s (~10s rest + ~3s orbit). */
  orbitDuration?: string;
  style?: React.CSSProperties;
}

const SEVERITY_COLOR: Record<GlowStatus, string> = {
  neutral: 'var(--cyan)',
  good: 'var(--good)',
  warning: 'var(--warn)',
  critical: 'var(--crit)',
};

// 7 opacity stops of the glow colour, used by the comet's box-shadows.
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
  glowColor,
  backgroundColor,
  borderRadius = 14,
  glowRadius = 40,
  glowIntensity,
  orbitDuration = '13s',
  style,
}: BorderGlowProps) {
  const isAlert = status === 'warning' || status === 'critical';
  // Severity forces amber/red; otherwise use the card's accent (or cyan).
  const color = isAlert ? SEVERITY_COLOR[status] : (glowColor ?? SEVERITY_COLOR.neutral);
  const intensity = glowIntensity ?? (status === 'critical' ? 1.3 : 1);

  const cssVars = {
    '--card-bg': backgroundColor ?? 'var(--bg-card)',
    '--border-radius': `${borderRadius}px`,
    '--glow-padding': `${glowRadius}px`,
    '--glow-edge': SEVERITY_COLOR[status],
    '--orbit-duration': orbitDuration,
    ...buildGlowVars(color, intensity),
    ...style,
  } as React.CSSProperties;

  return (
    <div className={`border-glow-card${isAlert ? ' alert' : ''}${className ? ` ${className}` : ''}`} style={cssVars}>
      <span className="edge-light" aria-hidden="true" />
      <div className="border-glow-inner">{children}</div>
    </div>
  );
}
