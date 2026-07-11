'use client';

interface LockOverlayProps {
  colour?: string;
  title: string;
  description: string;
  bullets?: string[];
}

export default function LockOverlay({ colour = 'var(--cyan)', title, description, bullets }: LockOverlayProps) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 20,
      background: 'var(--overlay-bg)',
      backdropFilter: 'blur(8px)',
      borderRadius: 12,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 28, textAlign: 'center',
    }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ marginBottom: 12, color: colour }}>
        <rect x="5" y="11" width="14" height="10" rx="2" stroke={colour} strokeWidth="1.5" fill="none"/>
        <path d="M8 11V7a4 4 0 018 0v4" stroke={colour} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      </svg>
      <p style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: colour, margin: '0 0 6px' }}>{title}</p>
      <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: '0 0 14px', maxWidth: 300, lineHeight: 1.5 }}>
        {description}
      </p>
      {bullets?.map(b => (
        <p key={b} style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: '3px 0' }}>
          <span style={{ color: colour }}>› </span>{b}
        </p>
      ))}
      <button
        onClick={() => document.getElementById('upload-section')?.scrollIntoView({ behavior: 'smooth' })}
        style={{
          marginTop: 18,
          background: colour, color: '#fff', border: 'none',
          borderRadius: 8, padding: '9px 22px',
          fontSize: 'var(--fs-data)', fontWeight: 600, cursor: 'pointer',
        }}
      >
        Upload Data →
      </button>
    </div>
  );
}
