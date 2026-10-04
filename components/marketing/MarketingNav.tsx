'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const LINKS = [
  { href: '/#engines', label: 'The engines' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/trust', label: 'Trust' },
  { href: '/about', label: 'Our story' },
];

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
        // Solid bar with a fixed hairline: a translucent blurred header re-blurs
        // the page on every scroll frame on a phone (UI/UX audit 2026-10 A20).
        position: 'sticky', top: 0, zIndex: 60,
        background: 'var(--bg-page)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <nav
        className="mkt-wrap"
        aria-label="Primary"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68, gap: 16 }}
      >
        {/* Brand */}
        <Link
          href="/"
          style={{ display: 'flex', alignItems: 'center', gap: 9, minHeight: 44, textDecoration: 'none' }}
          aria-label="AIBOS home"
        >
          <Image src="/brand/aibos-mark.png" alt="" aria-hidden width={34} height={34} style={{ width: 34, height: 34, objectFit: 'contain' }} priority />
          <Image src="/brand/aibos-wordmark.png" alt="" aria-hidden width={86} height={23} style={{ width: 86, height: 'auto', objectFit: 'contain' }} priority />
        </Link>

        {/* Desktop links */}
        <div className="mkt-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="tap-link"
              style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-2)', textDecoration: 'none' }}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="mkt-nav-cta" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/login" className="tap-link" style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-2)', textDecoration: 'none' }}>
            Sign in
          </Link>
          <Link href="/login" className="mkt-btn mkt-btn-primary mkt-btn-sm">
            Start free
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          className="mkt-nav-burger"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="mkt-mobile-menu"
          onClick={() => setOpen((v) => !v)}
          style={{
            display: 'none', width: 44, height: 44, borderRadius: 10,
            border: '1px solid var(--border-md)', background: 'var(--bg-card)',
            color: 'var(--text-1)', cursor: 'pointer', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            {open
              ? <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              : <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
          </svg>
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div
          id="mkt-mobile-menu"
          className="mkt-wrap"
          style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 18 }}
        >
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-1)', textDecoration: 'none', padding: '12px 4px', borderBottom: '1px solid var(--border)' }}
            >
              {l.label}
            </Link>
          ))}
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <Link href="/login" onClick={() => setOpen(false)} className="mkt-btn mkt-btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
              Sign in
            </Link>
            <Link href="/login" onClick={() => setOpen(false)} className="mkt-btn mkt-btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
              Start free
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
