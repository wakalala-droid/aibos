'use client';

// ScoreComet — the inner glow for KPI cards. Static ambient corner glow for
// healthy cards; for a numeric score < 60 the glow becomes a comet that traces
// the inner perimeter and returns (see ScoreComet.css). Rendered inside the
// card, behind the content.

import { useEffect, useRef } from 'react';
import './ScoreComet.css';

type Band = 'warning' | 'high' | 'critical';

// dur is the full cycle; ~60% of it is the idle rest (≈10s) and the rest is the
// trip. Lower scores orbit faster + brighter + longer tail + rest less.
const BANDS: Record<Band, { tail: number; dur: number; intensity: number; color: string }> = {
  warning:  { tail: 20, dur: 16, intensity: 1.2, color: 'var(--warn)' },
  high:     { tail: 30, dur: 13, intensity: 1.5, color: 'var(--crit)' },
  critical: { tail: 42, dur: 10, intensity: 1.8, color: 'var(--crit)' },
};

// "60 and below" activates the comet (inclusive of 60).
function bandFor(score: number | undefined): Band | null {
  if (typeof score !== 'number' || score > 60) return null;
  if (score >= 45) return 'warning';
  if (score >= 25) return 'high';
  return 'critical';
}

function colorVars(color: string, intensity: number): Record<string, string> {
  const steps: [string, number][] = [['', 100], ['-50', 50], ['-30', 30], ['-20', 20]];
  const v: Record<string, string> = {};
  for (const [k, op] of steps) v[`--sg-color${k}`] = `color-mix(in srgb, ${color} ${Math.min(op * intensity, 100)}%, transparent)`;
  return v;
}

interface ScoreCometProps {
  /** Accent colour used for the resting ambient glow on healthy cards. */
  color?: string;
  /** 0–100 health score. < 60 turns the glow into a comet. */
  score?: number;
}

export default function ScoreComet({ color = 'var(--cyan)', score }: ScoreCometProps) {
  const ref = useRef<HTMLDivElement>(null);
  const band = bandFor(score);
  const glowColor = band ? BANDS[band].color : color;
  const intensity = band ? BANDS[band].intensity : 1;

  useEffect(() => {
    if (band && ref.current) {
      ref.current.style.setProperty('--sg-delay', `${-(Math.random() * BANDS[band].dur).toFixed(2)}s`);
    }
  }, [band]);

  const vars = {
    ...colorVars(glowColor, intensity),
    ...(band ? { '--sg-tail': `${BANDS[band].tail}deg`, '--sg-dur': `${BANDS[band].dur}s` } : {}),
  } as React.CSSProperties;

  return (
    <div ref={ref} className={`score-glow${band ? ' sev' : ''}`} style={vars} aria-hidden="true">
      <span className="ambient" />
      {band && <span className="comet" />}
    </div>
  );
}
