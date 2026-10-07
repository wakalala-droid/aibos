'use client';

/**
 * Admin · Card payment reminder.
 *
 * Plans are paid by card only since 25 September 2026. The renewal run asks an
 * owner only when their own date comes round, so this is the "tell them all
 * now": every account on a paid plan that a card is not paying for gets one
 * reminder in the bell, on their phone or computer, and by email with a
 * "Set up card payment" button. Free accounts and card plans are left out.
 *
 * Two steps, as on Tell everyone. "Who would get this" counts them and shows
 * the message the first one would read, sending nothing. Send goes once per
 * day: a second press that day reaches only whoever the first did not.
 */

import { useState } from 'react';
import { sendCardReminder, type CardReminderResult } from '@/lib/api';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default function CardReminderCard() {
  const [busy, setBusy] = useState<'' | 'checking' | 'sending'>('');
  const [preview, setPreview] = useState<CardReminderResult | null>(null);
  const [sent, setSent] = useState<CardReminderResult | null>(null);
  const [error, setError] = useState('');

  const run = async (dry: boolean) => {
    setBusy(dry ? 'checking' : 'sending');
    setError('');
    try {
      const result = await sendCardReminder({ dry_run: dry });
      if (dry) { setPreview(result); setSent(null); } else { setSent(result); setPreview(null); }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const nobody = preview !== null && preview.people === 0;
  // Send opens after a count, and again when a send ran out of time.
  const canSend = (preview !== null && !nobody) || (sent !== null && sent.remaining > 0);

  return (
    <section className="section-card" style={{ padding: 16, marginBottom: 16 }}>
      <h2 style={{ fontSize: 'var(--fs-body)', fontWeight: 800, color: 'var(--text-1)', margin: '0 0 4px' }}>Card payment reminder</h2>
      <p style={{ fontSize: 'var(--fs-body)', lineHeight: 1.6, color: 'var(--text-3)', margin: '0 0 16px' }}>
        Asks every account on a paid plan that is not on a card yet to update its payment details to a card.
        Goes to their bell, their phone or computer, and their email. Free accounts and card plans are left out.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => void run(true)} disabled={busy !== ''}
          style={{ minHeight: 44, padding: '0 16px', borderRadius: 10, border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--text-2)', fontSize: 'var(--fs-body)', fontWeight: 700, cursor: 'pointer' }}>
          {busy === 'checking' ? 'Counting…' : 'Who would get this'}
        </button>
        <button type="button" onClick={() => void run(false)} disabled={!canSend || busy !== ''}
          style={{ minHeight: 44, padding: '0 16px', borderRadius: 10, border: '1px solid var(--text-1)', background: 'var(--text-1)', color: 'var(--bg-card)', fontSize: 'var(--fs-body)', fontWeight: 700, cursor: canSend ? 'pointer' : 'default', opacity: canSend ? 1 : 0.5 }}>
          {busy === 'sending' ? 'Sending…' : 'Send it'}
        </button>
      </div>

      {preview && (
        <div role="status" style={{ marginTop: 12 }}>
          <p style={{ fontSize: 'var(--fs-body)', lineHeight: 1.6, color: 'var(--text-2)', margin: 0 }}>
            {nobody
              ? 'Nobody to remind: every paying account is already on a card.'
              : `${plural(preview.people, 'account')} would get it in the bell. ${preview.with_email} of them by email, ${preview.with_devices} on a phone or computer.`}
          </p>
          {preview.sample && (
            <div style={{ marginTop: 12, padding: 14, borderRadius: 10, border: '1px solid var(--border-md)', background: 'var(--bg-badge)' }}>
              <div style={{ fontSize: 'var(--fs-caps)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-4)', marginBottom: 6 }}>
                What the first one reads
              </div>
              <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700, lineHeight: 1.5, color: 'var(--text-1)' }}>{preview.sample.title}</div>
              <p style={{ fontSize: 'var(--fs-body)', lineHeight: 1.6, color: 'var(--text-2)', margin: '4px 0 8px' }}>{preview.sample.body}</p>
              <span style={{ display: 'inline-flex', alignItems: 'center', minHeight: 36, padding: '0 14px', borderRadius: 999, background: 'var(--text-1)', color: 'var(--bg-card)', fontSize: 'var(--fs-body)', fontWeight: 700 }}>
                {preview.sample.button}
              </span>
            </div>
          )}
        </div>
      )}
      {sent && (
        <p role="status" style={{ fontSize: 'var(--fs-body)', lineHeight: 1.6, color: 'var(--good)', margin: '12px 0 0' }}>
          Sent. {plural(sent.told, 'account')} told, {sent.emailed} emailed
          {sent.pushed > 0 ? `, ${plural(sent.pushed, 'device')} buzzed` : ''}
          {sent.already > 0 ? `. ${sent.already} already had it` : ''}
          {sent.errors > 0 ? `. ${sent.errors} could not be reached` : ''}.
          {sent.remaining > 0 ? ` ${sent.remaining} still to go: press Send it again to reach them.` : ''}
        </p>
      )}
      {error && (
        <p role="alert" style={{ fontSize: 'var(--fs-body)', lineHeight: 1.6, color: 'var(--crit)', margin: '12px 0 0' }}>{error}</p>
      )}
    </section>
  );
}
