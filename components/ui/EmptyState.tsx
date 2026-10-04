import Link from 'next/link';

// EmptyState — what a section shows before it has anything to show (audit F-09,
// UI/UX audit 2026-10 B9). Honest chip, one plain sentence at body size and a
// 44px pill (redesign 2026-10), so the next step is obvious and easy to hit on a phone.
// The chip never says "Coming soon" unless the feature truly isn't built.

interface EmptyStateProps {
  /** Accent colour (engine hue or var(--cyan)). */
  colour?: string;
  /** Short status chip text, e.g. "Needs your sales" / "Nothing yet". */
  chip?: string;
  /** One sentence: what will appear here and what unlocks it. */
  text: React.ReactNode;
  /** The main next step. */
  action?: { label: string; href: string };
  /** An optional second, quieter way in. */
  secondary?: { label: string; href: string };
}

export default function EmptyState({ colour = 'var(--cyan)', chip = 'Nothing yet', text, action, secondary }: EmptyStateProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0 2px' }}>
      <span className="badge" style={{
        alignSelf: 'flex-start', color: colour,
        background: `color-mix(in srgb, ${colour} 10%, transparent)`,
      }}>
        {chip}
      </span>
      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>
        {text}
      </p>
      {(action || secondary) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {action && (
            <Link href={action.href} className="pill">{action.label}</Link>
          )}
          {secondary && (
            <Link href={secondary.href} className="pill pill-quiet">{secondary.label}</Link>
          )}
        </div>
      )}
    </div>
  );
}
