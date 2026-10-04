'use client';
import BorderGlow from './BorderGlow';

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  delay?: number;
  action?: React.ReactNode;
  /** Knowledge-base id — long-press the card to have the AI assistant explain it. */
  explainId?: string;
}

// The redesign's card on every page (2026-10): the same surface as Home's
// Panel, with the core chrome every AIBOS card keeps (the cursor BorderGlow,
// dark mode only, and the bento dot texture), a quiet title on the left and
// one action on the right. `style` stays on the outer div so margins and
// sizes behave as before.
const CURSOR_GLOW = '190 95 62';
const MESH = ['#22d3ee', '#60a5fa', '#a78bfa'];

export default function SectionCard({
  title, subtitle, children, style = {}, action, explainId,
}: SectionCardProps) {
  return (
    // No entrance animation (UI/UX audit 2026-10 A16). `delay` is still
    // accepted from older callers and ignored.
    <div style={style}>
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
        <section
          className="section-card glow-inner"
          data-ai-explain={explainId}
          data-ai-label={explainId ? title : undefined}
          title={explainId ? 'Hold (long-press) to have AIBOS explain this panel' : undefined}
        >
          {/* Bento dot texture — faint grid that lights up on hover (dashboard only) */}
          <span className="bento-tex" aria-hidden="true" />

          {(title || action) && (
            <div className="panel-head">
              {title ? <h2 className="panel-title">{title}</h2> : <span />}
              {action && <div>{action}</div>}
            </div>
          )}
          {subtitle && <p className="section-sub">{subtitle}</p>}
          {children}
        </section>
      </BorderGlow>
    </div>
  );
}
