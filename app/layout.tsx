import type { Metadata, Viewport } from 'next';
import { ThemeProvider, FOUC_SCRIPT } from '@/lib/theme';
import AppShell from '@/components/layout/AppShell';
import { OfflineSync } from '@/components/pwa/OfflineSync';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI-BOS — Business Intelligence Platform',
  description: 'Financial · Customer · Operations intelligence for Zambian SMEs',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'AI-BOS',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0e1a',
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
          <OfflineSync />
        </ThemeProvider>
      </body>
    </html>
  );
}
