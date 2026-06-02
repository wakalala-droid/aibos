'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import ThemeToggle from './ThemeToggle';

// ---------------------------------------------------------------------------
// Nav types
// ---------------------------------------------------------------------------

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  engine?: 2 | 3;
}

interface EngineDivider {
  type: 'divider';
  engine: 2 | 3;
  label: string;
  colour: string;
}

type NavEntry = NavItem | EngineDivider;

// ---------------------------------------------------------------------------
// Inline SVG icons
// ---------------------------------------------------------------------------

const I = {
  Overview:   <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />,
  Cash:       <><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" stroke="currentColor" strokeWidth="1.5" fill="none" /><path d="M12 7v10M9 9.5h4.5a1.5 1.5 0 010 3H9m0 0h4.5a1.5 1.5 0 010 3H9" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" /></>,
  Variance:   <><path d="M3 18l7-7 4 4 7-8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /><circle cx="21" cy="7" r="2" fill="currentColor" /></>,
  Forecast:   <><path d="M2 12l5-5 4 4 5-6 4 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /><path d="M20 20H4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".5" /></>,
  Anomaly:    <><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" fill="none" /><path d="M12 8v5M12 16v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></>,
  Breakeven:  <><path d="M4 20L20 4M4 4h4v4M16 16h4v4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /></>,
  Brief:      <><path d="M4 4h16v16H4z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" /><path d="M8 9h8M8 13h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></>,
  Customers:  <><circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" /><path d="M3 20c0-3.314 2.686-6 6-6h0c3.314 0 6 2.686 6 6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /><circle cx="17" cy="9" r="2" stroke="currentColor" strokeWidth="1.3" fill="none" /><path d="M20 20c0-2.21-1.343-4-3-4" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" /></>,
  Churn:      <><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></>,
  Products:   <><rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" /><rect x="14" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" /><rect x="3" y="14" width="7" height="7" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" /><rect x="14" y="14" width="7" height="7" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" /></>,
  Market:     <><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" fill="none" /><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" stroke="currentColor" strokeWidth="1.3" fill="none" /></>,
  POS:        <><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" /><path d="M2 10h20" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><circle cx="7" cy="15" r="1" fill="currentColor" /><circle cx="12" cy="15" r="1" fill="currentColor" /></>,
  Benchmarks: <><path d="M2 20h20M5 20V14M9 20V8M13 20V11M17 20V5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /></>,
  OpsBrief:   <><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></>,
  Lock:       <><rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" fill="none" /><path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" /></>,
};

function Icon({ d }: { d: React.ReactNode }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>{d}</svg>;
}

// ---------------------------------------------------------------------------
// Nav structure
// ---------------------------------------------------------------------------

const NAV: NavEntry[] = [
  { href: '/dashboard',           label: 'Overview',       icon: I.Overview   },
  { href: '/dashboard/cash',      label: 'Cash Intel',     icon: I.Cash       },
  { href: '/dashboard/variance',  label: 'Variance',       icon: I.Variance   },
  { href: '/dashboard/forecast',  label: 'Forecast',       icon: I.Forecast   },
  { href: '/dashboard/anomaly',   label: 'Anomaly Intel',  icon: I.Anomaly    },
  { href: '/dashboard/breakeven', label: 'Breakeven',      icon: I.Breakeven  },
  { href: '/dashboard/brief',     label: 'Strategic Brief',icon: I.Brief      },

  { type: 'divider', engine: 2, label: '⚡ ENGINE 2', colour: 'var(--e2)' },
  { href: '/dashboard/customers', label: 'Customer Intel', icon: I.Customers, engine: 2 },
  { href: '/dashboard/churn',     label: 'Churn Risk',     icon: I.Churn,     engine: 2 },
  { href: '/dashboard/products',  label: 'Product Matrix', icon: I.Products,  engine: 2 },
  { href: '/dashboard/market',    label: 'Market Intel',   icon: I.Market,    engine: 2 },

  { type: 'divider', engine: 3, label: '⚡ ENGINE 3', colour: 'var(--e3)' },
  { href: '/dashboard/pos',        label: 'POS Intelligence', icon: I.POS,        engine: 3 },
  { href: '/dashboard/benchmarks', label: 'Benchmarks',       icon: I.Benchmarks, engine: 3 },
  { href: '/dashboard/ops-brief',  label: 'Ops Brief',        icon: I.OpsBrief,   engine: 3 },
];

const ENGINE_COL = { 2: 'var(--e2)', 3: 'var(--e3)' } as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, hasEngine2Data, hasEngine3Data, uploadedFile } = useStore();
  const collapsed = sidebarCollapsed;

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 56 : 210 }}
      transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
      style={{
        position: 'fixed', top: 0, left: 0, bottom: 0,
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--sidebar-border)',
        display: 'flex', flexDirection: 'column',
        zIndex: 50, overflow: 'hidden',
        backdropFilter: 'var(--blur)',
        transition: 'background 0.25s ease, border-color 0.25s ease',
      }}
    >
      {/* ── Logo / collapse ─────────────────────────────────────────────── */}
      <div
        onClick={toggleSidebar}
        style={{
          height: 56, display: 'flex', alignItems: 'center',
          padding: collapsed ? '0 15px' : '0 16px 0 18px',
          borderBottom: '1px solid var(--sidebar-border)',
          gap: 10, flexShrink: 0, cursor: 'pointer',
          transition: 'border-color 0.25s ease',
        }}
      >
        <div style={{
          width: 26, height: 26, borderRadius: 7, flexShrink: 0,
          background: 'var(--logo-grad)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.65rem', fontWeight: 800, color: '#fff' }}>
            AI
          </span>
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.18 }}
              style={{
                fontFamily: 'Outfit, sans-serif', fontSize: '0.95rem', fontWeight: 800,
                color: 'var(--text-primary)', letterSpacing: '-0.02em', whiteSpace: 'nowrap',
                transition: 'color 0.2s ease',
              }}
            >
              AI-BOS
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingTop: 6, paddingBottom: 8 }}>
        {NAV.map((entry, i) => {

          // Divider
          if ('type' in entry && entry.type === 'divider') {
            return (
              <AnimatePresence key={`d-${i}`}>
                {!collapsed && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ padding: '10px 16px 5px', display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}
                  >
                    <div style={{ flex: 1, height: 1, background: `color-mix(in srgb, ${entry.colour} 25%, transparent)` }} />
                    <span style={{
                      fontFamily: 'DM Mono, monospace', fontSize: '0.57rem',
                      color: entry.colour, textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap',
                    }}>
                      {entry.label}
                    </span>
                    <div style={{ flex: 1, height: 1, background: `color-mix(in srgb, ${entry.colour} 25%, transparent)` }} />
                  </motion.div>
                )}
              </AnimatePresence>
            );
          }

          // Nav item
          const item = entry as NavItem;
          const isActive  = pathname === item.href;
          const eng       = item.engine;
          const isLocked  = (eng === 2 && !hasEngine2Data) || (eng === 3 && !hasEngine3Data);
          const accentCol = eng ? ENGINE_COL[eng] : 'var(--e1)';
          const tipText   = eng === 2 ? 'Upload transaction data to unlock' : eng === 3 ? 'Upload POS data to unlock' : '';

          return (
            <div key={item.href} title={isLocked ? tipText : undefined}>
              <Link
                href={isLocked ? '#' : item.href}
                onClick={e => { if (isLocked) e.preventDefault(); }}
                style={{ textDecoration: 'none', display: 'block' }}
              >
                <div
                  style={{
                    display: 'flex', alignItems: 'center',
                    gap: 10,
                    padding: collapsed ? '9px 15px' : '8px 14px 8px 18px',
                    borderRadius: 8, margin: '1px 6px',
                    cursor: isLocked ? 'default' : 'pointer',
                    background: isActive
                      ? `color-mix(in srgb, ${accentCol} 10%, transparent)`
                      : 'transparent',
                    opacity: isLocked ? 0.4 : 1,
                    position: 'relative',
                    transition: 'background 0.15s ease, opacity 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    if (!isActive && !isLocked)
                      (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
                  }}
                  onMouseLeave={e => {
                    if (!isActive && !isLocked)
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  {/* Active indicator — 2px line, not the forbidden 3px */}
                  {isActive && (
                    <div style={{
                      position: 'absolute', left: 0, top: '20%', bottom: '20%',
                      width: 2, borderRadius: 2, background: accentCol,
                    }} />
                  )}

                  <span style={{ color: isActive ? accentCol : 'var(--text-muted)', flexShrink: 0, transition: 'color 0.15s' }}>
                    <Icon d={item.icon} />
                  </span>

                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -6 }}
                        transition={{ duration: 0.16 }}
                        style={{
                          fontFamily: 'Outfit, sans-serif', fontSize: '0.8rem',
                          fontWeight: isActive ? 600 : 400,
                          color: isActive ? accentCol : 'var(--text-secondary)',
                          whiteSpace: 'nowrap', flex: 1,
                          transition: 'color 0.15s',
                        }}
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>

                  {isLocked && !collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={{ color: 'var(--text-faint)', flexShrink: 0 }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none">{I.Lock}</svg>
                    </motion.span>
                  )}
                </div>
              </Link>
            </div>
          );
        })}
      </nav>

      {/* ── Footer — theme toggle + file indicator ───────────────────────── */}
      <div style={{
        padding: collapsed ? '10px 12px' : '10px 14px 12px',
        borderTop: '1px solid var(--sidebar-border)',
        flexShrink: 0,
        display: 'flex', alignItems: 'center',
        gap: 8,
        transition: 'border-color 0.25s ease',
      }}>
        <ThemeToggle variant="icon" />

        <AnimatePresence>
          {!collapsed && uploadedFile && (
            <motion.p
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{
                fontFamily: 'DM Mono, monospace', fontSize: '0.57rem',
                color: 'var(--text-faint)', margin: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                flex: 1,
              }}
            >
              📄 {uploadedFile}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}

export default Sidebar;
