'use client';

// Admin shell — mirrors the dashboard layout (DashboardHeader + page-container)
// inside the root AppShell. The real access gate is middleware.ts + the API
// routes; this client guard only prevents a flash of admin UI.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { useProfile } from '@/lib/profile';
import DashboardHeader from '@/components/layout/DashboardHeader';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const collapsed = useStore((s) => s.sidebarCollapsed);
  const { isAdmin, loading } = useProfile();

  useEffect(() => {
    const el = document.getElementById('main-content');
    if (!el) return;
    if (collapsed) el.classList.add('sidebar-collapsed');
    else el.classList.remove('sidebar-collapsed');
  }, [collapsed]);

  // Cosmetic redirect for non-admins (server already blocks via middleware).
  useEffect(() => {
    if (!loading && !isAdmin) router.replace('/dashboard');
  }, [loading, isAdmin, router]);

  if (loading || !isAdmin) {
    return (
      <div className="page-container">
        <div className="section-card" style={{ marginTop: 24 }} aria-busy="true">
          <p style={{ fontFamily: 'Inter, sans-serif', color: 'var(--text-3)', margin: 0 }}>
            Checking access…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <DashboardHeader />
      {children}
    </div>
  );
}
