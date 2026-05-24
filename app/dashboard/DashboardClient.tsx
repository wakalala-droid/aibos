'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopNav } from '@/components/layout/TopNav';
import { useStore } from '@/lib/store';

export function DashboardClient({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const collapsed = useStore(s => s.sidebarCollapsed);

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  return (
    <div
      style={{
        display:    'flex',
        height:     '100vh',
        overflow:   'hidden',
        background: '#03060d',
        fontFamily: 'Outfit, sans-serif',
      }}
    >
      {/* ── Animated mesh bg ─────────────────────────────────────── */}
      <div
        aria-hidden="true"
        style={{
          position:   'fixed',
          inset:      0,
          background: 'radial-gradient(ellipse 60% 50% at 15% 30%, rgba(59,130,246,0.05) 0%, transparent 60%), radial-gradient(ellipse 50% 60% at 85% 70%, rgba(6,182,212,0.04) 0%, transparent 60%), #03060d',
          pointerEvents: 'none',
          zIndex:     0,
        }}
      />
      {/* Subtle grid */}
      <div
        aria-hidden="true"
        style={{
          position:   'fixed',
          inset:      0,
          backgroundImage: 'linear-gradient(rgba(99,179,237,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(99,179,237,0.025) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          pointerEvents: 'none',
          zIndex:     0,
        }}
      />

      {/* ── Desktop sidebar ──────────────────────────────────────── */}
      <div className="hidden md:flex" style={{ position: 'relative', zIndex: 10, flexShrink: 0, height: '100vh' }}>
        <Sidebar />
      </div>

      {/* ── Mobile sidebar overlay ───────────────────────────────── */}
      <AnimatePresence>
        {mobileNavOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileNavOpen(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50 }}
            />
            <motion.div
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              style={{ position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 60 }}
            >
              <Sidebar />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Main content area ───────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        {/* Top nav with mobile menu button */}
        <div style={{ position: 'relative' }}>
          <TopNav />
          {/* Mobile hamburger */}
          <button
            className="md:hidden"
            onClick={() => setMobileNavOpen(v => !v)}
            style={{
              position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
              width: 36, height: 36, borderRadius: 8, border: '1px solid rgba(99,179,237,0.15)',
              background: 'transparent', color: '#4a6285', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            aria-label="Open navigation"
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Page content */}
        <main
          style={{
            flex:       1,
            overflowY:  'auto',
            overflowX:  'hidden',
            padding:    '24px',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(99,179,237,0.2) transparent',
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={typeof window !== 'undefined' ? window.location.pathname : 'page'}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
