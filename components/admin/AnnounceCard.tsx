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
 * account owns. This card is only the hands.
 */

import { useState } from 'react';
import { announce, type AnnounceResult } from '@/lib/api';

const field: React.CSSProperties = {
  width: '100%', padding: '10px 12px', minHeight: 44, borderRadius: 10,
  border: '1px solid var(--border-md)', background: 'var(--bg-input)',
  color: 'var(--text-1)', fontSize: 16, outline: 'none',
};
const label: React.CSSProperties = {
  display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 700,
  letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-4)',
};

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
    <section className="section-card" style={{ padding: 16, marginBottom: 16 }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', margin: '0 0 4px' }}>Tell everyone</h2>
      <p style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--text-3)', margin: '0 0 16px' }}>
        Goes to every account&apos;s bell and to every phone or computer with notifications on. Check who first.
      </p>

      <div style={{ display: 'grid', gap: 12 }}>
        <div>
          <label style={label} htmlFor="announce-title">What it says</label>
          <input id="announce-title" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="AIBOS has been updated" style={field} />
        </div>
        <div>
          <label style={label} htmlFor="announce-body">The detail</label>
          <textarea id="announce-body" value={body} onChange={(e) => setBody(e.target.value)} rows={3}
            placeholder="Close AIBOS and open it again to get the new version." style={{ ...field, minHeight: 88, resize: 'vertical' }} />
        </div>
        <div>
          <label style={label} htmlFor="announce-link">Where it opens</label>
          <input id="announce-link" value={link} onChange={(e) => setLink(e.target.value)} style={field} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
        <button type="button" onClick={() => void run(true)} disabled={!ready || busy !== ''}
          style={{ minHeight: 44, padding: '0 16px', borderRadius: 10, border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--text-2)', fontSize: 16, fontWeight: 700, cursor: ready ? 'pointer' : 'default', opacity: ready ? 1 : 0.6 }}>
          {busy === 'checking' ? 'Counting…' : 'Who would get this'}
        </button>
        <button type="button" onClick={() => void run(false)} disabled={!preview || busy !== ''}
          style={{ minHeight: 44, padding: '0 16px', borderRadius: 10, border: '1px solid var(--text-1)', background: 'var(--text-1)', color: 'var(--bg-card)', fontSize: 16, fontWeight: 700, cursor: preview ? 'pointer' : 'default', opacity: preview ? 1 : 0.5 }}>
          {busy === 'sending' ? 'Sending…' : 'Send it'}
        </button>
      </div>

      {preview && (
        <p role="status" style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--text-2)', margin: '12px 0 0' }}>
          {preview.people} account{preview.people === 1 ? '' : 's'} would see it in the bell
          {preview.with_devices > 0
            ? `, and ${preview.with_devices} of them would get it on a phone or computer.`
            : '. Nobody has notifications on yet, so nothing would buzz.'}
        </p>
      )}
      {sent && (
        <p role="status" style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--good)', margin: '12px 0 0' }}>
          Sent. {sent.told} told{sent.pushed > 0 ? `, ${sent.pushed} device${sent.pushed === 1 ? '' : 's'} buzzed` : ''}
          {sent.already > 0 ? `, ${sent.already} already had it` : ''}
          {sent.not_pushed > 0 ? `. ${sent.not_pushed} will see it when they next open AIBOS.` : '.'}
        </p>
      )}
      {error && (
        <p role="alert" style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--crit)', margin: '12px 0 0' }}>{error}</p>
      )}
    </section>
  );
}
