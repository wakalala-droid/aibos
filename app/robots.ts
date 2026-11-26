import type { MetadataRoute } from 'next';

// /robots.txt: search engines may read the public website, never the app.
// The site had none until 26 Nov 2026, so every crawler's first request was a
// 404 and nothing pointed it at the sitemap.
//
// /pay/ holds the payment pages behind each invoice's and stay's own link:
// private to whoever was sent it, so never crawled.

const SITE = 'https://ai-bos.website';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/admin', '/api/', '/auth/', '/checkout', '/onboarding', '/pay/'],
    }],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
