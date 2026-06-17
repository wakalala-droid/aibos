'use client';

import { usePathname } from 'next/navigation';
import { MotionConfig } from 'framer-motion';
import Sidebar from './Sidebar';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme';

// Routes that render full-screen WITHOUT the app chrome (sidebar + padded
// main area). The login/auth screens are standalone and must not show the
// navigation — you aren't signed in yet.
const BARE_ROUTES = ['/login', '/auth'];

function HamburgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const isBare = BARE_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(`${r}/`)
  );

  const mobileNavOpen = useStore((s) => s.mobileNavOpen);
  const toggleMobileNav = useStore((s) => s.toggleMobileNav);
  const setMobileNav = useStore((s) => s.setMobileNav);
  const { toggle, isDark } = useTheme();

  if (isBare) {
    // Still honour reduced-motion preference on standalone screens.
    return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
  }

  return (
    <MotionConfig reducedMotion="user">
      <a href="#main" className="skip-link">Skip to main content</a>

      <div className="app-shell">
        <Sidebar />

        {/* Backdrop — only rendered (and visible) when the mobile drawer is open. */}
        {mobileNavOpen && (
          <button
            type="button"
            className="nav-backdrop"
            aria-label="Close navigation menu"
            onClick={() => setMobileNav(false)}
          />
        )}

        <div id="main-content" className="main-content">
          {/* Mobile top bar — CSS hides it at lg and above. */}
          <header className="mobile-topbar">
            <button
              type="button"
              className="touch-target"
              aria-label="Open navigation menu"
              aria-expanded={mobileNavOpen}
              aria-controls="primary-navigation"
              onClick={toggleMobileNav}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 44, height: 44, borderRadius: 8,
                border: '1px solid var(--border-md)', background: 'var(--bg-badge)',
                color: 'var(--text-2)', cursor: 'pointer',
              }}
            >
              <HamburgerIcon />
            </button>

            <span style={{
              fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', fontWeight: 800,
              color: 'var(--text-1)', letterSpacing: '-0.02em',
            }}>
              AI-BOS
            </span>

            <button
              type="button"
              className="touch-target"
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={toggle}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 44, height: 44, borderRadius: 8,
                border: '1px solid var(--border-md)', background: 'var(--bg-badge)',
                color: 'var(--text-3)', cursor: 'pointer',
              }}
            >
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>
          </header>

          <main id="main" tabIndex={-1} style={{ outline: 'none' }}>{children}</main>
        </div>
      </div>
    </MotionConfig>
  );
}
