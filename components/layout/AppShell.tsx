'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

// Routes that render full-screen WITHOUT the app chrome (sidebar + padded
// main area). The login/auth screens are standalone and must not show the
// navigation — you aren't signed in yet.
const BARE_ROUTES = ['/login', '/auth'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const isBare = BARE_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(`${r}/`)
  );

  if (isBare) {
    return <>{children}</>;
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div id="main-content" className="main-content">
        {children}
      </div>
    </div>
  );
}
