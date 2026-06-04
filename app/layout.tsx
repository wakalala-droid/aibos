import type { Metadata } from 'next';
import { ThemeProvider, FOUC_SCRIPT } from '@/lib/theme';
import Sidebar from '@/components/layout/Sidebar';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI-BOS — Business Intelligence Platform',
  description: 'Financial · Customer · Operations intelligence for Zambian SMEs',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: FOUC_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <MainArea>{children}</MainArea>
    </div>
  );
}

function MainArea({ children }: { children: React.ReactNode }) {
  // We render this as a client wrapper in the dashboard layout
  return (
    <div id="main-content" className="main-content">
      {children}
    </div>
  );
}
