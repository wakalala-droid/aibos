'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useCounter } from '@/hooks/useCounter';
import { useStore } from '@/lib/store';

export function HealthRing() {
  const health = useStore(s => s.health);
  const score  = useCounter(health.score, { duration: 1400, delay: 200 });

  const R   = 56;   // radius
  const C   = 2 * Math.PI * R;
  const arc = C * (1 - score / 100);

  const colour = health.colour;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, delay: 0.1 }}
      style={{
        background:   'rgba(9,13,30,0.72)',
        backdropFilter: 'blur(16px)',
        border:       '1px solid rgba(99,179,237,0.12)',
        borderRadius: 16,
        padding:      '22px',
        display:      'flex',
        alignItems:   'center',
        gap:          24,
        boxShadow:    '0 4px 24px rgba(0,0,0,0.3)',
        position:     'relative',
        overflow:     'hidden',
      }}
    >
      {/* Top glow */}
      <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: `linear-gradient(90deg, transparent, ${colour}55, transparent)` }} />

      {/* ── Ring ──────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <svg width={136} height={136} viewBox="0 0 136 136">
          <defs>
            <linearGradient id="healthGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={colour} />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {/* Track */}
          <circle
            cx={68} cy={68} r={R}
            fill="none"
            stroke="rgba(99,179,237,0.1)"
            strokeWidth={10}
          />

          {/* Progress arc */}
          <motion.circle
            cx={68} cy={68} r={R}
            fill="none"
            stroke="url(#healthGrad)"
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={C}
            initial={{ strokeDashoffset: C }}
            animate={{ strokeDashoffset: arc }}
            transition={{ duration: 1.4, delay: 0.25, ease: 'easeOut' }}
            transform="rotate(-90 68 68)"
            filter="url(#glow)"
          />

          {/* Score text */}
          <text
            x={68} y={62}
            textAnchor="middle"
            fill="#e2eeff"
            fontSize={26}
            fontWeight={700}
            fontFamily="Outfit, sans-serif"
          >
            {Math.round(score)}
          </text>
          <text
            x={68} y={78}
            textAnchor="middle"
            fill={colour}
            fontSize={10}
            fontFamily="DM Mono, monospace"
            letterSpacing="0.06em"
          >
            {health.label.toUpperCase()}
          </text>
          <text
            x={68} y={90}
            textAnchor="middle"
            fill="#4a6285"
            fontSize={8}
            fontFamily="DM Mono, monospace"
          >
            /100
          </text>
        </svg>
      </div>

      {/* ── Stats ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '0.72rem', fontFamily: 'DM Mono, monospace', color: '#4a6285', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0, marginBottom: 12 }}>
          Financial Health
        </p>

        {[
          { label: 'Best Month',  value: health.bestMonth,  sub: `$${(health.bestValue / 1000).toFixed(0)}K profit`, colour: '#10b981' },
          { label: 'Worst Month', value: health.worstMonth, sub: `$${(health.worstValue / 1000).toFixed(0)}K profit`, colour: '#f59e0b' },
        ].map(row => (
          <div key={row.label} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
              <span style={{ fontSize: '0.72rem', color: '#4a6285', fontFamily: 'DM Mono, monospace' }}>{row.label}</span>
              <span style={{ fontSize: '0.78rem', color: row.colour, fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>{row.value}</span>
            </div>
            <div style={{ height: 3, background: 'rgba(99,179,237,0.1)', borderRadius: 2, overflow: 'hidden' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: row.label === 'Best Month' ? '90%' : '35%' }}
                transition={{ duration: 1, delay: 0.5 }}
                style={{ height: '100%', borderRadius: 2, background: row.colour }}
              />
            </div>
            <p style={{ fontSize: '0.62rem', color: '#2d4a70', fontFamily: 'DM Mono, monospace', margin: 0, marginTop: 2 }}>{row.sub}</p>
          </div>
        ))}

        {/* Score bar */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: '0.65rem', color: '#4a6285', fontFamily: 'DM Mono, monospace' }}>Score breakdown</span>
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            {['Revenue Growth', 'Margin Stability', 'Cost Efficiency', 'Cash Position'].map((seg, i) => {
              const pcts = [92, 74, 68, 78];
              return (
                <div key={seg} style={{ flex: 1 }}>
                  <motion.div
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ delay: 0.6 + i * 0.1, duration: 0.4 }}
                    style={{
                      height: 4, borderRadius: 2,
                      background: i === 0 ? '#10b981' : i === 1 ? '#60a5fa' : i === 2 ? '#f59e0b' : '#06b6d4',
                      opacity: 0.7 + i * 0.08,
                    }}
                  />
                  <p style={{ fontSize: '0.52rem', color: '#2d4a70', fontFamily: 'DM Mono, monospace', marginTop: 3, textAlign: 'center' }}>{pcts[i]}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
