'use client';

/**
 * Notice: every message that interrupts the owner, in one look.
 *
 * The owner, 5 Oct 2026: "never build using claude components ... always
 * design using the elements in the splash screen for payment reminders,
 * update notices, scheduled meeting, low money, anything." So a notice is
 * built from the What's new screen's pieces (components/pwa/WhatsNew.tsx):
 *   - the round outlined icon, or the AIBOS mark itself for news from AIBOS
 *   - a spaced-capitals title and a small spaced-capitals tag
 *   - plain 18px words
 *   - pill buttons: the brand pill for the one thing to do, a quiet pill
 *   - the faint light in the top-left corner, and (with `art`) the hairline
 *     tiles and the money line drawn across the right of the card
 * Red appears only for a notice about something that went wrong (`bad`).
 */

import { X, type LucideIcon } from 'lucide-react';
import { useTheme } from '@/lib/theme';

export interface NoticeProps {
  /** The round icon. Leave out with `brand` to show the AIBOS mark. */
  icon?: LucideIcon;
  /** News from AIBOS itself (an update, the app): the mark in the round. */
  brand?: boolean;
  title: React.ReactNode;
  tag?: React.ReactNode;
  children?: React.ReactNode;
  /** Pill buttons or links. */
  actions?: React.ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  /** Something went the wrong way: the icon and tag turn red. */
  bad?: boolean;
  /** The splash's hairline tiles and money line across the right side. */
  art?: boolean;
  /** Floating over the page (a deeper shadow) or sitting in it. */
  floating?: boolean;
  role?: 'status' | 'alert' | 'region' | 'dialog';
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}

/** The AIBOS mark, white on the dark theme and navy on the light one. */
export function BrandMark({ size = 26 }: { size?: number }) {
  const { isDark } = useTheme();
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a fixed small mark, nothing to optimise
    <img src={isDark ? '/brand/aibos-mark-white-glyph.png' : '/brand/aibos-mark.png'} alt="" aria-hidden="true"
      width={size} height={size} style={{ width: size, height: size, objectFit: 'contain' }} />
  );
}

/** The splash art, small: hairline tiles and the brand line with its shading under it. */
function NoticeArt() {
  const line = 'M0 92 C 40 90, 60 84, 90 86 S 140 72, 170 74 S 220 52, 250 56 S 300 28, 340 22';
  return (
    <svg className="notice-art" viewBox="0 0 340 110" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
      <rect className="art-tile" x="150" y="10" width="78" height="40" rx="10" />
      <rect className="art-tile" x="238" y="10" width="92" height="40" rx="10" />
      <rect className="art-tile" x="196" y="58" width="134" height="40" rx="10" />
      <circle className="art-ring" cx="256" cy="30" r="8" />
      <rect className="art-dot" x="270" y="26" width="44" height="5" rx="2.5" opacity="0.5" />
      <path d={`${line} L340 110 L0 110 Z`} className="notice-art-under" />
      <path className="notice-art-line" d={line} />
      <circle className="art-dot brand" cx="340" cy="22" r="4" />
    </svg>
  );
}

export default function Notice({
  icon: Icon, brand, title, tag, children, actions, onClose, closeLabel = 'Close',
  bad, art, floating, role = 'status', ariaLabel, className = '', style,
}: NoticeProps) {
  return (
    <div
      className={`notice${floating ? ' notice-floating' : ''}${bad ? ' notice-bad' : ''}${art ? ' notice-with-art' : ''} ${className}`.trim()}
      role={role} aria-label={ariaLabel} aria-live={role === 'status' ? 'polite' : undefined} style={style}
    >
      {art && <NoticeArt />}
      <div className="notice-head">
        <span className="bento-icon notice-icon" aria-hidden="true">
          {brand ? <BrandMark /> : Icon ? <Icon /> : <BrandMark />}
        </span>
        <div className="notice-main">
          <div className="notice-titlerow">
            <p className="bento-title notice-title">{title}</p>
            {tag && <span className="bento-tag notice-tag">{tag}</span>}
          </div>
          {children && <div className="notice-text">{children}</div>}
        </div>
        {onClose && (
          <button type="button" className="icon-pill notice-close" onClick={onClose} aria-label={closeLabel}>
            <X aria-hidden="true" />
          </button>
        )}
      </div>
      {actions && <div className="notice-actions">{actions}</div>}
    </div>
  );
}
