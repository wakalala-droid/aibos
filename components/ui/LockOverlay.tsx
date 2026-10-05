'use client';

// What a report shows over itself before it has the data it needs: a bento
// card (5 Oct 2026) with a round outlined lock, a spaced-capital title, one
// plain sentence, what it will show and the one way to unlock it.

import Link from 'next/link';
import { Lock, ArrowRight } from 'lucide-react';

interface LockOverlayProps {
  /** Accepted from older callers; the card is monochrome. */
  colour?: string;
  title: string;
  description: string;
  bullets?: string[];
}

export default function LockOverlay({ title, description, bullets }: LockOverlayProps) {
  return (
    <div className="lock-overlay">
      <div className="bento" style={{ maxWidth: 440, width: '100%' }}>
        <div className="bento-head">
          <span className="bento-icon" aria-hidden="true"><Lock /></span>
          <div className="bento-main">
            <p className="bento-title">{title}</p>
            <p className="bento-text">{description}</p>
            {bullets && bullets.length > 0 && (
              <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'grid', gap: 4 }}>
                {bullets.map((b) => (
                  <li key={b} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 'var(--fs-body)', color: 'var(--text-2)' }}>
                    <ArrowRight aria-hidden="true" style={{ width: 18, height: 18, flexShrink: 0, marginTop: 5 }} />{b}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="bento-foot">
          <Link href="/dashboard/import" className="pill pill-primary">Upload a file</Link>
        </div>
      </div>
    </div>
  );
}
