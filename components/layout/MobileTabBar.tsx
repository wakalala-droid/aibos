'use client';

// MobileTabBar: thumb-reach navigation on phones, in both modes (audit #26,
// UI/UX audit 2026-10 A8). Four doors from the shared list in lib/nav.ts,
// chosen for this plan and team role (Rooms & Stays for hospitality owners,
// no Money for staff), then "More", which opens the full menu. CSS hides it at
// lg+ where the side menu takes over.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStore } from '@/lib/store';
import { useProfile } from '@/lib/profile';
import { tabBarDoors, isDoorActive } from '@/lib/nav';
import type { Tier } from '@/lib/tiers';
import { IC } from './navIcons';

export default function MobileTabBar() {
  const pathname = usePathname();
  const tier = useStore((s) => s.tier);
  const mobileNavOpen = useStore((s) => s.mobileNavOpen);
  const setMobileNav = useStore((s) => s.setMobileNav);
  const { teamRole } = useProfile();
  const doors = tabBarDoors(tier as Tier, teamRole);

  return (
    <nav className="mobile-tabbar" aria-label="Quick navigation">
      {doors.map((d) => {
        const active = isDoorActive(d.href, pathname);
        return (
          <Link
            key={d.href}
            href={d.href}
            aria-current={active ? 'page' : undefined}
            className={`mobile-tab${active ? ' active' : ''}`}
            onClick={() => setMobileNav(false)}
          >
            <span aria-hidden="true" className="mobile-tab-icon">{IC[d.icon]}</span>
            <span>{d.short ?? d.label}</span>
          </Link>
        );
      })}
      <button
        type="button"
        className={`mobile-tab${mobileNavOpen ? ' active' : ''}`}
        aria-expanded={mobileNavOpen}
        aria-controls="primary-navigation"
        onClick={() => setMobileNav(!mobileNavOpen)}
      >
        <span aria-hidden="true" className="mobile-tab-icon">{IC.more}</span>
        <span>More</span>
      </button>
    </nav>
  );
}
