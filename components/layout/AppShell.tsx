'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { isMarketingRoute } from '@/lib/routes';

// The app around every page (components/layout/AppFrame.tsx): the sidebar,
// tabs, assistant, profile, toasts and offline sync. A chunk of its own, so
// the public website, which shows none of it, never downloads or runs it
// (10 Oct 2026: the website was loading about 1 MB of the app's code, the
// Supabase client among it, on every phone).
const AppFrame = dynamic(() => import('./AppFrame'));

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  if (isMarketingRoute(pathname)) return <>{children}</>;
  return <AppFrame>{children}</AppFrame>;
}
