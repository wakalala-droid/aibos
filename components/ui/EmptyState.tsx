// EmptyState — the one way a panel says "nothing here yet" (audit #17).
// Every empty space educates and points at the next action; never a blank box.

import Link from 'next/link';

interface EmptyStateProps {
  /** Accent colour (engine hue or var(--cyan)). */
  colour?: string;
  /** Short status chip text, e.g. "Coming soon" / "No data yet". */
  chip?: string;
  /** One sentence: what will appear here and what unlocks it. */
  text: React.ReactNode;
  /** Optional call to action. */
  action?: { label: string; href: string };
}

export default function EmptyState({ colour = 'var(--cyan)', chip = 'Coming soon', text, action }: EmptyStateProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0 2px' }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
        fontSize: 'var(--fs-label)', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.08em', color: colour,
        background: `color-mix(in srgb, ${colour} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${colour} 30%, transparent)`,
        padding: '3px 8px', borderRadius: 'var(--radius-sm)',
      }}>
        {chip}
      </span>
      <p style={{ fontSize: 'var(--fs-data)', color: 'var(--text-3)', lineHeight: 1.5, margin: 0 }}>
        {text}
      </p>
      {action && (
        <Link
          href={action.href}
          style={{
            alignSelf: 'flex-start', marginTop: 2,
            fontSize: 'var(--fs-data)', fontWeight: 600, color: colour, textDecoration: 'none',
          }}
        >
          {action.label} →
        </Link>
      )}
    </div>
  );
}
