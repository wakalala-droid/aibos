'use client';

/**
 * The welcome for a plan AIBOS gave free (aibos-api gifts.py), greeting the
 * owner by name. The owner, 17 Nov 2026: "give Mr Ryan Banda, owner of
 * Cookies & Coffee, 1 month free Growth tier, have a splash screen with his
 * name on it".
 *
 * WHEN IT SHOWS. The gift leaves one row in the bell, kind 'plan_gift', with
 * the name, business, plan and end date in its meta. While that row is unread
 * and the gift has not ended, this opens over everything (the upgrade welcome
 * waits underneath it). Closing it marks the row read, so it shows once
 * across every device.
 *
 * WHAT IT IS. The What's new splash (its art, the logo in its rings), the
 * owner's name as the title, the end date, four things the plan switches on
 * and one button in.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useModalFocus } from '@/hooks/useModalFocus';
import Image from 'next/image';
import { BellRing, CalendarRange, FlaskConical, Search, X, type LucideIcon } from 'lucide-react';
import { authHeaders } from '@/lib/api';
import { markNotificationRead } from '@/lib/notifications';
import { useTheme } from '@/lib/theme';
import { TIERS, isTier, type Tier } from '@/lib/tiers';
import { Art } from '@/components/pwa/WhatsNew';

export const GIFT_KIND = 'plan_gift';

export interface GiftMeta {
  plan: string;
  months?: number;
  until: string;
  name: string;
  business?: string;
}

interface Row { id: string; kind: string; meta?: Partial<GiftMeta> | null; read_at?: string | null }

type Item = { icon: LucideIcon; title: string; text: string };

/** What each gifted plan switches on, in the owner's words (lib/tiers.ts). */
const HIGHLIGHTS: Record<Exclude<Tier, 'free'>, Item[]> = {
  growth: [
    { icon: CalendarRange, title: '13 weeks ahead', text: 'A cash plan from your own books: wages, ZRA, rent and what customers owe.' },
    { icon: BellRing, title: 'Warned in time', text: 'A note on your phone weeks before money runs short, and your week ahead every Monday.' },
    { icon: Search, title: 'Find clients', text: '300 businesses a month researched and written to, ready for you to send.' },
    { icon: FlaskConical, title: 'Try it first', text: 'Test a purchase, a hire or a price change on the plan before you decide.' },
  ],
  proplus: [
    { icon: BellRing, title: 'Your 06:30 brief', text: 'The day ahead on your phone before you open.' },
    { icon: CalendarRange, title: 'Payroll', text: 'Payslips, PAYE and NAPSA worked out for you.' },
  ],
  pro: [
    { icon: CalendarRange, title: 'Invoices that get paid', text: 'Every invoice carries a pay link.' },
    { icon: Search, title: 'Find clients', text: '50 businesses a month researched and written to.' },
  ],
};

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

function spanWords(months?: number): string {
  return !months || months === 1 ? 'one month' : `${months} months`;
}

// ── The panel (pure, so it can be looked at without an account) ───────────

export function GiftWelcomePanel({ gift, onClose }: { gift: GiftMeta; onClose: () => void }) {
  const { isDark } = useTheme();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const plan = (isTier(gift.plan) && gift.plan !== 'free' ? gift.plan : 'growth') as Exclude<Tier, 'free'>;
  const planName = TIERS[plan].name;
  const items = HIGHLIGHTS[plan];
  const business = gift.business?.trim();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = before;
    };
  }, [onClose]);
  // Focus starts on the button, stays in the panel and goes back on close.
  useModalFocus(panel, true, button);

  return (
    <div className="whatsnew-backdrop gift-welcome" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={panel} className="whatsnew" role="dialog" aria-modal="true" aria-labelledby="gift-title">
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
          <button type="button" className="icon-pill whatsnew-close" onClick={onClose} aria-label="Close the welcome">
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="whatsnew-body">
          <p className="eyebrow">A gift from AIBOS</p>
          <h2 id="gift-title" className="whatsnew-title">Welcome to {planName}, {gift.name}</h2>
          <p className="whatsnew-sub">
            {business ? `${business} is` : 'You are'} on AIBOS {planName}, free for {spanWords(gift.months)} until{' '}
            {longDate(gift.until)}. Everything below is switched on now. Nothing to pay and no card needed.
          </p>

          <ul className="whatsnew-list">
            {items.map((item) => {
              const Icon = item.icon;
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
            <p>Free until {longDate(gift.until)}</p>
            <button ref={button} type="button" className="pill pill-primary" onClick={onClose}>
              Start exploring
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Whether to show it ──────────────────────────────────────────────────────

export default function GiftWelcome() {
  const [row, setRow] = useState<{ id: string; gift: GiftMeta } | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch('/api/proxy/notifications?unread_only=true&limit=50', { headers: await authHeaders() });
        if (!res.ok) return;
        const data = (await res.json()) as { notifications?: Row[] };
        const found = (data.notifications ?? []).find((r) => {
          const m = r.kind === GIFT_KIND ? r.meta : null;
          return Boolean(m?.name && m?.until && new Date(m.until).getTime() > Date.now());
        });
        if (live && found?.meta) setRow({ id: found.id, gift: found.meta as GiftMeta });
      } catch { /* offline: the bell still has it */ }
    })();
    return () => { live = false; };
  }, []);

  const id = row?.id;
  const close = useCallback(() => {
    if (id) void markNotificationRead(id);
    setRow(null);
  }, [id]);

  if (!row) return null;
  return <GiftWelcomePanel gift={row.gift} onClose={close} />;
}
