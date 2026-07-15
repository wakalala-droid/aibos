'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import { useProfile } from '@/lib/profile';
import { useAiAssistant } from '@/lib/aiAssistant';
import { TIERS, canAccess, type Tier } from '@/lib/tiers';

// ── SVG icon primitives (matching E1 sidebar icon style) ──────────────────
const IC: Record<string, JSX.Element> = {
  overview:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" fill="none"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" fill="none"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" fill="none"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" fill="none"/></svg>,
  record:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" fill="none"/><path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  timeline:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 3v18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity=".5"/><circle cx="6" cy="7" r="2" stroke="currentColor" strokeWidth="1.6" fill="none"/><circle cx="6" cy="15" r="2" stroke="currentColor" strokeWidth="1.6" fill="none"/><path d="M11 7h9M11 15h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  import:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3v12M7 10l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  schedule:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" fill="none"/><path d="M8 3v4M16 3v4M3 10h18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><path d="M8 15h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  advisor:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2a7 7 0 00-4 12.7V17a1 1 0 001 1h6a1 1 0 001-1v-2.3A7 7 0 0012 2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M9 21h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  people:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" fill="none"/><path d="M3 20v-1.5a4.5 4.5 0 014.5-4.5h3A4.5 4.5 0 0115 18.5V20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none"/><path d="M16.5 5.2a3 3 0 010 5.6M18 20v-1.6a4 4 0 00-2.6-3.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/></svg>,
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
  rooms:      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 18v-6a2 2 0 012-2h14a2 2 0 012 2v6" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round"/><path d="M3 14h18M2 18h20M6 10V8a2 2 0 012-2h8a2 2 0 012 2v2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>,
  invoice:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2z" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round"/><path d="M9 7h6M9 11h6M9 15h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  pricing:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round"/><circle cx="7" cy="7" r="1.4" fill="currentColor"/></svg>,
  sliders:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><path d="M1 14h6M9 8h6M17 16h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  sun:        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.6"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  moon:       <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

type NavItem = { href: string; label: string; icon: JSX.Element; engine?: 'ci' | 'ops' };
type NavSection = { type: 'section'; label: string; colour: string; engine?: 'ci' | 'ops' };
type NavEntry = NavItem | NavSection;

// Pro nav — grouped into labelled sections that mirror the owner's mental model
// (audit F-06: a 25-item flat list forces a re-scan on every navigation; the
// grouping the CI/Ops sections already proved works is applied everywhere).
// Plans & Pricing lives in the plan chip at the rail's foot, not in the nav.
const NAV: NavEntry[] = [
  // Today IS the brief + the decisions (audit #9) — Advisor and the deep
  // briefs merged into /dashboard and /dashboard/brief's tabs.
  { href: '/dashboard',            label: 'Today',            icon: IC.overview   },
  { href: '/dashboard/brief',      label: 'Briefs',           icon: IC.brief      },

  { type: 'section', label: 'Record & Plan', colour: 'var(--cyan)' },
  { href: '/dashboard/record',     label: 'Record',           icon: IC.record     },
  { href: '/dashboard/timeline',   label: 'Timeline',         icon: IC.timeline   },
  { href: '/dashboard/schedule',   label: 'Schedule',         icon: IC.schedule   },
  { href: '/dashboard/invoices',   label: 'Invoices',         icon: IC.invoice    },
  { href: '/dashboard/import',     label: 'Import',           icon: IC.import     },
  { href: '/data-studio',          label: 'Data Studio',      icon: IC.studio     },

  { type: 'section', label: 'Financial', colour: 'var(--e1)' },
  { href: '/dashboard/cash',       label: 'Cash Intel',       icon: IC.cash       },
  { href: '/dashboard/variance',   label: 'Variance',         icon: IC.variance   },
  { href: '/dashboard/forecast',   label: 'Forecast',         icon: IC.forecast   },
  { href: '/dashboard/anomaly',    label: 'Anomaly Intel',    icon: IC.anomaly    },
  { href: '/dashboard/breakeven',  label: 'Breakeven',        icon: IC.breakeven  },
  { href: '/dashboard/simulate',   label: 'Simulator',        icon: IC.forecast   },

  { type: 'section', label: 'People & Stock', colour: 'var(--purple)' },
  { href: '/dashboard/employees',  label: 'Employees',        icon: IC.people     },
  { href: '/dashboard/inventory',  label: 'Inventory',        icon: IC.inventory  },

  { type: 'section', label: 'Customer Intelligence', colour: 'var(--e2)', engine: 'ci' },
  { href: '/dashboard/customers',  label: 'Customer Intel',   icon: IC.customers,   engine: 'ci' },
  { href: '/dashboard/churn',      label: 'Churn Risk',       icon: IC.churn,       engine: 'ci' },
  { href: '/dashboard/products',   label: 'Product Matrix',   icon: IC.products,    engine: 'ci' },
  { href: '/dashboard/market',     label: 'Market Intel',     icon: IC.market,      engine: 'ci' },

  { type: 'section', label: 'Operations', colour: 'var(--e3)', engine: 'ops' },
  { href: '/dashboard/pos',        label: 'POS Intelligence', icon: IC.pos,         engine: 'ops' },
  { href: '/dashboard/benchmarks', label: 'Benchmarks',       icon: IC.benchmarks,  engine: 'ops' },
];

// Simple mode — the owner-language surface. Six doors, no jargon, no engine
// tabs (ux_intelligence.md DECISION SIMPLIFICATION: remove decisions that don't
// need to exist). Every technical page stays one toggle away.
const SIMPLE_NAV: NavItem[] = [
  { href: '/dashboard',           label: 'Home',     icon: IC.overview  },
  { href: '/dashboard/record',    label: 'Record',   icon: IC.record    },
  { href: '/dashboard/schedule',  label: 'Schedule', icon: IC.schedule  },
  { href: '/dashboard/employees', label: 'Staff',    icon: IC.people    },
  { href: '/dashboard/inventory', label: 'Stock',    icon: IC.inventory },
  { href: '/dashboard/cash',      label: 'Money',    icon: IC.cash      },
  { href: '/dashboard/timeline',  label: 'Activity', icon: IC.timeline  },
];

// Hospitality — a paid vertical, only shown when the tier entitles it (moves to
// its own add-on SKU later). One hub door: the booking calendar is the hero, and
// everything it records already flows into Cash/Timeline via the spine.
const HOSPITALITY_ITEM: NavItem = { href: '/dashboard/hospitality', label: 'Rooms & Stays', icon: IC.rooms };
const HOSPITALITY_SECTION: NavSection = { type: 'section', label: 'Hospitality', colour: 'var(--amber)', engine: 'ops' };

export default function Sidebar() {
  const pathname = usePathname();
  const {
    sidebarCollapsed, toggleSidebar, hasEngine2Data, hasEngine3Data, uploadedFile,
    mobileNavOpen, setMobileNav, tier, uiMode, setUiMode,
  } = useStore();
  const { toggle, isDark } = useTheme();
  const { isAdmin, teamRole } = useProfile();
  const { setOpen: setAssistantOpen } = useAiAssistant();
  const col = sidebarCollapsed;
  const simple = uiMode === 'simple';

  // Team roles (audit #27/#28): staff see the day-to-day (record + plan), not
  // the money/intelligence pages; accountants read everything but the
  // write-only capture surfaces. Owners see everything (the default).
  const STAFF_HREFS = new Set([
    '/dashboard', '/dashboard/record', '/dashboard/timeline', '/dashboard/schedule',
    '/dashboard/inventory', '/dashboard/hospitality',
  ]);
  const ACCOUNTANT_HIDE = new Set(['/dashboard/record', '/dashboard/import']);
  const roleAllows = (href: string) =>
    teamRole === 'staff' ? STAFF_HREFS.has(href)
    : teamRole === 'accountant' ? !ACCOUNTANT_HIDE.has(href)
    : true;

  // Splice the Hospitality vertical into the nav only when the plan entitles it.
  // Simple mode gets a plain door alongside the other essentials; Pro mode gets
  // its own labelled section so it reads as a distinct operation.
  const entitledHospitality = canAccess(tier as Tier, 'hospitality');
  const entries: NavEntry[] = (() => {
    const base = simple ? [...SIMPLE_NAV] : [...NAV];
    if (!entitledHospitality) return base;
    if (simple) {
      const at = base.findIndex(e => 'href' in e && e.href === '/dashboard/schedule');
      base.splice(at >= 0 ? at + 1 : base.length, 0, HOSPITALITY_ITEM);
      return base;
    }
    // Pro: place the section just before Customer Intelligence.
    const at = base.findIndex(e => 'type' in e && e.label === 'Customer Intelligence');
    const block: NavEntry[] = [HOSPITALITY_SECTION, HOSPITALITY_ITEM];
    base.splice(at >= 0 ? at : base.length, 0, ...block);
    return base;
  })();

  // Apply the team-role filter, then drop any section header left with no
  // items beneath it (so staff don't see an empty "Financial" label).
  const roleFiltered: NavEntry[] = (() => {
    if (teamRole === 'owner') return entries;
    const kept = entries.filter(e => 'type' in e ? true : roleAllows(e.href));
    return kept.filter((e, i) => {
      if (!('type' in e)) return true;
      const next = kept[i + 1];
      return next !== undefined && !('type' in next);   // header only if followed by an item
    });
  })();

  const isLocked = (eng?: 'ci' | 'ops') =>
    eng === 'ci' ? !hasEngine2Data : eng === 'ops' ? !hasEngine3Data : false;

  // Non-engine items highlight in the brand cyan; engine items in their engine
  // hue. (--e1 is the Financial blue now, no longer an alias of --cyan.)
  const getAccent = (eng?: 'ci' | 'ops') =>
    eng === 'ci' ? 'var(--e2)' : eng === 'ops' ? 'var(--e3)' : 'var(--cyan)';

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
            src={isDark ? '/brand/aibos-mark-white-glyph.png' : '/brand/aibos-mark.png'}
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
        {roleFiltered.map((entry, i) => {
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
            <div
              key={item.href}
              title={locked ? 'Upload data to unlock' : undefined}
              data-tour={item.href === '/dashboard/record' ? 'nav-record' : undefined}
            >
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

        {/* Ask AIBOS — simple mode's front door to the assistant. */}
        {simple && (
          <button
            type="button"
            data-tour="ask-aibos"
            onClick={() => { setAssistantOpen(true); setMobileNav(false); }}
            aria-label="Ask AIBOS anything about your business"
            title={col ? 'Ask AIBOS' : undefined}
            style={{ background: 'transparent', border: 'none', padding: 0, width: '100%', cursor: 'pointer', textAlign: 'left' }}
          >
            <div className="nav-item">
              <span style={{ color: 'var(--cyan)', flexShrink: 0, display: 'flex' }}>{IC.advisor}</span>
              <AnimatePresence>
                {!col && (
                  <motion.span
                    initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -6 }} transition={{ duration: 0.15 }}
                    className="nav-label" style={{ color: 'var(--text-2)', flex: 1 }}
                  >
                    Ask AIBOS
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </button>
        )}

        {/* Admin — only rendered for admins (cosmetic; server gate is the real one) */}
        {isAdmin && (
          <>
            <AnimatePresence>
              {!col && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="nav-section" style={{ color: 'var(--cyan)', marginTop: 8 }}
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
                  color: pathname.startsWith('/admin') ? 'var(--cyan)' : undefined,
                  ...(pathname.startsWith('/admin') ? { background: 'color-mix(in srgb, var(--cyan) 10%, transparent)' } : {}),
                }}
              >
                {pathname.startsWith('/admin') && (
                  <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 2, borderRadius: 2, background: 'var(--cyan)' }} />
                )}
                <span style={{ color: pathname.startsWith('/admin') ? 'var(--cyan)' : 'var(--text-3)', flexShrink: 0, display: 'flex' }}>
                  {IC.admin}
                </span>
                <AnimatePresence>
                  {!col && (
                    <motion.span
                      initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }} transition={{ duration: 0.15 }}
                      className="nav-label"
                      style={{ color: pathname.startsWith('/admin') ? 'var(--cyan)' : 'var(--text-2)', flex: 1 }}
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
            <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Current plan
            </span>
            <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text-1)' }}>
              {TIERS[tier].name}
            </span>
          </span>
          {tier !== 'growth' && (
            <span style={{ fontSize: 'var(--fs-label)', fontWeight: 700, color: '#fff', background: 'var(--cyan)', padding: '5px 10px', borderRadius: 8, whiteSpace: 'nowrap' }}>
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

        {/* Simple ⇄ Pro mode switch — every technical tab is one flick away. */}
        {col ? (
          <button
            type="button"
            onClick={() => setUiMode(simple ? 'technical' : 'simple')}
            aria-label={simple ? 'Switch to Pro mode — show all intelligence tabs' : 'Switch to Simple mode'}
            title={simple ? 'Switch to Pro mode' : 'Switch to Simple mode'}
            style={{
              width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-md)',
              background: 'var(--bg-badge)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: simple ? 'var(--text-3)' : 'var(--cyan)', flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
          >
            {IC.sliders}
          </button>
        ) : (
          <div
            role="group"
            aria-label="Interface mode"
            data-tour="mode-toggle"
            style={{
              display: 'flex', height: 32, borderRadius: 8, overflow: 'hidden',
              border: '1px solid var(--border-md)', background: 'var(--bg-badge)', flexShrink: 0,
            }}
          >
            {(['simple', 'technical'] as const).map((m) => {
              const on = uiMode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setUiMode(m)}
                  aria-pressed={on}
                  aria-label={m === 'simple' ? 'Simple mode — the essentials in plain language' : 'Pro mode — all intelligence tabs'}
                  style={{
                    padding: '0 10px', border: 'none', cursor: 'pointer',
                    fontSize: 'var(--fs-label)', fontWeight: 700,
                    letterSpacing: '0.02em',
                    background: on ? 'var(--cyan)' : 'transparent',
                    color: on ? '#fff' : 'var(--text-4)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {m === 'simple' ? 'Simple' : 'Pro'}
                </button>
              );
            })}
          </div>
        )}
        <AnimatePresence>
          {!col && uploadedFile && (
            <motion.span
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}
            >
              {uploadedFile}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}
