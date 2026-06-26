'use client';
import { useId } from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import BorderGlow from './BorderGlow';
import { cometProps } from '@/lib/cometStyle';

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
  /** 0–100 health score; < 60 turns the inner glow into a comet. */
  score?: number;
  /** Whether rising is good (revenue) or bad (costs). Controls badge colour. */
  goodWhenUp?: boolean;
  /** Knowledge-base id — long-press the card to have the AI assistant explain it. */
  explainId?: string;
}

// Cursor edge-glow tuning shared by every KPI card (hsl "h s l" per React Bits).
const CURSOR_GLOW = '190 95 62';
const MESH = ['#22d3ee', '#60a5fa', '#a78bfa'];

export default function KPICard({
  label, sublabel, value, sub = 'vs prior period',
  growth, icon, iconBg = 'rgba(96,165,250,0.15)',
  sparkData, sparkColor = '#60a5fa', delay = 0, score, goodWhenUp = true,
  explainId,
}: KPICardProps) {
  const spark = sparkData?.map((v, i) => ({ v, i }));
  const gradId = `kpiSpark-${useId().replace(/:/g, '')}`;
  // Badge colour reflects good/bad, not just direction: rising costs are red.
  const badgeGood = growth !== undefined && (goodWhenUp ? growth >= 0 : growth <= 0);
  // The card's own inner glow → comet config (score ≤ 60). Not a separate layer.
  const comet = cometProps(score, sparkColor);

  return (
    <motion.div
      style={{ height: '100%' }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
    <BorderGlow
      glowColor={CURSOR_GLOW}
      backgroundColor="var(--bg-card)"
      borderRadius={14}
      glowRadius={48}
      glowIntensity={1.2}
      coneSpread={12}
      colors={MESH}
      style={{ height: '100%' }}
    >
      <div
        className={`kpi-card glow-inner ${comet.className}`}
        style={comet.style}
        data-ai-explain={explainId}
        data-ai-label={explainId ? label : undefined}
        data-ai-value={explainId ? value : undefined}
      >
        {/* Top row: icon + label + growth badge */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {icon && (
              <div className="kpi-icon" style={{ background: iconBg }}>
                {icon}
              </div>
            )}
            <div>
              <p className="kpi-label" style={{ margin: 0 }}>{label}</p>
              {sublabel && (
                <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.66rem', color: 'var(--text-4)', margin: 0 }}>
                  {sublabel}
                </p>
              )}
            </div>
          </div>
          {growth !== undefined && (
            <span className={`kpi-badge ${badgeGood ? 'up' : 'down'}`}>
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
                    fill={`url(#${gradId})`}
                    fillOpacity={1}
                    // Fill from the line down to the series minimum so the
                    // gradient never renders above the line (negative values
                    // otherwise baseline at 0 and fill upward).
                    baseValue="dataMin"
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
