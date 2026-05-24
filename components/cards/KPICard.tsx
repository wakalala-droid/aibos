'use client';

import { motion } from 'framer-motion';
import { useCounter } from '@/hooks/useCounter';
import { formatCurrency, formatPercent } from '@/lib/utils';

interface KPICardProps {
  title:       string;
  value:       number;
  delta?:      number;         // % change vs prior period
  format?:     'currency' | 'percent' | 'number' | 'months';
  compact?:    boolean;
  suffix?:     string;
  icon?:       React.ReactNode;
  sparkline?:  number[];       // last N data points
  index?:      number;         // stagger delay
  colour?:     string;         // accent override
  subtitle?:   string;
}

// ─── Sparkline SVG ────────────────────────────────────────────────────────────

function Sparkline({ data, colour }: { data: number[]; colour: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const W = 80, H = 28;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x},${y}`;
  });
  const pathD = `M ${pts.join(' L ')}`;
  const areaD = `M 0,${H} L ${pts.join(' L ')} L ${W},${H} Z`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`sparkGrad-${colour.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colour} stopOpacity="0.25" />
          <stop offset="100%" stopColor={colour} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#sparkGrad-${colour.replace('#','')})`} />
      <path d={pathD} stroke={colour} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Last point dot */}
      <circle
        cx={parseFloat(pts[pts.length - 1].split(',')[0])}
        cy={parseFloat(pts[pts.length - 1].split(',')[1])}
        r={2.5} fill={colour}
      />
    </svg>
  );
}

// ─── Delta Badge ──────────────────────────────────────────────────────────────

function DeltaBadge({ delta }: { delta: number }) {
  const positive = delta >= 0;
  const colour   = positive ? '#10b981' : '#ef4444';
  const bg       = positive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)';

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      background: bg, borderRadius: 6, padding: '2px 7px',
      fontSize: '0.68rem', fontFamily: 'DM Mono, monospace', color: colour, fontWeight: 500,
    }}>
      <svg width={9} height={9} viewBox="0 0 10 10" fill={colour}>
        <path d={positive
          ? 'M5 1L9 9H1L5 1Z'   // up triangle
          : 'M5 9L1 1H9L5 9Z'}  // down triangle
        />
      </svg>
      {Math.abs(delta).toFixed(1)}%
    </span>
  );
}

// ─── Main KPI Card ────────────────────────────────────────────────────────────

export function KPICard({
  title, value, delta, format = 'currency', compact = true,
  suffix, icon, sparkline, index = 0, colour = '#60a5fa', subtitle,
}: KPICardProps) {
  // Animated counter – runs once on mount (and re-runs if value changes)
  const decimals = format === 'percent' ? 1 : format === 'months' ? 0 : 0;
  const animated = useCounter(value, { duration: 1100, delay: index * 80, decimals });

  const displayValue = (() => {
    switch (format) {
      case 'currency': return compact ? formatCurrency(animated, true) : formatCurrency(animated);
      case 'percent':  return `${animated.toFixed(1)}%`;
      case 'months':   return `${Math.round(animated)}${suffix ?? 'mo'}`;
      default:         return `${Math.round(animated)}${suffix ?? ''}`;
    }
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4, ease: 'easeOut' }}
      whileHover={{ y: -2 }}
      style={{
        background:   'rgba(9,13,30,0.72)',
        backdropFilter: 'blur(16px)',
        border:       '1px solid rgba(99,179,237,0.12)',
        borderRadius: 16,
        padding:      '20px 22px',
        position:     'relative',
        overflow:     'hidden',
        cursor:       'default',
        transition:   'border-color 0.2s ease, box-shadow 0.2s ease',
        boxShadow:    '0 4px 24px rgba(0,0,0,0.3)',
      }}
      onHoverStart={e => {
        (e.target as HTMLElement).style?.setProperty?.('border-color', 'rgba(99,179,237,0.28)');
      }}
    >
      {/* Top glow line */}
      <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: `linear-gradient(90deg, transparent, ${colour}55, transparent)`, borderRadius: 1 }} />

      {/* Corner ambient glow */}
      <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: `radial-gradient(circle, ${colour}18 0%, transparent 70%)`, pointerEvents: 'none' }} />

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon && (
            <div style={{ width: 30, height: 30, borderRadius: 8, background: `${colour}18`, border: `1px solid ${colour}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colour, flexShrink: 0 }}>
              {icon}
            </div>
          )}
          <div>
            <p style={{ fontSize: '0.72rem', fontFamily: 'DM Mono, monospace', color: '#4a6285', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {title}
            </p>
            {subtitle && (
              <p style={{ fontSize: '0.62rem', fontFamily: 'DM Mono, monospace', color: '#2d4a70', margin: 0, marginTop: 1 }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {delta !== undefined && <DeltaBadge delta={delta} />}
      </div>

      {/* ── Value ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <p style={{
            fontSize: '1.85rem', fontWeight: 700, fontFamily: 'Outfit, sans-serif',
            color: '#e2eeff', margin: 0, lineHeight: 1, letterSpacing: '-0.02em',
          }}>
            {displayValue}
          </p>
          <p style={{ fontSize: '0.65rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: 0, marginTop: 5 }}>
            vs prior period
          </p>
        </div>
        {sparkline && sparkline.length > 1 && (
          <div style={{ flexShrink: 0, paddingBottom: 4 }}>
            <Sparkline data={sparkline} colour={colour} />
          </div>
        )}
      </div>
    </motion.div>
  );
}
