'use client';

// components/chat/RichText.tsx
// The assistant's answers as the owner should read them. The AI writes a
// little Markdown: **bold**, bullets ("* " or "- "), numbered lines, headings
// ("## ") and links ("[Upgrade to Pro+](/checkout?plan=proplus)"). Shown raw,
// that was a wall of asterisks and brackets, and the upgrade link could not be
// pressed. Shared by the floating assistant and the dashboard's AI CFO panel so
// the two can never render the same answer differently.

import Link from 'next/link';
import type { ReactNode } from 'react';

const INLINE = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\)|\*[^*\s][^*]*\*)/g;

function safeHref(href: string): string | null {
  if (href.startsWith('/') && !href.startsWith('//')) return href;
  if (/^https:\/\//i.test(href)) return href;
  return null;
}

function inline(text: string, key: string): ReactNode[] {
  return text.split(INLINE).filter((p) => p !== '').map((p, j) => {
    const k = `${key}-${j}`;
    if (p.startsWith('**') && p.endsWith('**') && p.length > 4) {
      return <strong key={k} style={{ fontWeight: 700, color: 'var(--text-1)' }}>{p.slice(2, -2)}</strong>;
    }
    const link = p.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (link) {
      const href = safeHref(link[2]);
      if (!href) return <span key={k}>{link[1]}</span>;
      const style = { color: 'var(--cyan)', fontWeight: 600, textDecoration: 'underline' } as const;
      return href.startsWith('/')
        ? <Link key={k} href={href} style={style}>{link[1]}</Link>
        : <a key={k} href={href} target="_blank" rel="noopener noreferrer" style={style}>{link[1]}</a>;
    }
    if (p.length > 2 && p.startsWith('*') && p.endsWith('*')) {
      return <em key={k}>{p.slice(1, -1)}</em>;
    }
    return <span key={k}>{p}</span>;
  });
}

export default function RichText({ text, color = 'var(--text-2)' }: { text: string; color?: string }) {
  return (
    <>
      {text.split('\n').map((raw, i) => {
        const line = raw.replace(/\s+$/, '');
        if (line.trim() === '') return <div key={i} style={{ height: 6 }} />;

        const heading = line.match(/^\s*#{1,6}\s+(.*)$/);
        if (heading) {
          return (
            <p key={i} style={{ margin: '6px 0 2px', lineHeight: 1.5, fontWeight: 700, color: 'var(--text-1)' }}>
              {inline(heading[1].replace(/\*\*/g, ''), `h${i}`)}
            </p>
          );
        }

        const bullet = line.match(/^(\s*)(?:[*\-•])\s+(.*)$/);
        if (bullet) {
          const indent = Math.min(bullet[1].length, 8) * 4;
          return (
            <div key={i} style={{ display: 'flex', gap: 8, margin: '0 0 3px', paddingLeft: indent, lineHeight: 1.55, color }}>
              <span aria-hidden="true" style={{ flexShrink: 0 }}>•</span>
              <span>{inline(bullet[2], `b${i}`)}</span>
            </div>
          );
        }

        const numbered = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
        if (numbered) {
          return (
            <div key={i} style={{ display: 'flex', gap: 8, margin: '0 0 3px', lineHeight: 1.55, color }}>
              <span style={{ flexShrink: 0, fontWeight: 600 }}>{numbered[1]}.</span>
              <span>{inline(numbered[2], `n${i}`)}</span>
            </div>
          );
        }

        return (
          <p key={i} style={{ margin: '0 0 2px', lineHeight: 1.55, color }}>
            {inline(line, `p${i}`)}
          </p>
        );
      })}
    </>
  );
}
