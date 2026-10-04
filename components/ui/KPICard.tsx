'use client';
import Link from 'next/link';
import Sparkline from './Sparkline';
import BorderGlow from './BorderGlow';
import { bloomProps } from '@/lib/cometStyle';
import { fmt } from '@/lib/utils';
import type { MonthChange } from '@/lib/change';

interface KPICardProps {
  label: string;
  sublabel?: string;
  value: string;
  sub?: string;
  growth?: number;
  /** Honest change (lib/change): a percentage only against a sensible base,
   *  otherwise the difference in money, or in points with `points`. Wins over `growth`. */
  change?: MonthChange;
  points?: boolean;
  icon?: React.ReactNode;
  iconBg?: string;
  sparkData?: number[];
  sparkColor?: string;
  delay?: number;
  /** 0–100 health score; ≤ 60 tints the inner glow amber/red (static). */
  score?: number;
  /** Whether rising is good (revenue) or bad (costs). Controls badge colour. */
  goodWhenUp?: boolean;
  /** Knowledge-base id — long-press the card to have the AI assistant explain it. */
  explainId?: string;
  /** Drill-through (audit #31): a link to the records behind this number. */
  drillHref?: string;
  drillLabel?: string;
}

// Cursor edge-glow tuning shared by every KPI card (hsl "h s l" per React Bits).
const CURSOR_GLOW = '190 95 62';
const MESH = ['#22d3ee', '#60a5fa', '#a78bfa'];

export default function KPICard({
  label, sublabel, value, sub = 'vs prior period',
  growth, change, points = false, icon, iconBg = 'rgba(96,165,250,0.15)',
  sparkData, sparkColor = '#60a5fa', score, goodWhenUp = true,
  explainId, drillHref, drillLabel = 'See the records',
}: KPICardProps) {
  // Badge colour reflects good/bad, not just direction: rising costs are red.
  const dir = change ? change.diff : growth;
  const badgeGood = dir !== undefined && (goodWhenUp ? dir >= 0 : dir <= 0);
  const badgeText = change
    ? change.pct !== undefined ? `${Math.abs(change.pct).toFixed(1)}%`
      : points ? `${Math.abs(change.diff).toFixed(1)} pts` : fmt(Math.abs(change.diff))
    : growth !== undefined ? `${Math.abs(growth).toFixed(1)}%` : '';
  // The card's own inner glow, severity-tinted when the score is in trouble.
  const bloom = bloomProps(score, sparkColor);

  return (
    // No entrance animation (UI/UX audit 2026-10 A16): the figures are there
    // the moment the page is, which matters most on a slow phone.
    <div style={{ height: '100%' }}>
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
        className="kpi-card glow-inner"
        style={bloom.style}
        data-ai-explain={explainId}
        data-ai-label={explainId ? label : undefined}
        data-ai-value={explainId ? value : undefined}
        title={explainId ? 'Hold (long-press) to have AIBOS explain this metric' : undefined}
      >
        {/* Bento dot texture — faint grid that lights up on hover (dashboard only) */}
        <span className="bento-tex" aria-hidden="true" />

        {/* Top row: icon + label + growth badge */}
        {/* Wraps on a narrow card so the change badge drops below the label
            instead of being cut off at the edge (UI/UX audit A17). */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {icon && (
              <div className="kpi-icon" style={{ background: iconBg }}>
                {icon}
              </div>
            )}
            <div>
              <p className="kpi-label" style={{ margin: 0 }}>{label}</p>
              {sublabel && (
                <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: 0 }}>
                  {sublabel}
                </p>
              )}
            </div>
          </div>
          {dir !== undefined && badgeText && (
            <span className={`kpi-badge ${badgeGood ? 'up' : 'down'}`}>
              {dir >= 0 ? '▲' : '▼'} {badgeText}
            </span>
          )}
        </div>

        {/* Value */}
        <p className="kpi-value">{value}</p>

        {/* Sub + sparkline row */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
          <p className="kpi-sub">{sub}</p>
          {sparkData && sparkData.length > 1 && (
            // Decorative trend hint: the value and the change badge carry the data.
            <div style={{ marginBottom: -4, flexShrink: 0 }}>
              <Sparkline data={sparkData} color={sparkColor} />
            </div>
          )}
        </div>

        {drillHref && (
          <Link className="tap-link" href={drillHref}
            style={{ marginTop: 4, fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--text-3)', textDecoration: 'none' }}>
            {drillLabel} <span aria-hidden>›</span>
          </Link>
        )}
      </div>
    </BorderGlow>
    </div>
  );
}
