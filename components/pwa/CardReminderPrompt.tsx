'use client';

/**
 * "Update your payment details: AIBOS is card only now", on screen.
 *
 * The admin's card payment reminder (aibos-api billing.card_drive) lands in
 * the bell, but a row in the bell is easy to miss. This brings it up the way
 * a new version does: a floating notice at the bottom of the screen, with
 * "Set up card payment" (opens their checkout and marks it read) and "Later"
 * (hides it until AIBOS is next opened). It checks when the app opens and
 * each time it comes back to the front.
 */

import { useCallback, useEffect, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Notice from '@/components/ui/Notice';
import { authHeaders } from '@/lib/api';
import { markNotificationRead } from '@/lib/notifications';

const KIND = 'plan_card_reminder';
const LATER_KEY = 'aibos-card-reminder-later';

interface Row { id: string; kind: string; title: string; body: string | null; link: string | null }

export default function CardReminderPrompt() {
  const router = useRouter();
  const [row, setRow] = useState<Row | null>(null);

  const check = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/notifications?unread_only=true&limit=50', { headers: await authHeaders() });
      if (!res.ok) return;
      const data = (await res.json()) as { notifications?: Row[] };
      const found = (data.notifications ?? []).find(r => r.kind === KIND) ?? null;
      let later = '';
      try { later = window.sessionStorage.getItem(LATER_KEY) ?? ''; } catch { /* private mode */ }
      setRow(found && found.id !== later ? found : null);
    } catch { /* offline: the bell still has it */ }
  }, []);

  useEffect(() => {
    void check();
    const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [check]);

  if (!row) return null;

  const later = () => {
    try { window.sessionStorage.setItem(LATER_KEY, row.id); } catch { /* private mode */ }
    setRow(null);
  };
  const setUp = () => {
    void markNotificationRead(row.id);
    setRow(null);
    router.push(row.link || '/pricing');
  };

  return (
    <div className="update-dock">
      <Notice
        icon={CreditCard}
        art
        floating
        title="Update your payment details"
        tag="Card only"
        onClose={later}
        closeLabel="Later"
        actions={
          <>
            <button type="button" className="rs-btn is-navy is-sm" onClick={setUp}>
              <CreditCard aria-hidden="true" /> Set up card payment
            </button>
            <button type="button" className="rs-btn is-quiet is-sm" onClick={later}>Later</button>
          </>
        }
      >
        {row.body || row.title}
      </Notice>
    </div>
  );
}
