'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme';

// ── SVG icon primitives (matching E1 sidebar icon style) ──────────────────
const IC: Record<string, JSX.Element> = {
  overview:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" fill="none"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" fill="none"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" fill="none"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" fill="none"/></svg>,
  cash:       <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M2 8h20v10a2 2 0 01-2 2H4a2 2 0 01-2-2V8z" stroke="currentColor" strokeWidth="1.6" fill="none"/><path d="M2 8l2-4h16l2 4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><circle cx="12" cy="14" r="2" stroke="currentColor" strokeWidth="1.4" fill="none"/></svg>,
  variance:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 18l5-5 4 3 5-7 4 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/><path d="M3 20h18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity=".4"/></svg>,
  forecast:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M2 12l4-4 4 4 4-6 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/><path d="M16 10l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity=".5"/></svg>,
  anomaly:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3L2 20h20L12 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" fill="none"/><path d="M12 10v4M12 17v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  breakeven:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 12h18M12 3v18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity=".4"/><path d="M5 19L19 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.4" fill="none"/></svg>,
  brief:      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 4h16v16H4z" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round"/><path d="M8 9h8M8 13h5M8 17h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  studio:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.6" fill="none"/><path d="M3 9h18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M8 13l2 2 2-2M14 15h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  // Customer Intelligence icons
  customers:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/><path d="M19 8v6M22 11h-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  churn:      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M21 12a9 9 0 11-6.219-8.56" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/><path d="M21 3v5h-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  products:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  market:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20" stroke="currentColor" strokeWidth="1.3" fill="none"/></svg>,
  // Operations icons
  pos:        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M2 9h20" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M7 21h10M12 17v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  benchmarks: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 20h18M6 20V14M10 20V8M14 20V11M18 20V5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>,
  opsbrief:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h4M9 3h10a2 2 0 012 2v14a2 2 0 01-2 2H9M9 3v18" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M13 8h4M13 12h4M13 16h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  lock:       <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>,
  sun:        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.6"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  moon:       <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

type NavItem = { href: string; label: string; icon: JSX.Element; engine?: 'ci' | 'ops' };
type NavSection = { type: 'section'; label: string; colour: string; engine: 'ci' | 'ops' };
type NavEntry = NavItem | NavSection;

const NAV: NavEntry[] = [
  { href: '/dashboard',            label: 'Overview',         icon: IC.overview   },
  { href: '/dashboard/cash',       label: 'Cash Intel',       icon: IC.cash       },
  { href: '/dashboard/variance',   label: 'Variance',         icon: IC.variance   },
  { href: '/dashboard/forecast',   label: 'Forecast',         icon: IC.forecast   },
  { href: '/dashboard/anomaly',    label: 'Anomaly Intel',    icon: IC.anomaly    },
  { href: '/dashboard/breakeven',  label: 'Breakeven',        icon: IC.breakeven  },
  { href: '/dashboard/brief',      label: 'Strategic Brief',  icon: IC.brief      },
  { href: '/data-studio',          label: 'Data Studio',      icon: IC.studio     },

  { type: 'section', label: 'Customer Intelligence', colour: 'var(--e2)', engine: 'ci' },
  { href: '/dashboard/customers',  label: 'Customer Intel',   icon: IC.customers,   engine: 'ci' },
  { href: '/dashboard/churn',      label: 'Churn Risk',       icon: IC.churn,       engine: 'ci' },
  { href: '/dashboard/products',   label: 'Product Matrix',   icon: IC.products,    engine: 'ci' },
  { href: '/dashboard/market',     label: 'Market Intel',     icon: IC.market,      engine: 'ci' },

  { type: 'section', label: 'Operations', colour: 'var(--e3)', engine: 'ops' },
  { href: '/dashboard/pos',        label: 'POS Intelligence', icon: IC.pos,         engine: 'ops' },
  { href: '/dashboard/benchmarks', label: 'Benchmarks',       icon: IC.benchmarks,  engine: 'ops' },
  { href: '/dashboard/ops-brief',  label: 'Ops Brief',        icon: IC.opsbrief,    engine: 'ops' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, hasEngine2Data, hasEngine3Data, uploadedFile } = useStore();
  const { toggle, isDark } = useTheme();
  const col = sidebarCollapsed;

  const isLocked = (eng?: 'ci' | 'ops') =>
    eng === 'ci' ? !hasEngine2Data : eng === 'ops' ? !hasEngine3Data : false;

  const getAccent = (eng?: 'ci' | 'ops') =>
    eng === 'ci' ? 'var(--e2)' : eng === 'ops' ? 'var(--e3)' : 'var(--e1)';

  return (
    <aside className={`sidebar-nav${col ? ' collapsed' : ''}`}>
      {/* Logo */}
      <div
        onClick={toggleSidebar}
        style={{
          height: 56, display: 'flex', alignItems: 'center', gap: 10,
          padding: col ? '0 15px' : '0 16px 0 18px',
          borderBottom: '1px solid var(--border)', cursor: 'pointer', flexShrink: 0,
        }}
      >
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: 'linear-gradient(135deg, #0097b2, #00d4ff)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.6rem', fontWeight: 800, color: '#fff' }}>AI</span>
        </div>
        <AnimatePresence>
          {!col && (
            <motion.span
              initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }} transition={{ duration: 0.15 }}
              style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}
            >
              AI-BOS
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 0' }}>
        {NAV.map((entry, i) => {
          if ('type' in entry) {
            return (
              <AnimatePresence key={`sec-${i}`}>
                {!col && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="nav-section"
                    style={{ color: entry.colour, marginTop: 8 }}
                  >
                    {entry.label}
                  </motion.div>
                )}
              </AnimatePresence>
            );
          }

          const item = entry as NavItem;
          const active = pathname === item.href;
          const locked = isLocked(item.engine);
          const accent = getAccent(item.engine);

          return (
            <div key={item.href} title={locked ? 'Upload data to unlock' : undefined}>
              <Link
                href={locked ? '#' : item.href}
                onClick={e => { if (locked) e.preventDefault(); }}
                style={{ textDecoration: 'none', display: 'block' }}
              >
                <div
                  className={`nav-item${active ? ' active' : ''}`}
                  style={{
                    opacity: locked ? 0.4 : 1,
                    color: active ? accent : undefined,
                    ...(active ? { background: `color-mix(in srgb, ${accent} 10%, transparent)` } : {}),
                  }}
                >
                  {active && (
                    <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 2, borderRadius: 2, background: accent }} />
                  )}
                  <span style={{ color: active ? accent : 'var(--text-3)', flexShrink: 0, display: 'flex' }}>
                    {item.icon}
                  </span>
                  <AnimatePresence>
                    {!col && (
                      <motion.span
                        initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -6 }} transition={{ duration: 0.15 }}
                        className="nav-label"
                        style={{ color: active ? accent : 'var(--text-2)', flex: 1 }}
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {locked && !col && (
                    <span style={{ color: 'var(--text-4)', display: 'flex' }}>{IC.lock}</span>
                  )}
                </div>
              </Link>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{
        padding: col ? '10px 14px' : '10px 16px 12px',
        borderTop: '1px solid var(--border)', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <button
          onClick={toggle}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{
            width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-md)',
            background: 'var(--bg-badge)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-3)', flexShrink: 0,
            transition: 'all 0.15s ease',
          }}
        >
          {isDark ? IC.sun : IC.moon}
        </button>
        <AnimatePresence>
          {!col && uploadedFile && (
            <motion.span
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: 'var(--text-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}
            >
              {uploadedFile}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}
