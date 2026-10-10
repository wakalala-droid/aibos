'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The clock behind a feature-theatre scene. `times` are the moments (ms from
 * the start) at which the scene moves on a beat; the hook returns how many
 * beats have passed. It only runs while `playing` and a pause keeps its
 * place, so a scene stopped by a hover picks up where it left off. `still`
 * (reduced motion) jumps straight to the last beat: the finished picture.
 *
 * One timer per beat, never a per-frame loop: the scene re-renders a handful
 * of times in its whole run and CSS transitions do the moving.
 */
export function useBeats(times: readonly number[], playing: boolean, still: boolean) {
  const [beat, setBeat] = useState(still ? times.length : 0);
  const elapsed = useRef(0);

  useEffect(() => {
    if (still) { setBeat(times.length); return; }
    if (!playing) return;
    const start = performance.now();
    let timer = 0;
    const tick = () => {
      const now = elapsed.current + (performance.now() - start);
      let b = 0;
      while (b < times.length && times[b] <= now) b++;
      setBeat(b);
      if (b < times.length) timer = window.setTimeout(tick, Math.max(0, times[b] - now));
    };
    tick();
    return () => {
      window.clearTimeout(timer);
      elapsed.current += performance.now() - start;
    };
  }, [playing, still, times]);

  return beat;
}

/** Class names for a scene piece: "is-on" once its beat has come. */
export const at = (beat: number, n: number, base = 'sc-in') => `${base}${beat >= n ? ' is-on' : ''}`;
