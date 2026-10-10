'use client';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { isMarketingRoute } from './routes';

export type Theme = 'dark' | 'light';

// Light is the default since the redesign pilot (4 October 2026: "a new vision,
// light and snappy"). The choice moved to a new key so everybody starts on the
// new light look once; anyone who then picks dark keeps dark.
const KEY = 'aibos-theme-v2';
const DEFAULT: Theme = 'light';

interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
  isDark: boolean;
}

const Ctx = createContext<ThemeCtx>({ theme: DEFAULT, toggle: () => {}, isDark: false });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(DEFAULT);
  const [mounted, setMounted] = useState(false);
  // The website brings its own fixed colours (app/(marketing)/layout.tsx), so
  // nothing there can flash the wrong theme: it shows the moment the page
  // arrives instead of waiting seconds on a phone for the scripts (10 Oct 2026).
  const website = isMarketingRoute(usePathname() || '');

  useEffect(() => {
    const saved = localStorage.getItem(KEY);
    const stored: Theme = saved === 'dark' || saved === 'light' ? saved : DEFAULT;
    setTheme(stored);
    document.documentElement.setAttribute('data-theme', stored);
    setMounted(true);
  }, []);

  const toggle = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(KEY, next);
  }, [theme]);

  if (!mounted && !website) return <div style={{ visibility: 'hidden' }}>{children}</div>;

  return (
    <Ctx.Provider value={{ theme, toggle, isDark: theme === 'dark' }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTheme = () => useContext(Ctx);

export const FOUC_SCRIPT = `(function(){try{var t=localStorage.getItem('${KEY}');if(t!=='dark'&&t!=='light')t='${DEFAULT}';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;
