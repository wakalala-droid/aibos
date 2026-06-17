import type { Metadata } from 'next';
import { ThemeProvider, FOUC_SCRIPT } from '@/lib/theme';
import AppShell from '@/components/layout/AppShell';
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
