'use client';
/**
 * A schedule reminder on screen the moment it arrives.
 *
 * The server sends each reminder once (aibos-api schedule_reminders.py): a row
 * in the bell, a notification on every phone and computer the owner turned them
 * on in and an email when no device got it. The bell polls that feed; this
 * shows each new reminder from it as a card in the corner, so an owner working
 * in AIBOS sees it without opening the bell. It stays until it is opened or
 * dismissed. Either one settles it in the bell as well.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { BellRing, X } from 'lucide-react';
import { timeAgo, type Notification } from '@/lib/notifications';
import { playReminderSound } from '@/lib/sound';

const DISMISSED_KEY = 'aibos-reminders-dismissed-v1';
// An unread reminder older than this waits in the bell instead of popping up.
const FRESH_MS = 12 * 60 * 60 * 1000;
const MAX_ON_SCREEN = 3;

function readDismissed(): string[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(DISMISSED_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
  } catch { return []; }
}

/** "Meeting: Bank manager" is written by the server as label, then name. */
function split(title: string): { label: string; name: string } {
  const at = title.indexOf(': ');
  return at > 0 && at < 20
    ? { label: title.slice(0, at), name: title.slice(at + 2) }
    : { label: 'Reminder', name: title };
}

export default function ReminderPopup({ items, onSettle }: {
  items: Notification[];
  /** Mark it read on the server and drop it from the bell. */
  onSettle: (serverId: string) => void;
}) {
  // Read after mount: the server render has no localStorage.
  const [dismissed, setDismissed] = useState<string[] | null>(null);
  useEffect(() => { setDismissed(readDismissed()); }, []);

  const visible = useMemo(() => {
    if (!dismissed) return [];
    const now = Date.now();
    return items
      .filter((n) => n.kind === 'schedule_reminder' && n.serverId && !dismissed.includes(n.serverId))
      .filter((n) => now - (Date.parse(n.happenedAt ?? '') || 0) < FRESH_MS)
      .slice(0, MAX_ON_SCREEN);
  }, [items, dismissed]);

  // A sound the first time each card appears, so a reminder is noticed by
  // someone looking at another part of the screen. Not once per render, and
  // never again for a card that is already up.
  const heard = useRef<Set<string>>(new Set());
  useEffect(() => {
    const fresh = visible.filter((n) => !heard.current.has(n.id));
    if (fresh.length === 0) return;
    fresh.forEach((n) => heard.current.add(n.id));
    void playReminderSound();
  }, [visible]);

  const settle = (serverId: string) => {
    const next = [...(dismissed ?? []), serverId].slice(-100);
    setDismissed(next);
    // Remembered here too, so a mark-read that fails cannot bring it back.
    try { window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(next)); } catch { /* private mode */ }
    onSettle(serverId);
  };

  if (visible.length === 0) return null;

  return (
    <div className="reminder-stack" role="region" aria-label="Reminders" aria-live="polite">
      {visible.map((n) => {
        const { label, name } = split(n.title);
        const age = Date.now() - (Date.parse(n.happenedAt ?? '') || Date.now());
        return (
          <div key={n.id} className="reminder-card">
            <div className="reminder-head">
              <span className="reminder-label">
                <BellRing size={18} strokeWidth={2} aria-hidden="true" />
                {label}
              </span>
              <button type="button" className="reminder-close" aria-label={`Dismiss the reminder for ${name}`}
                onClick={() => settle(n.serverId!)}>
                <X size={20} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
            <p className="reminder-name">{name}</p>
            {n.description && <p className="reminder-body">{n.description}</p>}
            {age > 2 * 60 * 1000 && <p className="reminder-age">Sent {timeAgo(n.happenedAt).toLowerCase()}</p>}
            <div className="reminder-actions">
              <Link href={n.href || '/dashboard/schedule'} className="reminder-open" onClick={() => settle(n.serverId!)}>
                Open schedule
              </Link>
              <button type="button" className="reminder-dismiss" onClick={() => settle(n.serverId!)}>
                Dismiss
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
