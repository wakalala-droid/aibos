'use client';

/**
 * Admin · Tell everyone.
 *
 * One message to every AI-BOS account: a row in their bell and a notification
 * on every phone or computer that has them on. Used when something changes
 * that customers should know about, starting with a new version.
 *
 * Two steps on purpose. "Who would get this" counts the people and the devices
 * and sends nothing, so the size of the thing is known before it happens. Only
 * then does Send go out, and it can never be sent twice: the message is stamped
 * with its own name, and the database refuses a second copy of the same stamp
 * to the same person.
 *
 * The API decides who may do this, from an address Google has proven the
 * account owns. This card is only the hands. Built from the calendar's set
 * (components/hospitality/kit.tsx), like the card payment reminder below it.
 */

import { useState } from 'react';
import { Bell, Megaphone, Send, Smartphone, Users } from 'lucide-react';
import { announce, type AnnounceResult } from '@/lib/api';
import { Chip, Note } from '@/components/hospitality/kit';

export default function AnnounceCard() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('/dashboard');
  const [busy, setBusy] = useState<'' | 'checking' | 'sending'>('');
  const [preview, setPreview] = useState<AnnounceResult | null>(null);
  const [sent, setSent] = useState<AnnounceResult | null>(null);
  const [error, setError] = useState('');

  const run = async (dry: boolean) => {
    setBusy(dry ? 'checking' : 'sending');
    setError('');
    try {
      const result = await announce({ title: title.trim(), body: body.trim(), link: link.trim() || '/dashboard', dry_run: dry });
      if (dry) { setPreview(result); setSent(null); } else { setSent(result); setPreview(null); }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const ready = title.trim().length > 2;

  return (
    <section className="section-card" style={{ marginBottom: 16 }}>
      <div className="rs-sec-head" style={{ marginBottom: 6 }}>
        <h2 className="rs-sec-title">Tell everyone</h2>
        <Chip><Megaphone aria-hidden="true" /> Every account</Chip>
      </div>
      <p className="rs-text is-quiet">
        Goes to every account&apos;s bell and to every phone or computer with notifications on. Check who first.
      </p>

      <div style={{ display: 'grid', gap: 14, marginTop: 18 }}>
        <div>
          <label className="field-label" htmlFor="announce-title">What it says</label>
          <input id="announce-title" className="field" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="AIBOS has been updated" />
        </div>
        <div>
          <label className="field-label" htmlFor="announce-body">The detail</label>
          <textarea id="announce-body" className="field" value={body} onChange={(e) => setBody(e.target.value)} rows={3}
            placeholder="Close AIBOS and open it again to get the new version." style={{ minHeight: 88, resize: 'vertical' }} />
        </div>
        <div>
          <label className="field-label" htmlFor="announce-link">Where it opens</label>
          <input id="announce-link" className="field" value={link} onChange={(e) => setLink(e.target.value)} />
        </div>
      </div>

      <div className="rs-btns" style={{ marginTop: 18 }}>
        <button type="button" className="rs-btn is-quiet" onClick={() => void run(true)} disabled={!ready || busy !== ''}>
          <Users aria-hidden="true" /> {busy === 'checking' ? 'Counting…' : 'Who would get this'}
        </button>
        <button type="button" className="rs-btn is-navy" onClick={() => void run(false)} disabled={!preview || busy !== ''}>
          <Send aria-hidden="true" /> {busy === 'sending' ? 'Sending…' : 'Send it'}
        </button>
      </div>

      {preview && (
        <div role="status" style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Chip><Bell aria-hidden="true" /> {preview.people} account{preview.people === 1 ? '' : 's'} in the bell</Chip>
            {preview.with_devices > 0 && (
              <Chip><Smartphone aria-hidden="true" /> {preview.with_devices} on a phone or computer</Chip>
            )}
          </div>
          {preview.with_devices === 0 && <Note tone="info">Nobody has notifications on yet, so nothing would buzz.</Note>}
        </div>
      )}
      {sent && (
        <Note tone="good">
          Sent. {sent.told} told{sent.pushed > 0 ? `, ${sent.pushed} device${sent.pushed === 1 ? '' : 's'} buzzed` : ''}
          {sent.already > 0 ? `, ${sent.already} already had it` : ''}
          {sent.not_pushed > 0 ? `. ${sent.not_pushed} will see it when they next open AIBOS.` : '.'}
        </Note>
      )}
      {error && <Note tone="bad">{error}</Note>}
    </section>
  );
}
