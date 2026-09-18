import type { Metadata, Viewport } from 'next';
import { ThemeProvider, FOUC_SCRIPT } from '@/lib/theme';
import AppShell from '@/components/layout/AppShell';
import { OfflineSync } from '@/components/pwa/OfflineSync';
import './globals.css';

export const metadata: Metadata = {
  title: 'AIBOS — Business Intelligence Platform',
  description: 'Financial · Customer · Operations intelligence for Zambian SMEs',
  manifest: '/manifest.webmanifest',
  icons: {
    // The white logo on its own, no box: the tab, and the installed app on a
    // computer (/icons/icon-*.png). A phone always puts an icon on a tile, so
    // the iPhone and Android icons carry the same logo on the app's own dark
    // colour; left transparent, iOS fills it black and Android white, which
    // would swallow a white logo.
    icon: '/brand/aibos-mark-white-glyph.png',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'AIBOS',
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
        {/* The opening screen's mark, fetched with the page rather than after it. */}
        <link rel="preload" as="image" href="/brand/aibos-mark-white-glyph.png" />
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
