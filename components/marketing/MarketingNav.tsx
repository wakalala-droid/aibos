'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';

const LINKS = [
  { href: '/#features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/trust', label: 'Trust' },
  { href: '/about', label: 'Our story' },
];

const LINK_STYLE: React.CSSProperties = { fontSize: 'var(--fs-body)', fontWeight: 500, color: 'var(--text-2)', textDecoration: 'none' };

export default function MarketingNav() {
  const [open, setOpen] = useState(false);

  // Close the mobile menu on resize to desktop.
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 880) setOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <header
      style={{
        // Solid bar with a fixed hairline: no blurred sticky headers (UI kit,
        // and UI/UX audit 2026-10 A20: a blurred bar re-blurs on every scroll).
        position: 'sticky', top: 0, zIndex: 60,
        background: 'var(--bg-page)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <nav
        className="mkt-wrap"
        aria-label="Primary"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64, gap: 16 }}
      >
        <Link
          href="/"
          style={{ display: 'flex', alignItems: 'center', gap: 9, minHeight: 44, textDecoration: 'none' }}
          aria-label="AIBOS home"
        >
          <Image src="/brand/aibos-mark.png" alt="" aria-hidden width={30} height={30} style={{ width: 30, height: 30, objectFit: 'contain' }} priority />
          <Image src="/brand/aibos-wordmark.png" alt="" aria-hidden width={78} height={20} style={{ width: 78, height: 'auto', objectFit: 'contain' }} priority />
        </Link>

        <div className="mkt-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="tap-link" style={LINK_STYLE}>
              {l.label}
            </Link>
          ))}
        </div>

        <div className="mkt-nav-cta" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link href="/login" className="pill pill-quiet">Sign in</Link>
          <Link href="/login" className="pill pill-primary">Start free</Link>
        </div>

        <button
          type="button"
          className="icon-pill mkt-nav-burger"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="mkt-mobile-menu"
          onClick={() => setOpen((v) => !v)}
          style={{ display: 'none' }}
        >
          {open ? <X aria-hidden /> : <Menu aria-hidden />}
        </button>
      </nav>

      {open && (
        <div
          id="mkt-mobile-menu"
          className="mkt-wrap"
          style={{ display: 'flex', flexDirection: 'column', paddingBottom: 16 }}
        >
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              style={{ ...LINK_STYLE, color: 'var(--text-1)', padding: '12px 4px', minHeight: 44, borderBottom: '1px solid var(--border)' }}
            >
              {l.label}
            </Link>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <Link href="/login" onClick={() => setOpen(false)} className="pill pill-quiet" style={{ flex: 1 }}>
              Sign in
            </Link>
            <Link href="/login" onClick={() => setOpen(false)} className="pill pill-primary" style={{ flex: 1 }}>
              Start free
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
