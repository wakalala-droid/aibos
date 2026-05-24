/**
 * AI-BOS — Dashboard Shell Layout
 * Server component wrapper; children are the page content.
 * Sidebar + TopNav live here so they persist across page navigations.
 */

import { redirect } from 'next/navigation';
import { createServerComponentClient } from '@/lib/supabase-server';
import { DashboardClient } from './DashboardClient';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side session guard (belt + suspenders beyond middleware)
  const supabase = await createServerComponentClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login');

  return <DashboardClient>{children}</DashboardClient>;
}
