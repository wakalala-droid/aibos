/*
  The API's own origin, allowed for the browser to call. The AI chat streams
  straight from the browser to the API (lib/aiAssistant.tsx): the website's
  relay stops any request at 60 seconds, which is how long questions ended in
  "504". Everything else still goes through /api/proxy. Read at build time,
  like every NEXT_PUBLIC_* value.
*/
const API_ORIGIN = (() => {
  try {
    const raw = (process.env.NEXT_PUBLIC_API_URL || '').trim();
    return raw ? new URL(raw).origin : '';
  } catch {
    return '';
  }
})();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Overridable build dir so `next build` can run while a dev server holds
  // .next (e.g. NEXT_DIST_DIR=.next-build npm run build). Defaults unchanged.
  distDir: process.env.NEXT_DIST_DIR || '.next',

  // Release gate: the build must fail on real type/lint errors. The earlier
  // "temporary unblock" is removed now that dashboard typing is reconciled
  // (tsc --noEmit is clean). Do not re-disable these without fixing the cause.
  typescript: {
    ignoreBuildErrors: false,
  },

  eslint: {
    ignoreDuringBuilds: false,
  },

  // App Router is enabled by default in Next.js 14
  experimental: {
    // Server Actions are stable in Next.js 14
  },

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com', // Google profile photos
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',              // Supabase storage
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',          value: 'DENY' },
          { key: 'X-Content-Type-Options',   value: 'nosniff' },
          { key: 'Referrer-Policy',          value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection',         value: '1; mode=block' },
          {
            // self: first-party pages may request camera/mic (QR scan, voice
            // recording). Third-party iframes still get none. geolocation is
            // unused by the app, stays blocked.
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=()',
          },
          {
            // HSTS (audit #82): force HTTPS for a year, including subdomains.
            // Safe on Vercel (always TLS); harmless locally (http ignores it).
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            // Conservative CSP (audit #82). Next.js needs 'unsafe-inline' +
            // 'unsafe-eval' for its runtime and the app's pervasive inline
            // styles; a nonce-based tightening is a dedicated follow-up. connect
            // is same-origin (the API is reached via /api/proxy), Supabase, and
            // the API itself for the chat's direct stream (API_ORIGIN above).
            // frame-ancestors 'none' backs up X-Frame-Options against clickjacking.
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com",
              "font-src 'self' data:",
              `connect-src 'self' https://*.supabase.co${API_ORIGIN ? ` ${API_ORIGIN}` : ''}`,
              "media-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },

  // CORS for FastAPI backend
  async rewrites() {
    return [
      // Optional: proxy API calls through Next.js to avoid CORS
      // Uncomment if needed:
      // {
      //   source: '/api/engine/:path*',
      //   destination: `${process.env.NEXT_PUBLIC_API_URL}/:path*`,
      // },
    ];
  },
};

module.exports = nextConfig;
