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

/** The splash art as a strip across the top of the card, the way the What's
 *  new screen opens with its art panel: hairline tiles, the money line rising
 *  with its shading under it, the AIBOS mark in its rings in the middle and
 *  the rising double arrow at the right (owner, 7 Oct 2026). */
export function NoticeArt() {
  const { isDark } = useTheme();
  const line = 'M0 66 C 50 64, 80 58, 120 60 S 190 50, 230 52 S 300 40, 340 42 S 420 22, 470 24 S 530 10, 560 8';
  return (
    <div className="notice-art-strip" aria-hidden="true">
      <svg viewBox="0 0 560 80" preserveAspectRatio="xMidYMid slice">
        <rect className="art-tile" x="16" y="12" width="104" height="30" rx="9" />
        <rect className="art-tile" x="128" y="12" width="64" height="30" rx="9" />
        <rect className="art-tile" x="16" y="48" width="64" height="24" rx="8" />
        <circle className="art-ring" cx="32" cy="27" r="7" />
        <rect className="art-dot" x="46" y="24" width="52" height="5" rx="2.5" opacity="0.5" />
        <rect className="art-tile" x="372" y="12" width="70" height="30" rx="9" />
        <path d={`${line} L560 80 L0 80 Z`} className="notice-art-under" />
        <path className="notice-art-line" d={line} />
        <circle className="art-ring dashed" cx="280" cy="40" r="36" />
        <circle className="art-mark-disc" cx="280" cy="40" r="25" />
        <image href={isDark ? '/brand/aibos-mark-white-glyph.png' : '/brand/aibos-mark.png'} x="266" y="26" width="28" height="28" preserveAspectRatio="xMidYMid meet" />
        <circle className="art-dot brand" cx={280 + 36 * Math.cos(-0.9)} cy={40 + 36 * Math.sin(-0.9)} r="4" />
        <path className="art-arrow" d="M512 30 L530 12 L548 30 L540 30 L530 20 L520 30 Z" />
        <path className="art-arrow" d="M512 48 L530 30 L548 48 L540 48 L530 38 L520 48 Z" />
      </svg>
    </div>
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
