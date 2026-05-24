'use client';

import { useEffect, useRef, useState } from 'react';
import { easeOutQuart } from '@/lib/utils';

interface UseCounterOptions {
  duration?: number;   // ms
  delay?:    number;   // ms
  decimals?: number;
}

/**
 * Animates a number from `from` to `to` using easeOutQuart.
 * Re-triggers when `to` changes (e.g. on data upload).
 */
export function useCounter(
  to: number,
  { duration = 1200, delay = 0, decimals = 0 }: UseCounterOptions = {}
) {
  const [value, setValue] = useState(0);
  const rafRef   = useRef<number>();
  const prevTo   = useRef<number>(0);

  useEffect(() => {
    const from = prevTo.current;
    prevTo.current = to;

    let startTime: number | null = null;

    const delayTimer = setTimeout(() => {
      function tick(timestamp: number) {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOutQuart(progress);
        const current = from + (to - from) * eased;

        setValue(parseFloat(current.toFixed(decimals)));

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          setValue(to);
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    }, delay);

    return () => {
      clearTimeout(delayTimer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [to, duration, delay, decimals]);

  return value;
}
