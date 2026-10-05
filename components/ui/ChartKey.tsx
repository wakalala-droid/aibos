// The key above a chart: a small swatch and the series name, in the page's
// one palette (lib/tone.ts). A dashed swatch for a line drawn dashed.

export default function ChartKey({ items }: { items: [colour: string, label: string, dashed?: boolean][] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
      {items.map(([colour, label, dashed]) => (
        <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {dashed ? (
            <svg width="24" height="4" aria-hidden="true">
              <line x1="0" y1="2" x2="24" y2="2" stroke={colour} strokeWidth="2.5" strokeDasharray="5 3" />
            </svg>
          ) : (
            <span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 'var(--radius-sm)', background: colour, flexShrink: 0 }} />
          )}
          <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>{label}</span>
        </span>
      ))}
    </div>
  );
}
