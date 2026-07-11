// PageHeader — the one way a dashboard page introduces itself (audit F-08).
// Eyebrow (category, never a repeat of the title) · H1 · subtitle. Owning this
// in a component keeps every page's header identical and stops per-page drift.

interface PageHeaderProps {
  /** Small uppercase category label above the title — a CATEGORY, not the title again. */
  eyebrow?: React.ReactNode;
  /** Accent for the eyebrow (an engine colour or var(--cyan)). */
  eyebrowColour?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
}

export default function PageHeader({ eyebrow, eyebrowColour = 'var(--cyan)', title, subtitle }: PageHeaderProps) {
  return (
    <div style={{ marginBottom: 24 }}>
      {eyebrow && (
        <p style={{
          fontSize: 'var(--fs-label)', fontWeight: 600, color: eyebrowColour,
          textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px',
        }}>
          {eyebrow}
        </p>
      )}
      <h1 style={{
        fontSize: 'var(--fs-h2)', fontWeight: 800, color: 'var(--text-1)',
        margin: 0, letterSpacing: '-0.03em',
      }}>
        {title}
      </h1>
      {subtitle && (
        <p style={{ fontSize: 'var(--fs-data)', color: 'var(--text-3)', margin: '4px 0 0' }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
