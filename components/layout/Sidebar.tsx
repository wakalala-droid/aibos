'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import { useProfile } from '@/lib/profile';
import { useAiAssistant } from '@/lib/aiAssistant';
import { TIERS, type Tier } from '@/lib/tiers';
import { visibleDoors, isDoorActive, type NavDoor } from '@/lib/nav';

import { IC } from './navIcons';

type NavItem = { href: string; label: string; icon: JSX.Element; engine?: 'ci' | 'ops' };

// The menu is built from lib/nav.ts, the same list the phone bar and the search
// box use (UI/UX audit 2026-10, A5 to A8, A14). Simple and Pro share every door
// and every name; Pro adds one "Reports" group, folded away until it is wanted.
const REPORTS_KEY = 'aibos-reports-open-v1';

export default function Sidebar() {
  const pathname = usePathname();
  const {
    sidebarCollapsed, toggleSidebar, hasEngine2Data, hasEngine3Data, uploadedFile,
    mobileNavOpen, setMobileNav, tier, uiMode, setUiMode,
  } = useStore();
  const { toggle, isDark } = useTheme();
  const { isAdmin, teamRole, loading: planLoading } = useProfile();
  const { setOpen: setAssistantOpen } = useAiAssistant();
  const col = sidebarCollapsed;
  const simple = uiMode === 'simple';

  const doors = visibleDoors(tier as Tier, teamRole);
  const toItem = (d: NavDoor): NavItem => ({ href: d.href, label: d.label, icon: IC[d.icon], engine: d.engine });
  const mainItems = doors.filter((d) => d.group === 'main').map(toItem);
  const reportItems = simple ? [] : doors.filter((d) => d.group === 'reports').map(toItem);
  const onReport = reportItems.some((r) => isDoorActive(r.href, pathname));
  const [reportsOpen, setReportsOpen] = useState(false);
  useEffect(() => {
    try { setReportsOpen(window.localStorage.getItem(REPORTS_KEY) === '1'); } catch { /* private mode */ }
  }, []);
  const reportsShown = reportsOpen || onReport || col;
  const toggleReports = () => {
    const next = !reportsOpen;
    setReportsOpen(next);
    try { window.localStorage.setItem(REPORTS_KEY, next ? '1' : '0'); } catch { /* private mode */ }
  };

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
            alt="AIBOS"
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
                alt="AIBOS"
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
        {(() => {
          const renderItem = (item: NavItem) => {
            const active = isDoorActive(item.href, pathname);
            const locked = isLocked(item.engine);
            const accent = getAccent(item.engine);

            return (
              <div
                key={item.href}
                title={locked ? 'Needs your sales data first' : undefined}
                data-tour={item.href === '/dashboard/record' ? 'nav-record' : undefined}
              >
                <Link
                  href={locked ? '#' : item.href}
                  aria-current={active ? 'page' : undefined}
                  aria-disabled={locked || undefined}
                  aria-label={locked ? `${item.label}: needs your sales data first` : undefined}
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
          };
          return (
            <>
              {mainItems.map(renderItem)}
              {reportItems.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={toggleReports}
                    aria-expanded={reportsShown}
                    aria-controls="nav-reports"
                    className="nav-section"
                    title={col ? 'Reports' : undefined}
                    style={{
                      display: col ? 'none' : 'flex', alignItems: 'center', justifyContent: 'space-between',
                      width: 'calc(100% - 16px)', margin: '12px 8px 4px', border: 'none', background: 'transparent',
                      cursor: 'pointer', color: 'var(--text-3)', textAlign: 'left',
                    }}
                  >
                    <span>Reports</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                      style={{ transform: reportsShown ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s ease-out' }}>
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {reportsShown && <div id="nav-reports">{reportItems.map(renderItem)}</div>}
                </>
              )}
            </>
          );
        })()}

        {/* Ask AIBOS: the menu's front door to the assistant, in both modes. */}
        {(
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
          // A paid plan opens Plan & billing: when it renews, what it costs,
          // every payment and its receipt. Free still goes to the plans.
          href={tier === 'free' ? '/pricing' : '/dashboard/billing'}
          onClick={() => setMobileNav(false)}
          aria-label={tier === 'free' ? 'Free plan. See the plans' : `${TIERS[tier].name} plan. Open plan and billing`}
          style={{
            margin: '4px 12px 8px', padding: '10px 12px', borderRadius: 10,
            border: '1px solid var(--border)', background: 'var(--bg-badge)',
            textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          }}
        >
          <span style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 'var(--fs-caps)', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Current plan
            </span>
            {/* Signing in on a new device starts from a blank cache, which reads
                as Free, so a Growth owner was shown "Free" and "Upgrade" until the
                plan loaded. Nothing is named until it is known. */}
            <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: planLoading ? 'var(--text-4)' : 'var(--text-1)' }}>
              {planLoading ? 'Checking…' : TIERS[tier].name}
            </span>
          </span>
          {!planLoading && tier !== 'growth' && (
            <span style={{ fontSize: 'var(--fs-label)', fontWeight: 700, color: 'var(--on-cyan)', background: 'var(--cyan)', padding: '5px 10px', borderRadius: 8, whiteSpace: 'nowrap' }}>
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
            aria-label={simple ? 'Switch to Pro mode: show all intelligence tabs' : 'Switch to Simple mode'}
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
              display: 'flex', height: 44, borderRadius: 10, overflow: 'hidden',
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
                  aria-label={m === 'simple' ? 'Simple mode (the essentials in plain language' : 'Pro mode) all intelligence tabs'}
                  style={{
                    padding: '0 10px', border: 'none', cursor: 'pointer',
                    fontSize: 'var(--fs-label)', fontWeight: 700,
                    letterSpacing: '0.02em',
                    background: on ? 'var(--cyan)' : 'transparent',
                    color: on ? 'var(--on-cyan)' : 'var(--text-4)',
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
