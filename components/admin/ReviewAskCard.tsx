'use client';

/**
 * Admin · Ask for reviews (20 Nov 2026).
 *
 * One message to every account that has not reviewed AIBOS yet: a row in their
 * bell, which anyone using AIBOS sees within a minute (the bell checks every
 * minute), and a notification on every phone or computer that has them on.
 * It opens Review AIBOS (/dashboard/reviews).
 *
 * Two steps, like Tell everyone above it: "Who would get this" counts and sends
 * nothing; only then can it go, and it can only go once (the message carries
 * its own stamp and the database refuses a second copy to the same person).
 * The API decides who may do this (aibos-api reviews.py, admin only).
 */

import { useState } from 'react';
import { Bell, Send, Smartphone, Star, UserCheck, Users } from 'lucide-react';
import { askForReviews, type ReviewAskResult } from '@/lib/api';
import { Chip, Note } from '@/components/hospitality/kit';

const plural = (n: number, one: string, more: string) => `${n} ${n === 1 ? one : more}`;

export default function ReviewAskCard({ ready = true }: { ready?: boolean }) {
  const [busy, setBusy] = useState<'' | 'checking' | 'sending'>('');
  const [preview, setPreview] = useState<ReviewAskResult | null>(null);
  const [sent, setSent] = useState<ReviewAskResult | null>(null);
  const [error, setError] = useState('');

  const run = async (dry: boolean) => {
    setBusy(dry ? 'checking' : 'sending');
    setError('');
    try {
      const result = await askForReviews(dry);
      if (dry) { setPreview(result); setSent(null); } else { setSent(result); setPreview(null); }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="section-card" style={{ marginBottom: 16 }} aria-labelledby="review-ask-title">
      <div className="rs-sec-head" style={{ marginBottom: 6 }}>
        <h2 id="review-ask-title" className="rs-sec-title">Ask for reviews</h2>
        <Chip><Star aria-hidden="true" /> Everyone who has not reviewed</Chip>
      </div>
      <p className="rs-text is-quiet">
        Goes to every account&apos;s bell, which anyone using AIBOS sees within a minute, and to every phone or
        computer with notifications on. Whoever has already reviewed is left out. It can only go once.
      </p>

      <div className="rs-btns" style={{ marginTop: 18 }}>
        <button type="button" className="rs-btn is-quiet" onClick={() => void run(true)} disabled={!ready || busy !== ''}>
          <Users aria-hidden="true" /> {busy === 'checking' ? 'Counting…' : 'Who would get this'}
        </button>
        <button type="button" className="rs-btn is-navy" onClick={() => void run(false)} disabled={!ready || !preview || preview.people === 0 || busy !== ''}>
          <Send aria-hidden="true" /> {busy === 'sending' ? 'Sending…' : 'Send the ask'}
        </button>
      </div>

      {preview && (
        <div role="status" style={{ marginTop: 20, display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Chip><Bell aria-hidden="true" /> {plural(preview.people, 'account', 'accounts')} in the bell</Chip>
            {preview.with_devices > 0 && (
              <Chip><Smartphone aria-hidden="true" /> {preview.with_devices} on a phone or computer</Chip>
            )}
            {preview.active_now !== null && preview.active_now > 0 && (
              <Chip><Users aria-hidden="true" /> {preview.active_now} using AIBOS now</Chip>
            )}
            {preview.reviewed > 0 && (
              <Chip><UserCheck aria-hidden="true" /> {plural(preview.reviewed, 'has', 'have')} reviewed, left out</Chip>
            )}
          </div>
          {/* The message exactly as it lands in the bell. */}
          <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-md)', background: 'var(--bg-card)', maxWidth: 520 }}>
            <p className="rs-text is-strong">{preview.title}</p>
            <p className="rs-text" style={{ marginTop: 4 }}>{preview.body}</p>
            <p className="rs-text is-quiet" style={{ marginTop: 6, fontSize: 'var(--fs-label)' }}>Opens Review AIBOS</p>
          </div>
          {preview.people === 0 && <Note tone="info">Everyone has reviewed already, or has been asked. Nothing would go.</Note>}
          {preview.people > 0 && preview.with_devices === 0 && (
            <Note tone="info">Nobody has notifications on yet, so nothing would buzz. They see it in the bell.</Note>
          )}
        </div>
      )}
      {sent && (
        <Note tone="good">
          Sent. {sent.told} told{sent.pushed > 0 ? `, ${plural(sent.pushed, 'device', 'devices')} buzzed` : ''}
          {sent.already > 0 ? `, ${sent.already} already had it` : ''}
          {sent.not_pushed > 0 ? `. ${sent.not_pushed} will see it when they next open AIBOS.` : '.'}
        </Note>
      )}
      {error && <Note tone="bad">{error}</Note>}
    </section>
  );
}
