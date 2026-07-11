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
import { useAiAssistant } from '@/lib/aiAssistant';
import { TIERS } from '@/lib/tiers';
import CurrencySelector from '@/components/ui/CurrencySelector';

// Bell read-state: the dot shows only for alerts the user hasn't opened the
// tray for. On-device signature — the alert list itself stays server-driven.
const ALERTS_SEEN_KEY = 'aibos-alerts-seen-v1';

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
  const { alerts, posBusinessName, tier, rfm, breakdown } = useStore();
  const { user, logout } = useAuth();
  const { profile, isAdmin } = useProfile();
  const { setOpen: setAssistantOpen, sendMessage } = useAiAssistant();

  const safeAlerts = Array.isArray(alerts) ? alerts : [];
  const unread = safeAlerts.length;

  const [open, setOpen] = useState<null | 'search' | 'bell' | 'profile' | 'shortcuts'>(null);
  const [query, setQuery] = useState('');

  // Alerts the user hasn't seen yet — the dot clears once the tray is opened.
  const alertSig = safeAlerts.map((a) => `${a.id ?? ''}:${a.title}`).join('|');
  const [seenSig, setSeenSig] = useState<string | null>(null);
  useEffect(() => {
    try { setSeenSig(window.localStorage.getItem(ALERTS_SEEN_KEY)); } catch { /* private mode */ }
  }, []);
  const hasNewAlerts = unread > 0 && alertSig !== seenSig;
  const toggleBell = () => {
    setOpen(open === 'bell' ? null : 'bell');
    try { window.localStorage.setItem(ALERTS_SEEN_KEY, alertSig); } catch { /* private mode */ }
    setSeenSig(alertSig);
  };

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

  // Data hits — the search reaches the business itself, not just page names
  // (audit F-07): customers by id, products by name, each routed to its page.
  const dataHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as { href: string; label: string; group: string }[];
    const customers = (Array.isArray(rfm) ? rfm : [])
      .filter((r) => String(r.customer_id).toLowerCase().includes(q))
      .slice(0, 4)
      .map((r) => ({ href: '/dashboard/customers', label: `${r.customer_id} · ${r.segment}`, group: 'Customer' }));
    const products = (Array.isArray(breakdown) ? breakdown : [])
      .filter((b) => String(b.item).toLowerCase().includes(q))
      .slice(0, 4)
      .map((b) => ({ href: '/dashboard/products', label: String(b.item), group: 'Product' }));
    return [...customers, ...products];
  }, [query, rfm, breakdown]);

  const go = (href: string) => { setOpen(null); setQuery(''); router.push(href); };

  // Natural-language queries route straight into the AI CFO — search and the
  // assistant are one front door, not two features.
  const askAibos = () => {
    const q = query.trim();
    if (!q) return;
    setOpen(null);
    setQuery('');
    setAssistantOpen(true);
    sendMessage(q);
  };

  // One flat option list drives keyboard navigation: page results, data hits,
  // then the Ask-AIBOS action whenever a query is typed. Arrow keys move the
  // highlight; Enter activates it (audit #9: palette-grade keyboard support).
  type PaletteOption = { kind: 'nav'; href: string; label: string; group: string } | { kind: 'ask' };
  const options: PaletteOption[] = useMemo(() => {
    const nav = [...results, ...dataHits].map((r) => ({ kind: 'nav' as const, ...r }));
    return query.trim() ? [...nav, { kind: 'ask' as const }] : nav;
  }, [results, dataHits, query]);
  const [activeIdx, setActiveIdx] = useState(0);
  useEffect(() => { setActiveIdx(0); }, [query, open]);
  const activate = (opt: PaletteOption | undefined) => {
    if (!opt) return;
    if (opt.kind === 'nav') go(opt.href);
    else askAibos();
  };
  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, options.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Home' && options.length) { e.preventDefault(); setActiveIdx(0); }
    else if (e.key === 'End' && options.length) { e.preventDefault(); setActiveIdx(options.length - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); activate(options[activeIdx] ?? options[0]); }
  };

  return (
    <div ref={wrapRef} className="dash-header">
      {/* Search — a visible command bar on desktop (audit F-07: for a product
          whose thesis is "ask anything about your business", search is the
          command centre, not the smallest control). Icon-only below lg. */}
      <button
        type="button"
        aria-label="Search or ask AIBOS (Ctrl K)"
        aria-haspopup="dialog"
        aria-expanded={open === 'search'}
        onClick={() => setOpen(open === 'search' ? null : 'search')}
        className="dash-searchbar"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
          <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        <span className="dash-searchbar-hint">Search or ask AIBOS…</span>
        <kbd className="dash-searchbar-kbd">Ctrl K</kbd>
      </button>

      {/* Universal currency format. It manages its own popover; the capture
          handler closes this header's popovers when the user reaches for it
          (it sits inside wrapRef, so the outside-click close doesn't fire). */}
      <div onMouseDownCapture={() => setOpen(null)} style={{ display: 'contents' }}>
        <CurrencySelector />
      </div>

      {/* Notifications */}
      <IconButton label={`Notifications, ${unread} alert${unread === 1 ? '' : 's'}`} active={open === 'bell'} dot={hasNewAlerts} onClick={toggleBell}>
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
        <span className="dash-profile-name" style={{ fontSize: 'var(--fs-data)', fontWeight: 700, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>
          {businessName}
        </span>
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" width={28} height={28} style={{ borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }} />
        ) : (
          <span style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, var(--e1), var(--cyan))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-label)', fontWeight: 800 }}>
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
                onKeyDown={onSearchKey}
                role="combobox"
                aria-expanded="true"
                aria-controls="dash-search-listbox"
                aria-activedescendant={options.length ? `dash-search-opt-${activeIdx}` : undefined}
                placeholder="Search pages, customers, products — or ask a question…"
                aria-label="Search pages, customers and products, or ask AIBOS"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-md)', background: 'var(--bg-input)', color: 'var(--text-1)', fontSize: 'var(--fs-body)', outline: 'none' }}
              />
            </div>
            <div id="dash-search-listbox" role="listbox" aria-label="Search results" style={{ maxHeight: 320, overflowY: 'auto', padding: 6 }}>
              {options.map((opt, i) => {
                const active = i === activeIdx;
                const base: React.CSSProperties = {
                  width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: active ? 'var(--table-row-hover)' : 'transparent',
                  outline: active ? '1px solid var(--border-md)' : 'none',
                };
                if (opt.kind === 'nav') {
                  return (
                    <button
                      key={`nav-${opt.href}-${opt.label}`} id={`dash-search-opt-${i}`}
                      type="button" role="option" aria-selected={active}
                      onClick={() => go(opt.href)}
                      onMouseEnter={() => setActiveIdx(i)}
                      className="dash-row"
                      style={{ ...base, justifyContent: 'space-between' }}
                    >
                      <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-1)', fontWeight: 500 }}>{opt.label}</span>
                      <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{opt.group}</span>
                    </button>
                  );
                }
                // Anything can be asked — the assistant is the search's fallback
                // AND a first-class result whenever a query is typed.
                return (
                  <button
                    key="ask" id={`dash-search-opt-${i}`}
                    type="button" role="option" aria-selected={active}
                    onClick={askAibos}
                    onMouseEnter={() => setActiveIdx(i)}
                    className="dash-row"
                    style={{ ...base, gap: 10, padding: '10px 10px', borderTop: '1px solid var(--border)', marginTop: 4 }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ color: 'var(--cyan)', flexShrink: 0 }}>
                      <path d="M12 3l1.6 4.6L18 9.2l-4.4 1.6L12 15l-1.6-4.2L6 9.2l4.4-1.6L12 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                      <path d="M19 14l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                    </svg>
                    <span style={{ fontSize: 'var(--fs-body)', color: 'var(--cyan)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Ask AIBOS: “{query.trim()}”
                    </span>
                  </button>
                );
              })}
              {options.length === 0 && (
                <p style={{ padding: '14px 12px', fontSize: 'var(--fs-data)', color: 'var(--text-3)', margin: 0 }}>Type to search your business.</p>
              )}
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
              <span style={{ fontSize: 'var(--fs-body)', fontWeight: 800, color: 'var(--text-1)' }}>Alerts</span>
              <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', background: 'var(--bg-badge)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 999 }}>{unread} total</span>
            </div>
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {unread === 0 ? (
                <p style={{ padding: '20px 16px', fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: 0 }}>
                  You’re all clear — no alerts right now. Upload data and AI-BOS will flag anything that breaks trend.
                </p>
              ) : safeAlerts.slice(0, 12).map((a, i) => {
                const title = String(a.title ?? 'Alert');
                const desc = String(a.description ?? '');
                // Severity is encoded in colour AND text (audit #34 — never
                // colour alone), so it survives colour-blindness and grayscale.
                const sev = String(a.severity ?? '').toLowerCase();
                const sevWord = sev === 'critical' ? 'Critical' : sev === 'warning' ? 'Warning' : sev === 'success' ? 'Good' : 'Info';
                const sc = sevColor(sev);
                return (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '12px 16px', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                    <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: sc, flexShrink: 0, marginTop: 5 }} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-1)', margin: '0 0 2px' }}>
                        {title}
                        <span style={{ marginLeft: 8, fontSize: 'var(--fs-label)', fontWeight: 700, color: sc, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {sevWord}
                        </span>
                      </p>
                      {desc && <p style={{ fontSize: 'var(--fs-data)', color: 'var(--text-3)', margin: 0, lineHeight: 1.45 }}>{desc}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
            <Link href="/dashboard/anomaly" onClick={() => setOpen(null)} style={{ display: 'block', textAlign: 'center', padding: '11px 16px', borderTop: '1px solid var(--border)', fontSize: 'var(--fs-data)', fontWeight: 600, color: 'var(--cyan)', textDecoration: 'none' }}>
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
              <p style={{ fontSize: 'var(--fs-body)', fontWeight: 800, color: 'var(--text-1)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{businessName}</p>
              {email && <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</p>}
              <span style={{ display: 'inline-block', marginTop: 10, fontSize: 'var(--fs-label)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--cyan)', background: 'var(--cyan-dim)', border: '1px solid color-mix(in srgb, var(--cyan) 30%, transparent)', padding: '3px 8px', borderRadius: 6 }}>
                {TIERS[tier].name} plan
              </span>
            </div>
            <div style={{ padding: 6 }}>
              <Link href="/pricing" role="menuitem" onClick={() => setOpen(null)} className="dash-row" style={{ display: 'block', padding: '10px 12px', borderRadius: 8, fontSize: 'var(--fs-body)', color: 'var(--text-2)', textDecoration: 'none' }}>
                {tier === 'growth' ? 'Manage plan' : 'Upgrade plan'}
              </Link>
              <Link href="/dashboard/profile" role="menuitem" onClick={() => setOpen(null)} className="dash-row" style={{ display: 'block', padding: '10px 12px', borderRadius: 8, fontSize: 'var(--fs-body)', color: 'var(--text-2)', textDecoration: 'none' }}>
                Your business data
              </Link>
              <button type="button" role="menuitem" onClick={() => setOpen('shortcuts')} className="dash-row" style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 'var(--fs-body)', color: 'var(--text-2)' }}>
                Keyboard shortcuts &amp; tips
              </button>
              {isAdmin && (
                <Link href="/admin" role="menuitem" onClick={() => setOpen(null)} className="dash-row" style={{ display: 'block', padding: '10px 12px', borderRadius: 8, fontSize: 'var(--fs-body)', color: 'var(--text-2)', textDecoration: 'none' }}>
                  Admin panel
                </Link>
              )}
              <button type="button" role="menuitem" onClick={() => { setOpen(null); logout(); }} className="dash-row" style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 'var(--fs-body)', color: 'var(--crit)' }}>
                Sign out
              </button>
            </div>
          </motion.div>
        )}

        {open === 'shortcuts' && (
          <motion.div
            key="shortcuts"
            role="dialog" aria-label="Keyboard shortcuts and tips"
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="dash-pop" style={{ width: 'min(340px, 90vw)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 'var(--fs-body)', fontWeight: 800, color: 'var(--text-1)' }}>Shortcuts &amp; tips</span>
              <button type="button" onClick={() => setOpen(null)} aria-label="Close"
                style={{ border: 'none', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer', fontSize: 'var(--fs-body)' }}>
                ✕
              </button>
            </div>
            <div style={{ padding: '10px 16px 14px' }}>
              {[
                ['Ctrl K', 'Search anything, or ask AIBOS a question'],
                ['↑ ↓ + Enter', 'Move through search results and open one'],
                ['Esc', 'Close any panel, menu or the assistant'],
                ['Shift + Enter', 'New line in the AI CFO chat'],
                ['Hold a card', 'Long-press any metric and AIBOS explains it'],
              ].map(([key, tip]) => (
                <div key={key} style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '7px 0' }}>
                  <kbd style={{ flexShrink: 0, minWidth: 92, textAlign: 'center', fontSize: 'var(--fs-label)', color: 'var(--text-2)', background: 'var(--bg-badge)', border: '1px solid var(--border-md)', borderRadius: 5, padding: '2px 8px', fontFamily: 'inherit' }}>{key}</kbd>
                  <span style={{ fontSize: 'var(--fs-data)', color: 'var(--text-3)', lineHeight: 1.5 }}>{tip}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
