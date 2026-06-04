'use client';
import { useStore } from '@/lib/store';
import { useEffect } from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const collapsed = useStore(s => s.sidebarCollapsed);

  useEffect(() => {
    const el = document.getElementById('main-content');
    if (!el) return;
    if (collapsed) {
      el.classList.add('sidebar-collapsed');
    } else {
      el.classList.remove('sidebar-collapsed');
    }
  }, [collapsed]);

  return (
    <div className="page-container">
      {children}
    </div>
  );
}
