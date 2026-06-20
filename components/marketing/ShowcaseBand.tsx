import type { ReactNode } from 'react';
import Link from 'next/link';
import Reveal from './Reveal';

// Humble's core rhythm: a big eyebrow + headline + short value lines on one
// side, a real product panel on the other, alternating sides band to band.
export default function ShowcaseBand({
  eyebrow, title, lead, values, children, reverse, dark, cta,
}: {
  eyebrow: string;
  title: ReactNode;
  lead: ReactNode;
  values?: string[];
  children: ReactNode;
  reverse?: boolean;
  dark?: boolean;
  cta?: { label: string; href: string };
}) {
  return (
    <section className={`mkt-section ${dark ? 'mkt-dark' : ''}`} style={{ position: 'relative', overflow: 'hidden' }}>
      {dark && <span className="mkt-glow" style={{ top: '-30%', [reverse ? 'left' : 'right']: '-6%', width: 460, height: 460, background: 'radial-gradient(circle, rgba(0,212,255,0.16), transparent 62%)' } as React.CSSProperties} />}
      <div className="mkt-wrap" style={{ position: 'relative', zIndex: 1 }}>
        <div className={`mkt-showcase ${reverse ? 'reverse' : ''}`}>
          <Reveal>
            <div>
              <p className="mkt-eyebrow">{eyebrow}</p>
              <h2 className="mkt-h2">{title}</h2>
              <p className="mkt-lead" style={{ marginTop: 22, maxWidth: 540 }}>{lead}</p>
              {values && values.length > 0 && (
                <ul className="mkt-values">
                  {values.map((v) => (
                    <li key={v}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      {v}
                    </li>
                  ))}
                </ul>
              )}
              {cta && (
                <Link href={cta.href} className="mkt-btn mkt-btn-primary" style={{ marginTop: 30 }}>
                  {cta.label}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </Link>
              )}
            </div>
          </Reveal>
          <Reveal delay={0.12}>
            {children}
          </Reveal>
        </div>
      </div>
    </section>
  );
}
