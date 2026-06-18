'use client';
import { useId } from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import BorderGlow, { type GlowStatus } from './BorderGlow';

interface KPICardProps {
  label: string;
  sublabel?: string;
  value: string;
  sub?: string;
  growth?: number;
  icon?: React.ReactNode;
  iconBg?: string;
  sparkData?: number[];
  sparkColor?: string;
  delay?: number;
  /** Explicit severity for the attention glow. Overrides growth-derived status. */
  status?: GlowStatus;
  /** Whether rising growth is good (revenue) or bad (costs). Default true. */
  goodWhenUp?: boolean;
}

// Derive an attention severity from a card's growth when not set explicitly.
// Only clearly poor movement raises an alert — mild dips stay neutral so the
// page isn't a sea of pulsing rings (visual noise is failure).
function deriveStatus(growth: number | undefined, goodWhenUp: boolean): GlowStatus {
  if (growth === undefined) return 'neutral';
  const eff = goodWhenUp ? growth : -growth;
  if (eff <= -25) return 'critical';
  if (eff <= -10) return 'warning';
  return 'neutral';
}

export default function KPICard({
  label, sublabel, value, sub = 'vs prior period',
  growth, icon, iconBg = 'rgba(96,165,250,0.15)',
  sparkData, sparkColor = '#60a5fa', delay = 0,
  status, goodWhenUp = true,
}: KPICardProps) {
  const spark = sparkData?.map((v, i) => ({ v, i }));
  // Unique gradient id per card instance so multiple sparklines don't collide.
  const gradId = `kpiSpark-${useId().replace(/:/g, '')}`;
  const resolvedStatus: GlowStatus = status ?? deriveStatus(growth, goodWhenUp);
  // Idle bloom stays the card's own accent so the card looks identical at rest.
  // Severity is communicated by the comet (its colour/speed), not a static tint.
  const bloom = `color-mix(in srgb, ${sparkColor} 20%, transparent)`;

  return (
    <motion.div
      style={{ height: '100%' }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
    <BorderGlow status={resolvedStatus} glowColor={sparkColor} borderRadius={14} style={{ height: '100%' }}>
    <div
      className="kpi-card glow-inner"
      style={{ ['--card-glow' as string]: bloom } as React.CSSProperties}
    >
      {/* Top row: icon + label + growth badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon && (
            <div
              className="kpi-icon"
              style={{ background: iconBg }}
            >
              {icon}
            </div>
          )}
          <div>
            <p className="kpi-label" style={{ margin: 0 }}>{label}</p>
            {sublabel && (
              <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: 'var(--text-4)', margin: 0 }}>
                {sublabel}
              </p>
            )}
          </div>
        </div>
        {growth !== undefined && (
          <span className={`kpi-badge ${growth >= 0 ? 'up' : 'down'}`}>
            {growth >= 0 ? '▲' : '▼'} {Math.abs(growth).toFixed(1)}%
          </span>
        )}
      </div>

      {/* Value */}
      <p className="kpi-value">{value}</p>

      {/* Sub + sparkline row */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <p className="kpi-sub">{sub}</p>
        {spark && spark.length > 1 && (
          <div style={{ width: 90, height: 40, marginBottom: -4 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={sparkColor} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={sparkColor}
                  strokeWidth={1.8}
                  // Shaded region below the line on every KPI sparkline.
                  fill={`url(#${gradId})`}
                  fillOpacity={1}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
    </BorderGlow>
    </motion.div>
  );
}
