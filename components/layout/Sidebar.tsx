'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';

// ─── Icons (defined FIRST so NAV_ITEMS can reference them) ────────

function GridIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/>
      <rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/>
      <rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  );
}

function WaveIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="2,12 6,6 10,14 14,8 18,16 22,12"/>
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
}

function TrendIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/>
      <polyline points="17,6 23,6 23,12"/>
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      <line x1="11" y1="8" x2="11" y2="14"/>
      <line x1="8" y1="11" x2="14" y2="11"/>
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="6"/>
      <circle cx="12" cy="12" r="2"/>
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <line x1="10" y1="9" x2="8" y2="9"/>
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15,18 9,12 15,6"/>
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
      <polyline points="17,8 12,3 7,8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
}

function BotIcon() {
  return (
    <svg width={8} height={8} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2"/>
      <path d="M12 11V6"/>
      <circle cx="12" cy="4" r="2"/>
    </svg>
  );
}

function LogoMark() {
  return (
    <svg width={28} height={28} viewBox="0 0 48 48" fill="none">
      <defs>
        <linearGradient id="slg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#60a5fa"/>
          <stop offset="100%" stopColor="#06b6d4"/>
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="22" stroke="url(#slg)" strokeWidth="1.5" opacity="0.35"/>
      <path d="M24 8 L37.5 15.5 L37.5 30.5 L24 38 L10.5 30.5 L10.5 15.5 Z" stroke="url(#slg)" strokeWidth="1.5" fill="rgba(96,165,250,0.06)"/>
      <circle cx="24" cy="24" r="3" fill="url(#slg)"/>
      <circle cx="16" cy="18" r="2" fill="url(#slg)" opacity="0.7"/>
      <circle cx="32" cy="18" r="2" fill="url(#slg)" opacity="0.7"/>
      <circle cx="16" cy="30" r="2" fill="url(#slg)" opacity="0.7"/>
      <circle cx="32" cy="30" r="2" fill="url(#slg)" opacity="0.7"/>
      <line x1="24" y1="24" x2="16" y2="18" stroke="url(#slg)" strokeWidth="1" opacity="0.45"/>
      <line x1="24" y1="24" x2="32" y2="18" stroke="url(#slg)" strokeWidth="1" opacity="0.45"/>
      <line x1="24" y1="24" x2="16" y2="30" stroke="url(#slg)" strokeWidth="1" opacity="0.45"/>
      <line x1="24" y1="24" x2="32" y2="30" stroke="url(#slg)" strokeWidth="1" opacity="0.45"/>
    </svg>
  );
}

// ─── Nav items (defined AFTER icons) ──────────────────────────────

const NAV_ITEMS = [
  { href: '/dashboard',           Icon: GridIcon,     label: 'Overview'        },
  { href: '/dashboard/cash',      Icon: WaveIcon,     label: 'Cash Intel'      },
  { href: '/dashboard/variance',  Icon: AlertIcon,    label: 'Variance'        },
  { href: '/dashboard/forecast',  Icon: TrendIcon,    label: 'Forecast'        },
  { href: '/dashboard/anomaly',   Icon: ScanIcon,     label: 'Anomaly Intel'   },
  { href: '/dashboard/breakeven', Icon: TargetIcon,   label: 'Breakeven'       },
  { href: '/dashboard/brief',     Icon: DocumentIcon, label: 'Strategic Brief' },
];

// ─── Sidebar ───────────────────────────────────────────────────────

export function Sidebar() {
  const pathname     = usePathname();
  const collapsed    = useStore((s) => s.sidebarCollapsed);
  const toggle       = useStore((s) => s.toggleSidebar);
  const uploadedFile = useStore((s) => s.uploadedFile);

  const sidebarWidth = collapsed ? 64 : 280;

  return (
    <aside
      style={{
        width:       sidebarWidth,
        minWidth:    sidebarWidth,
        height:      '100%',
        display:     'flex',
        flexDirection: 'column',
        flexShrink:  0,
        overflow:    'hidden',
        background:  '#090d1e',
        borderRight: '1px solid rgba(99,179,237,0.1)',
        boxShadow:   '1px 0 0 rgba(99,179,237,0.06)',
        zIndex:      40,
        transition:  'width 0.3s ease, min-width 0.3s ease',
      }}
    >
      {/* Logo */}
      <div style={{
        height:       64,
        display:      'flex',
        alignItems:   'center',
        gap:          12,
        padding:      collapsed ? '0 18px' : '0 20px',
        borderBottom: '1px solid rgba(99,179,237,0.08)',
        flexShrink:   0,
      }}>
        <div style={{ flexShrink: 0 }}>
          <LogoMark />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
              style={{
                fontFamily:    'Outfit, sans-serif',
                fontWeight:    800,
                fontSize:      '1.125rem',
                letterSpacing: '-0.03em',
                whiteSpace:    'nowrap',
                background:    'linear-gradient(90deg, #60a5fa, #06b6d4)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              AI-BOS
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '12px 0' }}>
        {NAV_ITEMS.map(({ href, Icon, label }, i) => {
          const isActive = pathname === href;
          return (
            <motion.div
              key={href}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
            >
              <Link
                href={href}
                title={collapsed ? label : undefined}
                style={{
                  display:        'flex',
                  alignItems:     'center',
                  gap:            12,
                  padding:        collapsed ? '10px 18px' : '10px 16px',
                  margin:         '1px 8px',
                  borderRadius:   10,
                  position:       'relative',
                  color:          isActive ? '#e2eeff' : '#4a6285',
                  background:     isActive ? 'rgba(59,130,246,0.12)' : 'transparent',
                  textDecoration: 'none',
                  overflow:       'hidden',
                  whiteSpace:     'nowrap',
                  transition:     'color 0.18s, background 0.18s',
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-pill"
                    style={{
                      position:     'absolute',
                      left:         0,
                      top:          4,
                      bottom:       4,
                      width:        3,
                      borderRadius: 2,
                      background:   'linear-gradient(180deg,#60a5fa,#06b6d4)',
                    }}
                  />
                )}
                <span style={{ color: isActive ? '#60a5fa' : 'inherit', flexShrink: 0 }}>
                  <Icon />
                </span>
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      style={{
                        fontSize:   '0.875rem',
                        fontWeight: isActive ? 500 : 400,
                        fontFamily: 'Outfit, sans-serif',
                      }}
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            </motion.div>
          );
        })}

        {/* Divider */}
        <div style={{ margin: '12px 16px', height: 1, background: 'rgba(99,179,237,0.08)' }} />

        {/* Upload status */}
        {!collapsed && (
          <div style={{ padding: '4px 16px 8px' }}>
            <p style={{ fontSize: '0.6rem', fontFamily: 'DM Mono, monospace', color: '#2d4a70', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              Data Source
            </p>
            <div style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(99,179,237,0.12)', background: 'rgba(9,13,30,0.6)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: uploadedFile ? '#10b981' : '#4a6285', flexShrink: 0 }}>
                <UploadIcon />
              </span>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: '0.72rem', color: uploadedFile ? '#e2eeff' : '#4a6285', fontFamily: 'Outfit, sans-serif', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                  {uploadedFile ?? 'No file loaded'}
                </p>
                <p style={{ fontSize: '0.6rem', color: '#2d4a70', fontFamily: 'DM Mono, monospace', margin: 0 }}>
                  {uploadedFile ? 'Active' : 'Drop CSV or Excel'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* AI CFO preview */}
        {!collapsed && (
          <div style={{ padding: '0 16px 8px' }}>
            <p style={{ fontSize: '0.6rem', fontFamily: 'DM Mono, monospace', color: '#2d4a70', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              AI CFO
            </p>
            <div style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(99,179,237,0.12)', background: 'rgba(9,13,30,0.6)' }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'linear-gradient(135deg,#60a5fa,#06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <BotIcon />
                </div>
                <p style={{ fontSize: '0.65rem', color: '#d4ddf0', fontFamily: 'Outfit, sans-serif', lineHeight: 1.4, margin: 0 }}>
                  Revenue grew 18.4% YoY. Q4 is the strongest quarter on record.
                </p>
              </div>
              <Link href="/dashboard" style={{ display: 'block', marginTop: 8, fontSize: '0.65rem', fontFamily: 'DM Mono, monospace', color: '#60a5fa', textDecoration: 'none', borderTop: '1px solid rgba(99,179,237,0.1)', paddingTop: 6 }}>
                Ask your CFO
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Collapse toggle */}
      <div style={{ padding: '12px 8px', borderTop: '1px solid rgba(99,179,237,0.08)', flexShrink: 0 }}>
        <button
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{ width: '100%', height: 36, borderRadius: 8, border: '1px solid rgba(99,179,237,0.12)', background: 'transparent', color: '#4a6285', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-end', padding: '0 12px', transition: 'color 0.18s, background 0.18s' }}
        >
          <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.3 }}>
            <ChevronLeftIcon />
          </motion.div>
        </button>
      </div>
    </aside>
  );
}
