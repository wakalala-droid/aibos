'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { useAuth } from '@/hooks/useAuth';

// ─── Icons ────────────────────────────────────────────────────────────────────

const BellIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 01-3.46 0"/>
  </svg>
);
const SearchIcon = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const LogOutIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
    <polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);
const UserIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);
const SettingsIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
  </svg>
);

// ─── Route → Title map ────────────────────────────────────────────────────────

const TITLES: Record<string, { title: string; subtitle: string }> = {
  '/dashboard':           { title: 'Overview',        subtitle: 'Financial performance at a glance' },
  '/dashboard/cash':      { title: 'Cash Intelligence', subtitle: 'Runway, burn rate & projections' },
  '/dashboard/variance':  { title: 'Variance Analysis', subtitle: 'Budget vs actuals deep-dive' },
  '/dashboard/forecast':  { title: 'Forecast Engine',   subtitle: 'AI-powered revenue prediction' },
  '/dashboard/anomaly':   { title: 'Anomaly Detection', subtitle: 'Statistical outlier intelligence' },
  '/dashboard/breakeven': { title: 'Breakeven Analysis','subtitle': 'Contribution margin & breakeven point' },
  '/dashboard/brief':     { title: 'Strategic Brief',   subtitle: 'Executive summary & AI insights' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function TopNav() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const alerts = useStore(s => s.alerts);
  const uploadedFile = useStore(s => s.uploadedFile);

  const [searchOpen, setSearchOpen]   = useState(false);
  const [notifOpen, setNotifOpen]     = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchVal, setSearchVal]     = useState('');

  const notifRef   = useRef<HTMLDivElement>(null);
  const userRef    = useRef<HTMLDivElement>(null);

  const meta = TITLES[pathname] ?? { title: 'Dashboard', subtitle: '' };
  const criticalCount = alerts.filter(a => a.severity === 'critical' || a.severity === 'high').length;

  // Close dropdowns on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const avatarUrl = user?.user_metadata?.avatar_url;
  const userName  = user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'User';
  const userEmail = user?.email ?? '';

  const severityColour: Record<string, string> = {
    critical: '#ef4444', high: '#f59e0b', medium: '#60a5fa', low: '#10b981', info: '#06b6d4',
  };

  return (
    <header style={{
      height: 64, background: 'rgba(9,13,30,0.95)', backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(99,179,237,0.1)', display: 'flex', alignItems: 'center',
      padding: '0 24px', gap: 16, position: 'sticky', top: 0, zIndex: 30, flexShrink: 0,
    }}>

      {/* ── Title block ─────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2 }}
          >
            <h1 style={{ fontSize: '1rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', lineHeight: 1.2, margin: 0 }}>
              {meta.title}
            </h1>
            <p style={{ fontSize: '0.68rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: 0, marginTop: 1 }}>
              {uploadedFile ? `${uploadedFile} · ` : ''}{meta.subtitle}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Search ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {searchOpen ? (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 220, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(99,179,237,0.06)', border: '1px solid rgba(99,179,237,0.18)', borderRadius: 8, padding: '0 10px', height: 36 }}>
              <SearchIcon />
              <input
                autoFocus
                value={searchVal}
                onChange={e => setSearchVal(e.target.value)}
                onBlur={() => { setSearchOpen(false); setSearchVal(''); }}
                placeholder="Search insights…"
                style={{ background: 'none', border: 'none', outline: 'none', color: '#e2eeff', fontSize: '0.82rem', fontFamily: 'Outfit, sans-serif', width: '100%' }}
              />
            </div>
          </motion.div>
        ) : (
          <motion.button
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            onClick={() => setSearchOpen(true)}
            style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid rgba(99,179,237,0.12)', background: 'transparent', color: '#4a6285', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color .18s, background .18s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#d4ddf0'; (e.currentTarget as HTMLElement).style.background = 'rgba(99,179,237,0.06)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#4a6285'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            aria-label="Search"
          >
            <SearchIcon />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Notifications ────────────────────────────────────────── */}
      <div ref={notifRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setNotifOpen(v => !v)}
          style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid rgba(99,179,237,0.12)', background: 'transparent', color: '#4a6285', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', transition: 'color .18s, background .18s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#d4ddf0'; (e.currentTarget as HTMLElement).style.background = 'rgba(99,179,237,0.06)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#4a6285'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          aria-label="Notifications"
        >
          <BellIcon />
          {criticalCount > 0 && (
            <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: '#ef4444', border: '1.5px solid #090d1e', animation: 'pulse 2s ease-in-out infinite' }} />
          )}
        </button>

        <AnimatePresence>
          {notifOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              style={{ position: 'absolute', top: 44, right: 0, width: 320, background: '#090d1e', border: '1px solid rgba(99,179,237,0.18)', borderRadius: 14, boxShadow: '0 24px 60px rgba(0,0,0,0.6)', overflow: 'hidden', zIndex: 50 }}
            >
              <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid rgba(99,179,237,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif' }}>Alerts</span>
                <span style={{ fontSize: '0.6rem', fontFamily: 'DM Mono, monospace', color: '#4a6285', background: 'rgba(99,179,237,0.1)', padding: '2px 8px', borderRadius: 999 }}>{alerts.length} total</span>
              </div>
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {alerts.map(a => (
                  <div key={a.id} style={{ padding: '11px 16px', borderBottom: '1px solid rgba(99,179,237,0.06)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: severityColour[a.severity], flexShrink: 0, marginTop: 4, boxShadow: `0 0 6px ${severityColour[a.severity]}80` }} />
                    <div>
                      <p style={{ fontSize: '0.78rem', fontWeight: 500, color: '#d4ddf0', fontFamily: 'Outfit, sans-serif', margin: 0, marginBottom: 2 }}>{a.title}</p>
                      <p style={{ fontSize: '0.68rem', color: '#4a6285', fontFamily: 'Outfit, sans-serif', margin: 0, lineHeight: 1.4 }}>{a.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── User menu ────────────────────────────────────────────── */}
      <div ref={userRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setUserMenuOpen(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 4px 4px 10px', borderRadius: 999, border: '1px solid rgba(99,179,237,0.12)', background: 'transparent', cursor: 'pointer', transition: 'background .18s' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(99,179,237,0.06)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          aria-label="User menu"
        >
          <span style={{ fontSize: '0.78rem', color: '#d4ddf0', fontFamily: 'Outfit, sans-serif', fontWeight: 500, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</span>
          {avatarUrl ? (
            <img src={avatarUrl} alt={userName} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(96,165,250,0.4)' }} />
          ) : (
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#60a5fa,#06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#03060d', fontFamily: 'Outfit, sans-serif', border: '1.5px solid rgba(96,165,250,0.4)' }}>
              {userName[0]?.toUpperCase()}
            </div>
          )}
        </button>

        <AnimatePresence>
          {userMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              style={{ position: 'absolute', top: 44, right: 0, width: 220, background: '#090d1e', border: '1px solid rgba(99,179,237,0.18)', borderRadius: 14, boxShadow: '0 24px 60px rgba(0,0,0,0.6)', overflow: 'hidden', zIndex: 50 }}
            >
              <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(99,179,237,0.08)' }}>
                <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: 0 }}>{userName}</p>
                <p style={{ fontSize: '0.68rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: 0, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</p>
              </div>
              {[
                { icon: <UserIcon />, label: 'Profile' },
                { icon: <SettingsIcon />, label: 'Settings' },
              ].map(item => (
                <button key={item.label} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', color: '#4a6285', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.82rem', fontFamily: 'Outfit, sans-serif', textAlign: 'left', transition: 'color .15s, background .15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#d4ddf0'; (e.currentTarget as HTMLElement).style.background = 'rgba(99,179,237,0.06)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#4a6285'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  {item.icon}{item.label}
                </button>
              ))}
              <div style={{ borderTop: '1px solid rgba(99,179,237,0.08)' }}>
                <button onClick={logout} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', color: '#ef4444', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.82rem', fontFamily: 'Outfit, sans-serif', textAlign: 'left', transition: 'background .15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <LogOutIcon /> Sign out
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
