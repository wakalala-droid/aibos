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
 *
 * Built from the set the calendar introduced (components/hospitality/kit.tsx):
 * rounded navy buttons, chips, notes and a soft tile for the message.
 */

import { useState } from 'react';
import { Bell, CreditCard, Mail, Send, Smartphone, Users } from 'lucide-react';
import { sendCardReminder, type CardReminderResult } from '@/lib/api';
import { Chip, Note } from '@/components/hospitality/kit';

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
    <section className="section-card" style={{ marginBottom: 16 }}>
      <div className="rs-sec-head" style={{ marginBottom: 6 }}>
        <h2 className="rs-sec-title">Card payment reminder</h2>
        <Chip><CreditCard aria-hidden="true" /> Card only</Chip>
      </div>
      <p className="rs-text is-quiet">
        Asks every account on a paid plan that is not on a card yet to update its payment details to a card.
        Goes to their bell, their phone or computer, and their email. Free accounts and card plans are left out.
      </p>

      <div className="rs-btns" style={{ marginTop: 18 }}>
        <button type="button" className="rs-btn is-quiet" onClick={() => void run(true)} disabled={busy !== ''}>
          <Users aria-hidden="true" /> {busy === 'checking' ? 'Counting…' : 'Who would get this'}
        </button>
        <button type="button" className="rs-btn is-navy" onClick={() => void run(false)} disabled={!canSend || busy !== ''}>
          <Send aria-hidden="true" /> {busy === 'sending' ? 'Sending…' : 'Send it'}
        </button>
      </div>

      {preview && (
        <div role="status" style={{ marginTop: 20 }}>
          {nobody ? (
            <Note tone="info">Nobody to remind: every paying account is already on a card.</Note>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Chip><Bell aria-hidden="true" /> {plural(preview.people, 'account')} in the bell</Chip>
              <Chip><Mail aria-hidden="true" /> {preview.with_email} by email</Chip>
              <Chip><Smartphone aria-hidden="true" /> {preview.with_devices} on a phone or computer</Chip>
            </div>
          )}
          {preview.sample && (
            <div className="rs-quote is-plain" style={{ marginTop: 14, whiteSpace: 'normal' }}>
              <span className="rs-quote-label">What the first one reads</span>
              <div className="rs-row-title">{preview.sample.title}</div>
              <p className="rs-text" style={{ margin: '4px 0 14px' }}>{preview.sample.body}</p>
              <span className="rs-btn is-navy is-sm" aria-hidden="true">{preview.sample.button}</span>
            </div>
          )}
        </div>
      )}
      {sent && (
        <Note tone="good">
          Sent. {plural(sent.told, 'account')} told, {sent.emailed} emailed
          {sent.pushed > 0 ? `, ${plural(sent.pushed, 'device')} buzzed` : ''}
          {sent.already > 0 ? `. ${sent.already} already had it` : ''}
          {sent.errors > 0 ? `. ${sent.errors} could not be reached` : ''}.
        </Note>
      )}
      {sent && sent.remaining > 0 && (
        <Note tone="warn">{sent.remaining} still to go. Press Send it again to reach them.</Note>
      )}
      {error && <Note tone="bad">{error}</Note>}
    </section>
  );
}
