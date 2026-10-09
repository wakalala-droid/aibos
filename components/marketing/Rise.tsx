'use client';

/**
 * Website motion (docs/AIBOS_UI_KIT.md, "Website motion"): a block rises into
 * place the first time it scrolls into view, in the kit's own timing: 12px
 * over 200ms, like a notice arriving (update-in).
 *
 *   - Anything already on screen when the page opens is simply shown, so
 *     nothing flashes or waits.
 *   - Without JavaScript, or with reduced motion, everything is just there.
 *   - mode "self" moves the block; "stagger" moves its children one after
 *     another (a bento grid); "seq" leaves the choreography to the section's
 *     own CSS (the chat, the morning brief).
 */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export type RiseState = 'idle' | 'shown' | 'wait' | 'in';

export function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [state, setState] = useState<RiseState>('idle');
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (calm || typeof IntersectionObserver === 'undefined' || el.getBoundingClientRect().top < window.innerHeight) { setState('shown'); return; }
    setState('wait');
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setState('in'); io.disconnect(); }
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, state] as const;
}

export default function Rise({
  children, className, style, mode = 'self', id, ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  mode?: 'self' | 'stagger' | 'seq';
  id?: string;
  ariaLabel?: string;
}) {
  const [ref, state] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} id={id} className={className} style={style} data-rise={state} data-rise-mode={mode} aria-label={ariaLabel}>
      {children}
    </div>
  );
}
