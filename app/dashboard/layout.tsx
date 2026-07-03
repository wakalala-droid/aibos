'use client';
import { useStore } from '@/lib/store';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import DashboardHeader from '@/components/layout/DashboardHeader';
import DashboardTour from '@/components/onboarding/DashboardTour';
import { logUsage, type UsageEngine } from '@/lib/usage';

// Map a dashboard path to the engine it belongs to, for usage tracking.
function engineForPath(path: string): UsageEngine | undefined {
  if (path === '/dashboard' || /\/(cash|variance|forecast|anomaly|breakeven|brief)$/.test(path)) return 'engine1';
  if (/\/(customers|churn|products|market)$/.test(path)) return 'engine2';
  if (/\/(pos|benchmarks|ops-brief)$/.test(path)) return 'engine3';
  return undefined;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const collapsed = useStore(s => s.sidebarCollapsed);
  const refreshTwin = useStore(s => s.refreshTwin);
  const pathname = usePathname();

  // Evolution spine: pull the Digital Twin once on entry. When the user has
  // recorded activity but not loaded a file, this lights up the existing
  // dashboards from events (Initiative 9). Safe no-op if the spine is
  // unconfigured or a file is already loaded (guarded inside refreshTwin).
  useEffect(() => { refreshTwin(); }, [refreshTwin]);

  useEffect(() => {
    const el = document.getElementById('main-content');
    if (!el) return;
    if (collapsed) {
      el.classList.add('sidebar-collapsed');
    } else {
      el.classList.remove('sidebar-collapsed');
    }
  }, [collapsed]);

  // Lightweight, fire-and-forget engine/page-view tracking on navigation.
  useEffect(() => {
    if (!pathname) return;
    const engine = engineForPath(pathname);
    if (engine) logUsage('engine_view', { engine, meta: { path: pathname } });
    else logUsage('page_view', { meta: { path: pathname } });
  }, [pathname]);

  return (
    <div className="page-container" data-bento>
      <DashboardHeader />
      {children}
      <DashboardTour />
    </div>
  );
}
