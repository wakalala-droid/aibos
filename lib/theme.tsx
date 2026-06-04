'use client';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type Theme = 'dark' | 'light';

interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
  isDark: boolean;
}

const Ctx = createContext<ThemeCtx>({ theme: 'dark', toggle: () => {}, isDark: true });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem('aibos-theme') as Theme) ?? 'dark';
    setTheme(stored);
    document.documentElement.setAttribute('data-theme', stored);
    setMounted(true);
  }, []);

  const toggle = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('aibos-theme', next);
  }, [theme]);

  if (!mounted) return <div style={{ visibility: 'hidden' }}>{children}</div>;

  return (
    <Ctx.Provider value={{ theme, toggle, isDark: theme === 'dark' }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTheme = () => useContext(Ctx);

export const FOUC_SCRIPT = `(function(){try{var t=localStorage.getItem('aibos-theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;
