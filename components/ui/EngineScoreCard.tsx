'use client';

// Engine score card — the exact card from the dashboard Overview (cursor
// edge-glow via BorderGlow, severity-tinted inner glow under score 60,
// progress bar), extracted so the marketing site can render the genuine component.
import Link from 'next/link';
import { scoreColor } from '@/lib/utils';
import BorderGlow from './BorderGlow';
import { bloomProps } from '@/lib/cometStyle';

const CURSOR_GLOW = '190 95 62';
const MESH = ['#22d3ee', '#60a5fa', '#a78bfa'];

export default function EngineScoreCard({
  label, sub, score, colour, href, locked, notYet, explainId,
}: {
  label: string; sub: string; score: number; colour: string; href: string; locked?: boolean;
  /** Not enough months for a score yet; the card still opens its page. */
  notYet?: boolean;
  /** Knowledge-base id — long-press the card to have the AI assistant explain it. */
  explainId?: string;
}) {
  const col = scoreColor(score);
  const blank = locked || notYet;
  const bloom = bloomProps(blank ? undefined : score, colour);
  return (
    <Link
      href={locked ? '#' : href}
      onClick={(e) => { if (locked) e.preventDefault(); }}
      style={{ textDecoration: 'none' }}
    >
      <BorderGlow glowColor={CURSOR_GLOW} backgroundColor="var(--bg-card)" borderRadius={14} glowRadius={48} glowIntensity={1.2} coneSpread={12} colors={MESH} style={{ height: '100%' }}>
        <div
          className="kpi-card glow-inner"
          data-ai-explain={explainId}
          data-ai-label={explainId ? label : undefined}
          data-ai-value={explainId && !blank ? String(score) : undefined}
          title={explainId ? 'Hold (long-press) to have AIBOS explain this score' : undefined}
          style={{ ...bloom.style, opacity: locked ? 0.5 : 1, cursor: locked ? 'default' : 'pointer' }}
        >
          {/* Bento dot texture — faint grid that lights up on hover (dashboard only) */}
          <span className="bento-tex" aria-hidden="true" />

          <p className="kpi-label" style={{ color: colour }}>{label}</p>
          <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: '2px 0 10px' }}>
            {sub}
          </p>
          <p style={{ fontSize: 'var(--fs-display)', fontWeight: 800, color: blank ? 'var(--text-4)' : col, letterSpacing: '-0.04em', margin: '0 0 10px' }}>
            {blank ? 'Not yet' : score}
          </p>
          <div className="progress-track">
            {!blank && <div className="progress-fill" style={{ width: `${score}%`, background: col }} />}
          </div>
        </div>
      </BorderGlow>
    </Link>
  );
}
