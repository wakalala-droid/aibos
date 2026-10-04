'use client';
/**
 * Hospitality section shell — keeps the whole module behind ONE sidebar door
 * (per "simplify use") and organises it with a light tab bar instead of a wall of
 * nav items. Calendar is the hero/home; Units is the single-source-of-truth
 * editor; Guests is the CRM; Channels is the iCal sync surface.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';

// Bookings sits next to Calendar because they answer different questions about
// the same thing: the calendar says whether a unit is free, the list says who is
// waiting on an answer. A guest profile has no tab of its own (it needs an id),
// and it lives under /guests/<id>, so the Guests tab stays lit while you read one.
const TABS = [
  { href: '/dashboard/hospitality',          label: 'Calendar' },
  { href: '/dashboard/hospitality/bookings', label: 'Bookings' },
  { href: '/dashboard/hospitality/units',    label: 'Units'    },
  { href: '/dashboard/hospitality/guests',   label: 'Guests'   },
  { href: '/dashboard/hospitality/channels', label: 'Channels' },
];

export default function HospitalityLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <>
      <PageHeader
        title="Rooms & Stays"
        subtitle="Every unit&apos;s availability on one calendar. Bookings go straight into your books."
      />
      {/* The sections as pills, the chosen one filled: the same chips every
          page uses for its filters (redesign 2026-10). Scrolls sideways on a phone. */}
      <nav aria-label="Rooms and Stays sections" className="chips" style={{ flexWrap: 'nowrap', overflowX: 'auto', marginBottom: 16, paddingBottom: 2 }}>
        {TABS.map(t => {
          const active = t.href === '/dashboard/hospitality' ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href} className="chip" aria-current={active ? 'page' : undefined}>
              {t.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </>
  );
}
