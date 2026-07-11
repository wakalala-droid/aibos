'use client';

// MobileTabBar — Simple mode's thumb-reach navigation on phones (audit #26).
// Five doors, matching the Simple sidebar's plain language. Rendered only in
// Simple mode; CSS hides it at lg+ where the sidebar rail takes over. The
// drawer stays available (hamburger) for everything else.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStore } from '@/lib/store';

const TABS: { href: string; label: string; icon: JSX.Element }[] = [
  {
    href: '/dashboard', label: 'Home',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 10.5L12 3l9 7.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 9.5V21h5v-6h4v6h5V9.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>,
  },
  {
    href: '/dashboard/record', label: 'Record',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" fill="none"/><path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/></svg>,
  },
  {
    href: '/dashboard/cash', label: 'Money',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2 8h20v10a2 2 0 01-2 2H4a2 2 0 01-2-2V8z" stroke="currentColor" strokeWidth="1.7" fill="none"/><path d="M2 8l2-4h16l2 4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><circle cx="12" cy="14" r="2" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>,
  },
  {
    href: '/dashboard/inventory', label: 'Stock',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 7l9-4 9 4-9 4-9-4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M3 7v10l9 4 9-4V7M12 11v10" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>,
  },
  {
    href: '/dashboard/timeline', label: 'Activity',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 3v18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" opacity=".5"/><circle cx="6" cy="7" r="2" stroke="currentColor" strokeWidth="1.7" fill="none"/><circle cx="6" cy="15" r="2" stroke="currentColor" strokeWidth="1.7" fill="none"/><path d="M11 7h9M11 15h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>,
  },
];

export default function MobileTabBar() {
  const pathname = usePathname();
  const uiMode = useStore((s) => s.uiMode);
  if (uiMode !== 'simple') return null;

  return (
    <nav className="mobile-tabbar" aria-label="Quick navigation">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`mobile-tab${active ? ' active' : ''}`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
