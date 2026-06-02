'use client';

import { motion } from 'framer-motion';
import { tokens, formatCurrency } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Fade animation helper
// ---------------------------------------------------------------------------

export const FADE = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay },
});

// ---------------------------------------------------------------------------
// PageHeader
// ---------------------------------------------------------------------------

export function PageHeader({
  engine, engineLabel, title, subtitle, colour,
}: {
  engine?: string; engineLabel?: string; title: string; subtitle?: string; colour: string;
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      {engine && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 3, height: 20, borderRadius: 2, background: colour }} />
          <span style={{
            fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', color: colour,
            letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            {engineLabel ?? engine}
          </span>
        </div>
      )}
      <h1 style={{
        fontFamily: 'Outfit, sans-serif', fontSize: '1.6rem', fontWeight: 800,
        color: tokens.textPrimary, margin: 0, letterSpacing: '-0.03em',
        transition: 'color 0.2s ease',
      }}>
        {title}
      </h1>
      {subtitle && (
        <p style={{
          fontFamily: 'DM Mono, monospace', fontSize: '0.7rem',
          color: tokens.textMuted, margin: '6px 0 0',
        }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: number | string;
  colour: string;
  format?: 'currency' | 'pct' | 'raw' | 'string';
  sym?: string;
  pulse?: boolean;
  compact?: boolean;
}

export function StatCard({ label, value, colour, format = 'currency', sym = 'K', pulse = false, compact = false }: StatCardProps) {
  let display: string;
  if (format === 'string') {
    display = String(value);
  } else if (format === 'pct') {
    display = `${Number(value).toFixed(1)}%`;
  } else if (format === 'raw') {
    display = Number(value).toLocaleString();
  } else {
    display = formatCurrency(Number(value), compact, sym);
  }

  return (
    <div style={{
      background: tokens.bgSurface2,
      border: `1px solid color-mix(in srgb, ${colour} 18%, var(--border-subtle))`,
      borderRadius: 14, padding: '22px 24px',
      boxShadow: tokens.shadow,
      position: 'relative', overflow: 'hidden',
      transition: 'background 0.25s ease, border-color 0.25s ease',
    }}>
      {pulse && (
        <motion.div
          animate={{ opacity: [0, 0.3, 0], scale: [0.88, 1.12, 0.88] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          style={{ position: 'absolute', inset: 0, borderRadius: 14, border: `1px solid ${colour}` }}
        />
      )}
      <div style={{ position: 'absolute', top: -32, right: -32, width: 100, height: 100, borderRadius: '50%', background: `color-mix(in srgb, ${colour} 12%, transparent)` }} />
      <p style={{
        fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', color: tokens.textMuted,
        textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 14px',
        position: 'relative',
      }}>
        {label}
      </p>
      <p style={{
        fontFamily: 'Outfit, sans-serif', fontSize: '2rem', fontWeight: 700,
        color: colour, letterSpacing: '-0.03em', margin: 0, position: 'relative',
      }}>
        {display}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DataCard — generic glass card
// ---------------------------------------------------------------------------

export function DataCard({
  children, style = {}, accentColour,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  accentColour?: string;
}) {
  return (
    <div style={{
      background: tokens.bgSurface,
      backdropFilter: tokens.blur,
      border: accentColour
        ? `1px solid color-mix(in srgb, ${accentColour} 16%, var(--border-subtle))`
        : `1px solid ${tokens.border}`,
      borderRadius: 16,
      padding: '22px 24px',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: tokens.shadow,
      transition: 'background 0.25s ease, border-color 0.25s ease',
      ...style,
    }}>
      {/* Top shimmer line */}
      <div style={{
        position: 'absolute', top: 0, left: '10%', right: '10%', height: 1,
        background: accentColour
          ? `linear-gradient(90deg, transparent, color-mix(in srgb, ${accentColour} 40%, transparent), transparent)`
          : tokens.shimmer,
      }} />
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LockOverlay — engine locked state
// ---------------------------------------------------------------------------

export function LockOverlay({
  colour, title, description, bullets,
}: {
  colour: string;
  title: string;
  description: string;
  bullets?: string[];
}) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 20,
      background: tokens.lockBg,
      backdropFilter: 'blur(10px)',
      borderRadius: 16,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 24, textAlign: 'center',
    }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ marginBottom: 12 }}>
        <rect x="5" y="11" width="14" height="10" rx="2" stroke={colour} strokeWidth="1.5" fill="none" />
        <path d="M8 11V7a4 4 0 018 0v4" stroke={colour} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </svg>
      <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1rem', fontWeight: 700, color: colour, margin: '0 0 6px' }}>{title}</p>
      <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.75rem', color: tokens.textMuted, margin: '0 0 14px', maxWidth: 300 }}>
        {description}
      </p>
      {bullets && bullets.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 18px', textAlign: 'left' }}>
          {bullets.map(b => (
            <li key={b} style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.7rem', color: tokens.textMuted, marginBottom: 5 }}>
              <span style={{ color: colour, marginRight: 6 }}>›</span>{b}
            </li>
          ))}
        </ul>
      )}
      <button
        onClick={() => document.getElementById('upload-section')?.scrollIntoView({ behavior: 'smooth' })}
        style={{
          background: colour, color: '#fff', border: 'none',
          borderRadius: 10, padding: '10px 24px',
          fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
        }}
      >
        Upload Data →
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BriefPoints — numbered AI brief renderer
// ---------------------------------------------------------------------------

export function BriefPoints({ text, colour }: { text: string; colour: string }) {
  if (!text) return null;
  const lines  = text.split('\n').filter(l => l.trim());
  const points = lines.filter(l => /^\d+\./.test(l.trim()));
  const source = points.length > 0 ? points : lines;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {source.map((point, i) => {
        const content = point.replace(/^\d+\.\s*/, '').trim();
        return (
          <motion.div key={i}
            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 + i * 0.08 }}
            style={{
              display: 'flex', gap: 12, alignItems: 'flex-start',
              background: `color-mix(in srgb, ${colour} 4%, var(--bg-surface))`,
              border: `1px solid color-mix(in srgb, ${colour} 12%, var(--border-subtle))`,
              borderRadius: 10, padding: '12px 14px',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{
              width: 22, height: 22, borderRadius: 6, flexShrink: 0,
              background: `color-mix(in srgb, ${colour} 16%, transparent)`,
              border: `1px solid color-mix(in srgb, ${colour} 28%, transparent)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', fontWeight: 700, color: colour }}>{i + 1}</span>
            </div>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.72rem', color: tokens.textSecondary, lineHeight: 1.65, margin: 0 }}>
              {content}
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CustomTooltip — works in both themes via CSS vars
// ---------------------------------------------------------------------------

export function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: tokens.tooltipBg,
      border: `1px solid ${tokens.tooltipBorder}`,
      borderRadius: 12, padding: '10px 14px',
      backdropFilter: tokens.blur,
      boxShadow: tokens.shadow,
    }}>
      <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.62rem', color: tokens.textMuted, margin: '0 0 4px' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name || p.dataKey} style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.8rem', fontWeight: 600, color: p.fill ?? p.color ?? p.stroke, margin: '2px 0' }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table helpers
// ---------------------------------------------------------------------------

export function TH({ children }: { children: React.ReactNode }) {
  return (
    <th style={{
      textAlign: 'left', padding: '8px 10px',
      fontFamily: 'DM Mono, monospace', fontSize: '0.6rem',
      color: tokens.textMuted, letterSpacing: '0.06em',
      textTransform: 'uppercase', fontWeight: 400,
      borderBottom: `1px solid ${tokens.tableHead}`,
    }}>
      {children}
    </th>
  );
}

export function TR({
  children, delay = 0,
}: {
  children: React.ReactNode; delay?: number;
}) {
  return (
    <motion.tr
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = tokens.tableHover; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      style={{ borderBottom: `1px solid ${tokens.tableBorder}`, transition: 'background 0.15s' }}
    >
      {children}
    </motion.tr>
  );
}

export function TD({ children, colour, mono = true, bold = false, style = {} }: {
  children: React.ReactNode; colour?: string; mono?: boolean; bold?: boolean; style?: React.CSSProperties;
}) {
  return (
    <td style={{
      padding: '10px 10px',
      fontFamily: mono ? 'DM Mono, monospace' : 'Outfit, sans-serif',
      fontSize: mono ? '0.72rem' : '0.78rem',
      color: colour ?? tokens.textSecondary,
      fontWeight: bold ? 700 : 400,
      ...style,
    }}>
      {children}
    </td>
  );
}

export function Chip({ label, colour }: { label: string; colour: string }) {
  return (
    <span style={{
      fontFamily: 'DM Mono, monospace', fontSize: '0.6rem',
      padding: '2px 9px', borderRadius: 4,
      background: `color-mix(in srgb, ${colour} 14%, transparent)`,
      border: `1px solid color-mix(in srgb, ${colour} 30%, transparent)`,
      color: colour,
    }}>
      {label}
    </span>
  );
}
