// PageHeader: the one way a dashboard page introduces itself (audit F-08,
// redesign 2026-10). A plain title in the Home voice, one quiet line under it
// and the page's actions as pills on the right, the same on every page.
// The old coloured eyebrow is gone: the menu already says where you are.

interface PageHeaderProps {
  /** Ignored since the redesign; kept so older callers still compile. */
  eyebrow?: React.ReactNode;
  /** Ignored since the redesign. */
  eyebrowColour?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** The page's actions, as pills (className="pill" / "pill pill-primary"). */
  actions?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="page-head">
      <div style={{ minWidth: 0 }}>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}
