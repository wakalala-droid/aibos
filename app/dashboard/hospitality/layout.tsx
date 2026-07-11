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

const TABS = [
  { href: '/dashboard/hospitality',          label: 'Calendar' },
  { href: '/dashboard/hospitality/units',    label: 'Units'    },
  { href: '/dashboard/hospitality/guests',   label: 'Guests'   },
  { href: '/dashboard/hospitality/channels', label: 'Channels' },
];

export default function HospitalityLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <>
      <PageHeader
        title="Hospitality"
        subtitle="Every unit&apos;s availability on one calendar — bookings flow straight into your books."
      />
      <nav aria-label="Hospitality sections" style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        {TABS.map(t => {
          const active = t.href === '/dashboard/hospitality' ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? 'page' : undefined}
              style={{
                position: 'relative', padding: '10px 14px', textDecoration: 'none', whiteSpace: 'nowrap',
                fontSize: 'var(--fs-data)', fontWeight: 600,
                color: active ? 'var(--text-1)' : 'var(--text-3)',
              }}
            >
              {t.label}
              {active && <span style={{ position: 'absolute', left: 10, right: 10, bottom: -1, height: 2, borderRadius: 2, background: 'var(--amber)' }} />}
            </Link>
          );
        })}
      </nav>
      {children}
    </>
  );
}
