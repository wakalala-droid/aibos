/**
 * DocHeader: the AI-BOS letterhead every document opens with (reminders,
 * statements, notices, anything printed or saved as a PDF).
 *
 * The owner approved it on 18 Oct 2026 after one change: "drop the trend line
 * to the back", and the tiles came out so it looks more professional.
 *   - an ink band ending on the logo's gold rule (aibos-lockup.png)
 *   - top left: the white mark, the white wordmark, a short gold rule and
 *     "Business operating system" in spaced capitals
 *   - bottom left: the document name and a brand-cyan tag
 *   - the back layer: faint hairlines and the cyan trend line with its
 *     shading, across the whole band and behind the words
 *   - the emblem on the right: the navy mark on a white disc inside a dashed
 *     ring and a fainter outer ring, the cyan point and the rising double arrow,
 *     always in front at full strength with the words kept clear of it, at
 *     every width (owner, 18 Oct 2026)
 *   - under the band, the facts the document carries (Prepared for, Date,
 *     From), two columns on a phone
 * The PDF twin is aibos-api/pdfdoc.py (_letterhead). Classes in globals.css.
 */

import { useId } from 'react';

export interface DocFact {
  label: string;
  value: React.ReactNode;
}

export interface DocHeaderProps {
  /** The document's name: Payment reminder, Statement, Cash flow projection. */
  name: React.ReactNode;
  /** A short spaced-capitals tag in brand cyan: Past due, Paid, Draft. */
  tag?: React.ReactNode;
  /** The facts row under the band, one line each. */
  facts?: DocFact[];
  className?: string;
}

const TREND = 'M0 152 C 90 150, 150 142, 230 143 S 360 126, 430 122 S 560 94, 620 82 S 690 54, 720 42';

export default function DocHeader({ name, tag, facts, className = '' }: DocHeaderProps) {
  const fill = `doc-trend-fill-${useId().replace(/:/g, '')}`;
  return (
    <header className={`doc-head ${className}`.trim()}>
      <div className="doc-band">
        <svg className="doc-trend" viewBox="0 0 720 168" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#22d3ee" stopOpacity="0.10" />
              <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path className="gl" d="M0 42 H720 M0 84 H720 M0 126 H720" />
          <path d={`${TREND} L720 168 L0 168 Z`} fill={`url(#${fill})`} />
          <path className="ln" d={TREND} />
        </svg>
        <svg className="doc-art" viewBox="0 0 260 168" preserveAspectRatio="xMaxYMid meet" aria-hidden="true">
          <circle className="r outer" cx="130" cy="84" r="64" />
          <circle className="r dashed" cx="130" cy="84" r="50" />
          <circle className="disc" cx="130" cy="84" r="32" />
          <image href="/brand/aibos-mark.png" x="111" y="65" width="38" height="38" preserveAspectRatio="xMidYMid meet" />
          <circle className="cy" cx="161.1" cy="44.8" r="4" />
          <path className="ar" d="M214 44 L228 30 L242 44 L236 44 L228 36 L220 44 Z" />
          <path className="ar" d="M214 58 L228 44 L242 58 L236 58 L228 50 L220 58 Z" />
        </svg>
        <div className="doc-brand">
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed small brand files, nothing to optimise */}
          <img className="glyph" src="/brand/aibos-mark-white-glyph.png" alt="" />
          {/* eslint-disable-next-line @next/next/no-img-element -- the wordmark cropped to its bounds */}
          <img className="word" src="/brand/aibos-wordmark-white-tight.png" alt="AIBOS" />
          <span className="rule" aria-hidden="true" />
          <span className="line">Business operating system</span>
        </div>
        <div className="doc-name">
          <h2>{name}</h2>
          {tag && <span className="doc-tag">{tag}</span>}
        </div>
      </div>
      {facts && facts.length > 0 && (
        <dl className="doc-meta" style={{ '--doc-facts': facts.length } as React.CSSProperties}>
          {facts.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </header>
  );
}
