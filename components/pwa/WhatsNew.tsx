'use client';

/**
 * "What's new": the screen an owner sees once after an update lands
 * (the owner, 5 Oct 2026: "a beautiful splash screen for users to see what
 * UI and feature updates shipped this morning after they install the update").
 *
 * WHEN IT SHOWS. Once per release (lib/releaseNotes.ts), on each device, to
 * anyone whose account is older than the release: after "Get it now" on the
 * update bar reloads into the new version, or on the next visit. A brand-new
 * account is not shown it (nothing changed for them); the release is quietly
 * marked as seen instead.
 *
 * WHAT IT IS. The logo in its rings over a small bento grid and the money
 * line (drawn in once, still after that), then each change in plain words,
 * and one button back to work. Escape, the close button or a click outside
 * also close it.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  Archive, Hash, LayoutGrid, MessageSquareText, PanelLeft, Scale, Sparkles, TrendingUp, X,
  type LucideIcon,
} from 'lucide-react';
import { useProfile } from '@/lib/profile';
import { useTheme } from '@/lib/theme';
import { LATEST_RELEASE, type ReleaseIcon } from '@/lib/releaseNotes';

const SEEN_KEY = 'aibos-release-seen';

const ICONS: Record<ReleaseIcon, LucideIcon> = {
  bento: LayoutGrid,
  ink: Hash,
  breakeven: Scale,
  words: MessageSquareText,
  assistant: Sparkles,
  menu: PanelLeft,
  line: TrendingUp,
  studio: Archive,
};

/** "New this morning", "New since yesterday" or "New since 5 October". */
function whenWords(iso: string): string {
  const shipped = new Date(`${iso}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - shipped.getTime()) / 86_400_000);
  if (days <= 0) return 'New this morning';
  if (days === 1) return 'New since yesterday';
  return `New since ${shipped.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}`;
}

function shippedWords(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** The art: a bento grid in hairlines, the logo's rings and the money line. */
function Art() {
  // Tiles laid out like the app's 6-column bento grid, left and right of the
  // logo, so the art is made of the thing it announces.
  const tiles: [number, number, number, number][] = [
    [28, 28, 150, 92], [190, 28, 96, 44], [190, 82, 96, 38],
    [28, 132, 70, 70], [108, 132, 178, 70],
    [534, 28, 96, 56], [642, 28, 150, 92], [534, 96, 96, 24],
    [534, 132, 178, 70], [722, 132, 70, 70],
  ];
  const line = 'M0 244 C 70 242, 110 232, 160 234 S 250 222, 296 224 S 372 210, 420 214 S 508 190, 552 194 S 650 158, 694 162 S 776 120, 820 110';
  return (
    <svg className="art" viewBox="0 0 820 280" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="wn-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="1" />
          <stop offset="80%" stopColor="#fff" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="wn-mask"><rect width="820" height="280" fill="url(#wn-fade)" /></mask>
        <linearGradient id="wn-under" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--chart-line)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--chart-line)" stopOpacity="0" />
        </linearGradient>
      </defs>

      <g mask="url(#wn-mask)">
        {tiles.map(([x, y, w, h]) => (
          <rect key={`${x}-${y}`} className="art-tile" x={x} y={y} width={w} height={h} rx="12" />
        ))}
        {/* A few tile contents: an icon ring, a title bar and a tiny chart. */}
        <circle className="art-ring" cx="52" cy="52" r="12" />
        <rect x="74" y="46" width="60" height="6" rx="3" className="art-dot" opacity="0.5" />
        <rect x="44" y="84" width="108" height="5" rx="2.5" className="art-dot" opacity="0.25" />
        <circle className="art-ring" cx="666" cy="52" r="12" />
        <rect x="688" y="46" width="70" height="6" rx="3" className="art-dot" opacity="0.5" />
        <path className="art-ink" d="M124 186 L150 176 L176 180 L204 162 L232 166 L262 148" />
        <path className="art-ink" d="M550 186 L580 170 L610 176 L640 158 L670 160 L700 146" />
        <circle className="art-dot brand" cx="262" cy="148" r="3.5" />
        <circle className="art-dot brand" cx="700" cy="146" r="3.5" />
      </g>

      {/* The logo's rings, with a few points riding on them. */}
      <circle className="art-ring" cx="410" cy="140" r="78" />
      <circle className="art-ring dashed" cx="410" cy="140" r="108" />
      <circle className="art-ring" cx="410" cy="140" r="138" opacity="0.6" />
      <circle className="art-dot brand" cx={410 + 108 * Math.cos(-0.6)} cy={140 + 108 * Math.sin(-0.6)} r="5" />
      <circle className="art-dot" cx={410 + 138 * Math.cos(2.5)} cy={140 + 138 * Math.sin(2.5)} r="3.5" />
      <circle className="art-dot" cx={410 + 78 * Math.cos(2.1)} cy={140 + 78 * Math.sin(2.1)} r="3" />
      <circle className="art-dot" cx={410 + 138 * Math.cos(-2.4)} cy={140 + 138 * Math.sin(-2.4)} r="3" />

      {/* The money line, with its shading under it (the fix that shipped). */}
      <path d={`${line} L820 280 L0 280 Z`} fill="url(#wn-under)" />
      <path className="art-line" d={line} />
    </svg>
  );
}

export default function WhatsNew() {
  const { profile, loading } = useProfile();
  const { isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const release = LATEST_RELEASE;

  useEffect(() => {
    if (loading || !profile) return;
    let seen: string | null = null;
    try { seen = window.localStorage.getItem(SEEN_KEY); } catch { return; /* private mode: never nag */ }
    if (seen === release.id) return;
    const shipped = new Date(`${release.date}T23:59:59`).getTime();
    const joined = profile.created_at ? new Date(profile.created_at).getTime() : 0;
    if (joined > shipped) {
      // A newer account: nothing changed for them. Mark it seen, say nothing.
      try { window.localStorage.setItem(SEEN_KEY, release.id); } catch { /* private mode */ }
      return;
    }
    setOpen(true);
  }, [loading, profile, release.id, release.date]);

  const close = useCallback(() => {
    setOpen(false);
    try { window.localStorage.setItem(SEEN_KEY, release.id); } catch { /* private mode */ }
  }, [release.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    button.current?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = before;
    };
  }, [open, close]);

  if (!open) return null;

  return (
    <div className="whatsnew-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="whatsnew" role="dialog" aria-modal="true" aria-labelledby="whatsnew-title">
        <div className="whatsnew-art">
          <Art />
          <div className="whatsnew-logo">
            <Image
              src={isDark ? '/brand/aibos-mark-white-glyph.png' : '/brand/aibos-mark.png'}
              alt="AIBOS"
              width={60}
              height={60}
              priority
            />
          </div>
          <button type="button" className="icon-pill whatsnew-close" onClick={close} aria-label="Close what's new">
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="whatsnew-body">
          <p className="eyebrow">{whenWords(release.date)}</p>
          <h2 id="whatsnew-title" className="whatsnew-title">{release.title}</h2>
          <p className="whatsnew-sub">{release.intro}</p>

          <ul className="whatsnew-list">
            {release.items.map((item) => {
              const Icon = ICONS[item.icon];
              return (
                <li key={item.title} className="whatsnew-item">
                  <span className="bento-icon" aria-hidden="true"><Icon /></span>
                  <div style={{ minWidth: 0 }}>
                    <h3 className="bento-title">{item.title}</h3>
                    <p className="bento-text">{item.text}</p>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="whatsnew-foot">
            <p>Shipped {shippedWords(release.date)}</p>
            <button ref={button} type="button" className="pill pill-primary" onClick={close}>
              Take me in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
