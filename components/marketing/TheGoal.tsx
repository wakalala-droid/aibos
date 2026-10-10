'use client';

import { useEffect, useRef, useState } from 'react';

// The goal, near the end of the page: four short lines, dim until each one
// reaches the middle of the screen, then lit for good. One observer watches
// the four lines; nothing is measured while scrolling. Reduced motion or no
// script: all four are lit.
const LINES = ['Know your numbers.', 'Pay your people right.', 'Get paid on time.', 'Grow on purpose.'];

export default function TheGoal() {
  const box = useRef<HTMLDivElement>(null);
  const [lit, setLit] = useState<boolean[] | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (calm || typeof IntersectionObserver === 'undefined') return;
    const lines = Array.from(el.querySelectorAll<HTMLElement>('[data-line]'));
    // Lines already above the middle of the screen when the page opens stay lit.
    setLit(lines.map((l) => l.getBoundingClientRect().top < window.innerHeight * 0.55));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const i = Number((e.target as HTMLElement).dataset.line);
        setLit((now) => (now && !now[i] ? now.map((v, j) => v || j === i) : now));
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -45% 0px', threshold: 0 });
    lines.forEach((l) => io.observe(l));
    return () => io.disconnect();
  }, []);

  return (
    <section className="mkt-section mkt-goal" aria-labelledby="goal-h">
      <div className="mkt-wrap">
        <p className="mkt-eyebrow" id="goal-h">The goal</p>
        <div ref={box} className="mkt-goal-lines">
          {LINES.map((l, i) => (
            <p key={l} data-line={i} className={`mkt-goal-line${lit && !lit[i] ? ' is-dim' : ''}`}>{l}</p>
          ))}
        </div>
        <p className="mkt-lead mkt-goal-sub">
          AIBOS does the counting, the chasing and the remembering, so you can build the business you meant to build.
        </p>
      </div>
    </section>
  );
}
