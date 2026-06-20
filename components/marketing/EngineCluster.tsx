'use client';

import { useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { ENGINES } from './engines';

// Artful cluster layout (percent coords within the square stage) + per-core
// depth for the cursor-parallax effect. Financial (AI CFO) is the hero core.
const LAYOUT: Record<string, { x: number; y: number; size: number; depth: number; float: string }> = {
  financial:   { x: 50, y: 47, size: 46, depth: 1.0, float: 'mkt-float'   },
  forecasting: { x: 80, y: 24, size: 30, depth: 1.8, float: 'mkt-float-b' },
  customer:    { x: 20, y: 28, size: 30, depth: 1.6, float: 'mkt-float-c' },
  operations:  { x: 23, y: 76, size: 28, depth: 2.0, float: 'mkt-float-b' },
  decision:    { x: 79, y: 75, size: 28, depth: 2.2, float: 'mkt-float-c' },
};

export default function EngineCluster() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  function onMove(e: React.MouseEvent) {
    if (reduce) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // -1..1 relative to centre
    const nx = (e.clientX - r.left) / r.width - 0.5;
    const ny = (e.clientY - r.top) / r.height - 0.5;
    setPos({ x: nx, y: ny });
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={() => setPos({ x: 0, y: 0 })}
      aria-hidden
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 520,
        aspectRatio: '1 / 1',
        margin: '0 auto',
      }}
    >
      {/* ambient glow behind the cluster */}
      <span className="mkt-glow" style={{ inset: '12% 12% 18% 12%', background: 'radial-gradient(circle, rgba(10,143,199,0.5), transparent 65%)' }} />

      {ENGINES.map((eng) => {
        const l = LAYOUT[eng.id];
        const tx = reduce ? 0 : pos.x * -10 * l.depth;
        const ty = reduce ? 0 : pos.y * -10 * l.depth;
        return (
          <div
            key={eng.id}
            style={{
              position: 'absolute',
              left: `${l.x}%`,
              top: `${l.y}%`,
              width: `${l.size}%`,
              transform: `translate(-50%, -50%) translate(${tx}px, ${ty}px)`,
              transition: reduce ? undefined : 'transform 0.35s cubic-bezier(0.22,1,0.36,1)',
              zIndex: eng.id === 'financial' ? 2 : 1,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- decorative inline SVG sprite, not a next/image candidate */}
            <img
              src={eng.sprite}
              alt=""
              loading="eager"
              className={`mkt-engine-sprite ${reduce ? '' : l.float}`}
              draggable={false}
            />
          </div>
        );
      })}
    </div>
  );
}
