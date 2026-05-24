/**
 * AI-BOS — Root Layout
 * Applies global fonts, CSS, and client-side providers
 */

import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: {
    default: 'AI-BOS · Financial Intelligence Platform',
    template: '%s · AI-BOS',
  },
  description:
    'Enterprise-grade financial intelligence. Powered by AI. Built for modern finance teams.',
  keywords: ['financial intelligence', 'AI CFO', 'P&L analysis', 'cash flow', 'forecasting'],
  authors: [{ name: 'AI-BOS' }],
  creator: 'AI-BOS',
  robots: { index: false, follow: false }, // Private SaaS
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'AI-BOS · Financial Intelligence Platform',
    description: 'Enterprise-grade financial intelligence powered by AI.',
    type: 'website',
    locale: 'en_US',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#03060d',
};

// ─── Root Layout ──────────────────────────────────────────────────────────────

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preconnect for Google Fonts performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
