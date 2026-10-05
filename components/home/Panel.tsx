'use client';

// Panel: the redesign's card. The same core chrome as every AIBOS card (the
// cursor BorderGlow, dark mode only, and the bento dot texture) around a flat
// surface with generous inner space and an optional title row: a quiet title
// on the left, one action on the right.

import BorderGlow from '@/components/ui/BorderGlow';

const CURSOR_GLOW = '190 95 62';
const MESH = ['#22d3ee', '#22d3ee', '#67e8f9']; // one hue (5 Oct 2026)

export default function Panel({ title, action, children, style, innerStyle, explainId, labelledBy }: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
  innerStyle?: React.CSSProperties;
  explainId?: string;
  /** id of the heading that names this panel, for a <section>. */
  labelledBy?: string;
}) {
  return (
    <BorderGlow glowColor={CURSOR_GLOW} backgroundColor="var(--bg-card)" borderRadius={14} glowRadius={48}
      glowIntensity={1.2} coneSpread={12} colors={MESH} style={{ height: '100%', ...style }}>
      <section className="section-card glow-inner panel" style={innerStyle} data-ai-explain={explainId}
        aria-labelledby={labelledBy}>
        {(title || action) && (
          <div className="panel-head">
            {typeof title === 'string' ? <h2 id={labelledBy} className="panel-title">{title}</h2> : title}
            {action}
          </div>
        )}
        {children}
      </section>
    </BorderGlow>
  );
}
