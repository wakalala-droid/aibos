'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import { useProfile } from '@/lib/profile';
import { TIERS } from '@/lib/tiers';

// ── SVG icon primitives (matching E1 sidebar icon style) ──────────────────
const IC: Record<string, JSX.Element> = {
  overview:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" fill="none"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" fill="none"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" fill="none"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" fill="none"/></svg>,
  record:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" fill="none"/><path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  timeline:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 3v18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity=".5"/><circle cx="6" cy="7" r="2" stroke="currentColor" strokeWidth="1.6" fill="none"/><circle cx="6" cy="15" r="2" stroke="currentColor" strokeWidth="1.6" fill="none"/><path d="M11 7h9M11 15h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  import:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3v12M7 10l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  advisor:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2a7 7 0 00-4 12.7V17a1 1 0 001 1h6a1 1 0 001-1v-2.3A7 7 0 0012 2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M9 21h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  inventory:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 7l9-4 9 4-9 4-9-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M3 7v10l9 4 9-4V7M12 11v10" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>,
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
  admin:      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round"/><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  pricing:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round"/><circle cx="7" cy="7" r="1.4" fill="currentColor"/></svg>,
  sun:        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.6"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  moon:       <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

type NavItem = { href: string; label: string; icon: JSX.Element; engine?: 'ci' | 'ops' };
type NavSection = { type: 'section'; label: string; colour: string; engine: 'ci' | 'ops' };
type NavEntry = NavItem | NavSection;

const NAV: NavEntry[] = [
  { href: '/dashboard',            label: 'Overview',         icon: IC.overview   },
  { href: '/dashboard/record',     label: 'Record',           icon: IC.record     },
  { href: '/dashboard/timeline',   label: 'Timeline',         icon: IC.timeline   },
  { href: '/dashboard/import',     label: 'Import',           icon: IC.import     },
  { href: '/dashboard/advisor',    label: 'Advisor',          icon: IC.advisor    },
  { href: '/dashboard/inventory',  label: 'Inventory',        icon: IC.inventory  },
  { href: '/dashboard/cash',       label: 'Cash Intel',       icon: IC.cash       },
  { href: '/dashboard/variance',   label: 'Variance',         icon: IC.variance   },
  { href: '/dashboard/forecast',   label: 'Forecast',         icon: IC.forecast   },
  { href: '/dashboard/anomaly',    label: 'Anomaly Intel',    icon: IC.anomaly    },
  { href: '/dashboard/breakeven',  label: 'Breakeven',        icon: IC.breakeven  },
  { href: '/dashboard/brief',      label: 'Strategic Brief',  icon: IC.brief      },
  { href: '/data-studio',          label: 'Data Studio',      icon: IC.studio     },
  { href: '/pricing',              label: 'Plans & Pricing',  icon: IC.pricing    },

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
  const {
    sidebarCollapsed, toggleSidebar, hasEngine2Data, hasEngine3Data, uploadedFile,
    mobileNavOpen, setMobileNav, tier,
  } = useStore();
  const { toggle, isDark } = useTheme();
  const { isAdmin } = useProfile();
  const col = sidebarCollapsed;

  const isLocked = (eng?: 'ci' | 'ops') =>
    eng === 'ci' ? !hasEngine2Data : eng === 'ops' ? !hasEngine3Data : false;

  const getAccent = (eng?: 'ci' | 'ops') =>
    eng === 'ci' ? 'var(--e2)' : eng === 'ops' ? 'var(--e3)' : 'var(--e1)';

  // Escape closes the mobile drawer (accessibility_system.md KEYBOARD RULE).
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileNav(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileNavOpen, setMobileNav]);

  return (
    <aside
      id="primary-navigation"
      aria-label="Primary navigation"
      className={`sidebar-nav${col ? ' collapsed' : ''}${mobileNavOpen ? ' mobile-open' : ''}`}
    >
      {/* Logo — doubles as the desktop collapse toggle. */}
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label={col ? 'Expand sidebar' : 'Collapse sidebar'}
        style={{
          height: 56, width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: col ? '0 15px' : '0 16px 0 18px',
          borderBottom: '1px solid var(--border)', cursor: 'pointer', flexShrink: 0,
          background: 'transparent', border: 'none', borderRadius: 0, textAlign: 'left',
        }}
      >
        <div style={{
          width: 30, height: 30, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Image
            src={isDark ? '/brand/aibos-mark-circle-dark.png' : '/brand/aibos-mark.png'}
            alt="AI-BOS"
            width={30}
            height={30}
            style={{ width: 30, height: 30, objectFit: 'contain' }}
            priority
          />
        </div>
        <AnimatePresence>
          {!col && (
            <motion.span
              initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }} transition={{ duration: 0.15 }}
              style={{ display: 'inline-flex', alignItems: 'center' }}
            >
              <Image
                src={isDark ? '/brand/aibos-wordmark-white.png' : '/brand/aibos-wordmark.png'}
                alt="AI-BOS"
                width={74}
                height={19}
                style={{ width: 74, height: 'auto', objectFit: 'contain' }}
                priority
              />
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Nav */}
      <nav aria-label="Dashboard sections" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 0' }}>
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
                aria-current={active ? 'page' : undefined}
                aria-disabled={locked || undefined}
                aria-label={locked ? `${item.label} — locked, upload data to unlock` : undefined}
                onClick={e => {
                  if (locked) { e.preventDefault(); return; }
                  setMobileNav(false);
                }}
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

        {/* Admin — only rendered for admins (cosmetic; server gate is the real one) */}
        {isAdmin && (
          <>
            <AnimatePresence>
              {!col && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="nav-section" style={{ color: 'var(--e1)', marginTop: 8 }}
                >
                  Admin
                </motion.div>
              )}
            </AnimatePresence>
            <Link
              href="/admin"
              aria-current={pathname.startsWith('/admin') ? 'page' : undefined}
              onClick={() => setMobileNav(false)}
              style={{ textDecoration: 'none', display: 'block' }}
            >
              <div
                className={`nav-item${pathname.startsWith('/admin') ? ' active' : ''}`}
                style={{
                  color: pathname.startsWith('/admin') ? 'var(--e1)' : undefined,
                  ...(pathname.startsWith('/admin') ? { background: 'color-mix(in srgb, var(--e1) 10%, transparent)' } : {}),
                }}
              >
                {pathname.startsWith('/admin') && (
                  <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 2, borderRadius: 2, background: 'var(--e1)' }} />
                )}
                <span style={{ color: pathname.startsWith('/admin') ? 'var(--e1)' : 'var(--text-3)', flexShrink: 0, display: 'flex' }}>
                  {IC.admin}
                </span>
                <AnimatePresence>
                  {!col && (
                    <motion.span
                      initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }} transition={{ duration: 0.15 }}
                      className="nav-label"
                      style={{ color: pathname.startsWith('/admin') ? 'var(--e1)' : 'var(--text-2)', flex: 1 }}
                    >
                      Admin
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </Link>
          </>
        )}
      </nav>

      {/* Plan chip — current tier + upgrade CTA (expanded rail only) */}
      {!col && (
        <Link
          href="/pricing"
          onClick={() => setMobileNav(false)}
          aria-label={tier === 'growth' ? 'Growth plan — view plans' : `${TIERS[tier].name} plan — upgrade`}
          style={{
            margin: '4px 12px 8px', padding: '10px 12px', borderRadius: 10,
            border: '1px solid var(--border)', background: 'var(--bg-badge)',
            textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          }}
        >
          <span style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.64rem', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Current plan
            </span>
            <span style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-1)' }}>
              {TIERS[tier].name}
            </span>
          </span>
          {tier !== 'growth' && (
            <span style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.68rem', fontWeight: 700, color: '#fff', background: 'var(--cyan)', padding: '5px 10px', borderRadius: 8, whiteSpace: 'nowrap' }}>
              Upgrade
            </span>
          )}
        </Link>
      )}

      {/* Footer */}
      <div style={{
        padding: col ? '10px 14px' : '10px 16px 12px',
        borderTop: '1px solid var(--border)', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <button
          type="button"
          onClick={toggle}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
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
              style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.66rem', color: 'var(--text-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}
            >
              {uploadedFile}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}
