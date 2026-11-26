import type { MetadataRoute } from 'next';

// /sitemap.xml: the public pages of the website, for search engines (robots.ts
// points to it). Add a page here when the website gets a new one.

const SITE = 'https://ai-bos.website';

const PAGES: { path: string; priority: number; changeFrequency: 'weekly' | 'monthly' }[] = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/pricing', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/about', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/trust', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/download', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'monthly' },
  { path: '/terms', priority: 0.3, changeFrequency: 'monthly' },
  { path: '/refunds', priority: 0.3, changeFrequency: 'monthly' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE}${path}`,
    changeFrequency,
    priority,
  }));
}
