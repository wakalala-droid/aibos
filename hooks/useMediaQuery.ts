'use client';

import { useEffect, useState } from 'react';

/**
 * SSR-safe media-query hook. Returns false on the server / first paint, then the
 * real match after mount. Used to collapse data tables to stacked cards below md
 * (responsive_design_system.md DATA TABLE RULE).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [query]);

  return matches;
}
