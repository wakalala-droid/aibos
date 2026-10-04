'use client';

// Plain SVG sparkline (UI/UX audit 2026-10 B8). A KPI card's trend hint used
// to mount a whole Recharts chart with its own resize watcher for a 90px line,
// once per card. This draws the same line and soft fill directly. Decorative:
// the value and the change badge carry the data, so it is hidden from readers.

import { useId } from 'react';

export default function Sparkline({ data, color, width = 90, height = 40 }: {
  data: number[]; color: string; width?: number; height?: number;
}) {
  const id = `spark-${useId().replace(/:/g, '')}`;
  const points = data.filter((v) => Number.isFinite(v));
  if (points.length < 2) return null;

  const min = Math.min(...points);
  const span = Math.max(...points) - min || 1;
  const top = 4, bottom = 2;
  const x = (i: number) => (i / (points.length - 1)) * width;
  const y = (v: number) => top + (1 - (v - min) / span) * (height - top - bottom);
  const line = points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.28 }} />
          <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <path d={`${line} L${width},${height} L0,${height} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" style={{ stroke: color }} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
