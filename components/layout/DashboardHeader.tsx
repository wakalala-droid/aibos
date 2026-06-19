'use client';

// DashboardHeader — the top-right action cluster on every dashboard page:
// search, notifications bell (with unread dot + alerts dropdown), and a profile
// chip holding the business identity. Mirrors the promoted design. Works in
// both themes; all controls are keyboard-operable and labelled.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/lib/profile';
import { TIERS } from '@/lib/tiers';

// Searchable destinations (kept in sync with the sidebar nav).
const DESTINATIONS: { href: string; label: string; group: string }[] = [
  { href: '/dashboard', label: 'Overview', group: 'Financial' },
  { href: '/dashboard/cash', label: 'Cash Intelligence', group: 'Financial' },
  { href: '/dashboard/variance', label: 'Variance', group: 'Financial' },
  { href: '/dashboard/forecast', label: 'Forecast', group: 'Financial' },
  { href: '/dashboard/anomaly', label: 'Anomaly Intelligence', group: 'Financial' },
  { href: '/dashboard/breakeven', label: 'Breakeven', group: 'Financial' },
  { href: '/dashboard/brief', label: 'Strategic Brief', group: 'Financial' },
  { href: '/data-studio', label: 'Data Studio', group: 'Financial' },
  { href: '/dashboard/customers', label: 'Customer Intelligence', group: 'Customer' },
  { href: '/dashboard/churn', label: 'Churn Risk', group: 'Customer' },
  { href: '/dashboard/products', label: 'Product Matrix', group: 'Customer' },
  { href: '/dashboard/market', label: 'Market Intelligence', group: 'Customer' },
  { href: '/dashboard/pos', label: 'POS Intelligence', group: 'Operations' },
  { href: '/dashboard/benchmarks', label: 'Benchmarks', group: 'Operations' },
  { href: '/dashboard/ops-brief', label: 'Ops Brief', group: 'Operations' },
  { href: '/pricing', label: 'Plans & Pricing', group: 'Account' },
];

const sevColor = (s?: string) =>
  s === 'critical' ? 'var(--crit)' : s === 'warning' ? 'var(--warn)' : s === 'success' ? 'var(--good)' : 'var(--info)';

function IconButton({
  label, onClick, active, dot, children, refEl,
}: {
  label: string; onClick: () => void; active?: boolean; dot?: boolean;
  children: React.ReactNode; refEl?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={refEl}
      type="button"
      aria-label={label}
      aria-haspopup={label.includes('Search') ? undefined : 'menu'}
      aria-expanded={active}
      onClick={onClick}
      className="dash-iconbtn"
      style={{
        position: 'relative',
        width: 38, height: 38, borderRadius: 10,
        border: `1px solid ${active ? 'var(--border-strong)' : 'var(--border-md)'}`,
        background: active ? 'var(--bg-badge)' : 'var(--bg-card)',
        color: 'var(--text-3)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {children}
      {dot && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute', top: 8, right: 8, width: 7, height: 7,
            borderRadius: '50%', background: 'var(--crit)',
            boxShadow: '0 0 0 2px var(--bg-card)',
          }}
        />
      )}
    </button>
  );
}

export default function DashboardHeader() {
  const router = useRouter();
  const { alerts, posBusinessName, tier } = useStore();
  const { user, logout } = useAuth();
  const { profile, isAdmin } = useProfile();

  const safeAlerts = Array.isArray(alerts) ? alerts : [];
  const unread = safeAlerts.length;

  const [open, setOpen] = useState<null | 'search' | 'bell' | 'profile'>(null);
  const [query, setQuery] = useState('');

  const wrapRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Identity — sourced from the business profile first, then POS name, then the
  // auth metadata, then the email prefix.
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const fullName = (typeof meta.full_name === 'string' && meta.full_name) || (typeof meta.name === 'string' && meta.name) || '';
  const email = user?.email ?? '';
  const businessName =
    profile?.business_name || posBusinessName || fullName || (email ? email.split('@')[0] : 'Your business');
  const metaAvatar = (typeof meta.avatar_url === 'string' && meta.avatar_url) || (typeof meta.picture === 'string' && meta.picture) || '';
  const avatarUrl = profile?.logo_url || metaAvatar;
  const initials = (businessName || 'AB').trim().slice(0, 2).toUpperCase();

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  // Cmd/Ctrl+K opens search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen('search');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open === 'search') setTimeout(() => searchInputRef.current?.focus(), 30);
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DESTINATIONS;
    return DESTINATIONS.filter((d) => d.label.toLowerCase().includes(q) || d.group.toLowerCase().includes(q));
  }, [query]);

  const go = (href: string) => { setOpen(null); setQuery(''); router.push(href); };

  return (
    <div ref={wrapRef} className="dash-header">
      {/* Search */}
      <IconButton label="Search (Ctrl K)" active={open === 'search'} onClick={() => setOpen(open === 'search' ? null : 'search')}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
          <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </IconButton>

      {/* Notifications */}
      <IconButton label={`Notifications, ${unread} alert${unread === 1 ? '' : 's'}`} active={open === 'bell'} dot={unread > 0} onClick={() => setOpen(open === 'bell' ? null : 'bell')}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.7 21a2 2 0 01-3.4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </IconButton>

      {/* Profile chip */}
      <button
        type="button"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open === 'profile'}
        onClick={() => setOpen(open === 'profile' ? null : 'profile')}
        className="dash-profile"
        style={{
          display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
          padding: '5px 8px 5px 12px', borderRadius: 999,
          border: `1px solid ${open === 'profile' ? 'var(--border-strong)' : 'var(--border-md)'}`,
          background: 'var(--bg-card)', maxWidth: 200,
        }}
      >
        <span className="dash-profile-name" style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>
          {businessName}
        </span>
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" width={28} height={28} style={{ borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }} />
        ) : (
          <span style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, var(--e1), var(--cyan))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', fontSize: '0.66rem', fontWeight: 800 }}>
            {initials}
          </span>
        )}
      </button>

      {/* ── Dropdowns / overlays ─────────────────────────────────────────── */}
      <AnimatePresence>
        {open === 'search' && (
          <motion.div
            key="search"
            role="dialog" aria-modal="true" aria-label="Search the dashboard"
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="dash-pop" style={{ width: 'min(380px, 86vw)' }}
          >
            <div style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
              <input
                ref={searchInputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) go(results[0].href); }}
                placeholder="Search pages…"
                aria-label="Search pages"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-md)', background: 'var(--bg-input)', color: 'var(--text-1)', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', outline: 'none' }}
              />
            </div>
            <div role="listbox" aria-label="Search results" style={{ maxHeight: 320, overflowY: 'auto', padding: 6 }}>
              {results.length === 0 ? (
                <p style={{ padding: '14px 12px', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: 'var(--text-3)', margin: 0 }}>No matching pages.</p>
              ) : results.map((r) => (
                <button
                  key={r.href} type="button" role="option" aria-selected={false}
                  onClick={() => go(r.href)}
                  className="dash-row"
                  style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '9px 10px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer' }}
                >
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', color: 'var(--text-1)', fontWeight: 500 }}>{r.label}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.66rem', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{r.group}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {open === 'bell' && (
          <motion.div
            key="bell"
            role="menu" aria-label="Notifications"
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="dash-pop" style={{ width: 'min(360px, 90vw)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-1)' }}>Alerts</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: 'var(--text-4)', background: 'var(--bg-badge)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 999 }}>{unread} total</span>
            </div>
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {unread === 0 ? (
                <p style={{ padding: '20px 16px', fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', color: 'var(--text-3)', margin: 0 }}>
                  You’re all clear — no alerts right now. Upload data and AI-BOS will flag anything that breaks trend.
                </p>
              ) : safeAlerts.slice(0, 12).map((a, i) => {
                const title = String(a.title ?? 'Alert');
                const desc = String(a.description ?? '');
                return (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '12px 16px', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                    <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: sevColor(String(a.severity ?? '')), flexShrink: 0, marginTop: 5 }} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-1)', margin: '0 0 2px' }}>{title}</p>
                      {desc && <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.74rem', color: 'var(--text-3)', margin: 0, lineHeight: 1.45 }}>{desc}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
            <Link href="/dashboard/anomaly" onClick={() => setOpen(null)} style={{ display: 'block', textAlign: 'center', padding: '11px 16px', borderTop: '1px solid var(--border)', fontFamily: 'Inter, sans-serif', fontSize: '0.78rem', fontWeight: 600, color: 'var(--cyan)', textDecoration: 'none' }}>
              View anomaly intelligence →
            </Link>
          </motion.div>
        )}

        {open === 'profile' && (
          <motion.div
            key="profile"
            role="menu" aria-label="Account"
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="dash-pop" style={{ width: 'min(280px, 90vw)' }}
          >
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-1)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{businessName}</p>
              {email && <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.66rem', color: 'var(--text-3)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</p>}
              <span style={{ display: 'inline-block', marginTop: 10, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--cyan)', background: 'var(--cyan-dim)', border: '1px solid color-mix(in srgb, var(--cyan) 30%, transparent)', padding: '3px 8px', borderRadius: 6 }}>
                {TIERS[tier].name} plan
              </span>
            </div>
            <div style={{ padding: 6 }}>
              <Link href="/pricing" role="menuitem" onClick={() => setOpen(null)} className="dash-row" style={{ display: 'block', padding: '10px 12px', borderRadius: 8, fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', color: 'var(--text-2)', textDecoration: 'none' }}>
                {tier === 'growth' ? 'Manage plan' : 'Upgrade plan'}
              </Link>
              <Link href="/dashboard/profile" role="menuitem" onClick={() => setOpen(null)} className="dash-row" style={{ display: 'block', padding: '10px 12px', borderRadius: 8, fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', color: 'var(--text-2)', textDecoration: 'none' }}>
                Your business data
              </Link>
              {isAdmin && (
                <Link href="/admin" role="menuitem" onClick={() => setOpen(null)} className="dash-row" style={{ display: 'block', padding: '10px 12px', borderRadius: 8, fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', color: 'var(--text-2)', textDecoration: 'none' }}>
                  Admin panel
                </Link>
              )}
              <button type="button" role="menuitem" onClick={() => { setOpen(null); logout(); }} className="dash-row" style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', color: 'var(--crit)' }}>
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
