'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Sun icon
// ---------------------------------------------------------------------------
function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Moon icon
// ---------------------------------------------------------------------------
function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z"
        stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Toggle
// ---------------------------------------------------------------------------

interface ThemeToggleProps {
  /** 'icon' = just the icon button (sidebar use), 'pill' = icon + label */
  variant?: 'icon' | 'pill';
}

export default function ThemeToggle({ variant = 'icon' }: ThemeToggleProps) {
  const { theme, toggleTheme, isDark } = useTheme();

  if (variant === 'pill') {
    return (
      <motion.button
        onClick={toggleTheme}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.96 }}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 14px',
          borderRadius: 10,
          border: '1px solid var(--border-medium)',
          background: 'var(--bg-surface-2)',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          transition: 'all 0.2s ease',
        }}
      >
        {/* Track */}
        <div style={{
          position: 'relative',
          width: 36,
          height: 20,
          borderRadius: 10,
          background: isDark
            ? 'rgba(0, 212, 255, 0.15)'
            : 'rgba(15, 23, 42, 0.12)',
          border: `1px solid ${isDark ? 'rgba(0,212,255,0.25)' : 'rgba(15,23,42,0.20)'}`,
          transition: 'all 0.25s ease',
          flexShrink: 0,
        }}>
          <motion.div
            animate={{ x: isDark ? 2 : 18 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            style={{
              position: 'absolute',
              top: 2,
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: isDark
                ? 'linear-gradient(135deg, #0097b2, #00d4ff)'
                : 'linear-gradient(135deg, #f59e0b, #fbbf24)',
              boxShadow: isDark
                ? '0 0 8px rgba(0,212,255,0.5)'
                : '0 0 8px rgba(251,191,36,0.5)',
            }}
          />
        </div>

        <span style={{
          fontFamily: 'DM Mono, monospace',
          fontSize: '0.7rem',
          letterSpacing: '0.04em',
          color: 'var(--text-muted)',
          minWidth: 36,
        }}>
          {isDark ? 'Dark' : 'Light'}
        </span>
      </motion.button>
    );
  }

  // Icon-only (sidebar bottom)
  return (
    <motion.button
      onClick={toggleTheme}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        width: 32,
        height: 32,
        borderRadius: 9,
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)',
        transition: 'all 0.2s ease',
        flexShrink: 0,
      }}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={theme}
          initial={{ opacity: 0, rotate: -30, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 30, scale: 0.6 }}
          transition={{ duration: 0.18 }}
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
