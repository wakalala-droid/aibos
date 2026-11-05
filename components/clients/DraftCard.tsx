'use client';
/**
 * Find clients: one message waiting for the owner. AIBOS never sends it:
 * Open in email, Gmail or WhatsApp puts it in the owner's own app with
 * everything filled in, they press send there, then I sent it here so AIBOS
 * knows to follow up.
 */
import { useState } from 'react';
import { Chip, Note } from '@/components/hospitality/kit';
import { discardClientMessage, editClientMessage, markClientMessageSent, type ClientDraft } from '@/lib/api';
import { Field, KIND_WORDS, said } from './shared';

const BLANK = /\[[^\]\n]{2,80}\]/;

export default function DraftCard({ draft, kinds, canWrite, onDone }: {
  draft: ClientDraft;
  kinds: Record<string, string>;
  canWrite: boolean;
  onDone: () => Promise<void> | void;
}) {
  const p = draft.prospect;
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(draft.subject ?? '');
  const [body, setBody] = useState(draft.body ?? '');
  const [wa, setWa] = useState(draft.whatsapp ?? '');
  const [opened, setOpened] = useState<'email' | 'whatsapp' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasEmail = Boolean(p.email);
  const hasWa = Boolean(p.whatsapp);
  // Words in brackets are for the owner to write (an answer only they know):
  // the draft does not open to send until they are gone.
  const blank = [draft.subject, draft.body, draft.whatsapp].map((t) => (t ?? '').match(BLANK)?.[0]).find(Boolean) ?? null;
  const kindWord = p.kind ? kinds[p.kind] ?? p.kind : null;
  const reasons = (p.fit_reasons ?? []).slice(0, 3);
  // Without the AI the summary can be just their website's title, often their name.
  const summary = p.summary && p.summary.trim().toLowerCase() !== p.name.trim().toLowerCase() ? p.summary : null;

  async function run(what: string, fn: () => Promise<unknown>, after?: () => void) {
    setBusy(what);
    setError(null);
    try {
      await fn();
      after?.();
      await onDone();
    } catch (e) {
      setError(said(e, 'That did not work just now. Try again in a moment.'));
    } finally {
      setBusy(null);
    }
  }

  const save = () => run('save', () => editClientMessage(draft.id, {
    ...(hasEmail ? { subject } : {}), body, ...(hasWa ? { whatsapp: wa } : {}),
  }), () => setEditing(false));
  const sent = () => run('sent', () => markClientMessageSent(draft.id, opened ?? draft.channel));
  const discard = () => run('discard', () => discardClientMessage(draft.id));

  return (
    <article className="rs-row" style={{ alignItems: 'flex-start', padding: '16px 18px' }}>
      <div className="rs-row-main">
        <span className="rs-row-title">{p.name}</span>
        <span className="rs-row-line">
          {[kindWord, p.town, p.contact_name ? `to ${p.contact_name}` : null].filter(Boolean).join(' · ')}
        </span>
      </div>
      <div className="rs-btns" style={{ gap: 8 }}>
        <Chip tone={draft.kind === 'answer' ? 'stay' : draft.kind === 'followup' ? 'open' : 'wait'}>{KIND_WORDS[draft.kind]}</Chip>
        {p.fit !== null && p.fit !== undefined && <Chip>Fit {p.fit}</Chip>}
      </div>

      <div style={{ flex: '1 1 100%', minWidth: 0, display: 'grid', gap: 12 }}>
        {(summary || reasons.length > 0) && (
          <div style={{ display: 'grid', gap: 4 }}>
            {summary && <p className="rs-text">{summary}</p>}
            {reasons.length > 0 && <p className="rs-text is-quiet">Why it fits: {reasons.join('; ')}.</p>}
          </div>
        )}
        <p className="rs-text">
          {hasEmail && <>To <strong>{p.email}</strong></>}
          {hasEmail && hasWa && ' or '}
          {hasWa && <>WhatsApp <strong>+{p.whatsapp}</strong></>}
        </p>

        {editing ? (
          <div className="rs-form" style={{ alignItems: 'start' }}>
            {hasEmail && (
              <Field label="Subject" wide>
                <input className="field" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} />
              </Field>
            )}
            <Field label={hasEmail ? 'Email' : 'Message'} wide>
              <textarea className="field" rows={10} value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} />
            </Field>
            {hasWa && (
              <Field label="On WhatsApp" wide hint="Shorter, as people write on WhatsApp.">
                <textarea className="field" rows={5} value={wa} onChange={(e) => setWa(e.target.value)} maxLength={1500} />
              </Field>
            )}
          </div>
        ) : (
          <>
            <div className="rs-quote">
              {hasEmail && draft.subject && (
                <>
                  <span className="rs-quote-label">Subject</span>
                  <strong style={{ display: 'block', marginBottom: 14 }}>{draft.subject}</strong>
                </>
              )}
              {hasEmail ? draft.body : draft.whatsapp || draft.body}
            </div>
            {hasEmail && hasWa && draft.whatsapp && (
              <details>
                <summary className="rs-text" style={{ display: 'flex', alignItems: 'center', minHeight: 44, cursor: 'pointer' }}>
                  The WhatsApp version
                </summary>
                <div className="rs-quote is-plain">{draft.whatsapp}</div>
              </details>
            )}
          </>
        )}

        {error && <Note tone="bad">{error}</Note>}

        {canWrite && (editing ? (
          <div className="rs-btns">
            <button type="button" className="rs-btn is-navy" onClick={() => void save()} disabled={busy !== null}>
              {busy === 'save' ? 'Saving' : 'Save'}
            </button>
            <button type="button" className="rs-btn is-quiet" disabled={busy !== null} onClick={() => {
              setEditing(false); setSubject(draft.subject ?? ''); setBody(draft.body ?? ''); setWa(draft.whatsapp ?? '');
            }}>Cancel</button>
          </div>
        ) : blank ? (
          <>
            <Note tone="warn">Write your part where it says {blank} before you send this.</Note>
            <div className="rs-btns">
              <button type="button" className="rs-btn is-navy" onClick={() => setEditing(true)} disabled={busy !== null}>Write it</button>
              <button type="button" className="rs-btn is-quiet" onClick={() => void discard()} disabled={busy !== null}>
                {busy === 'discard' ? 'Discarding' : 'Discard'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="rs-btns">
              {draft.links.mailto && (
                <a className={`rs-btn ${opened ? 'is-quiet' : 'is-navy'}`} href={draft.links.mailto} onClick={() => setOpened('email')}>
                  Open in email
                </a>
              )}
              {draft.links.gmail && (
                <a className="rs-btn is-quiet" href={draft.links.gmail} target="_blank" rel="noopener noreferrer"
                  onClick={() => setOpened('email')}>Open in Gmail</a>
              )}
              {draft.links.whatsapp && (
                <a className={`rs-btn ${!draft.links.mailto && !opened ? 'is-navy' : 'is-quiet'}`} href={draft.links.whatsapp}
                  target="_blank" rel="noopener noreferrer" onClick={() => setOpened('whatsapp')}>Open in WhatsApp</a>
              )}
              <button type="button" className={`rs-btn ${opened ? 'is-navy' : 'is-quiet'}`} onClick={() => void sent()}
                disabled={busy !== null}>
                {busy === 'sent' ? 'Saving' : 'I sent it'}
              </button>
              <button type="button" className="rs-btn is-quiet" onClick={() => setEditing(true)} disabled={busy !== null}>Edit</button>
              <button type="button" className="rs-btn is-quiet" onClick={() => void discard()} disabled={busy !== null}>
                {busy === 'discard' ? 'Discarding' : 'Discard'}
              </button>
            </div>
            {opened && (
              <p className="rs-text is-quiet">
                Once you have pressed send in {opened === 'whatsapp' ? 'WhatsApp' : 'your email'}, press I sent it so AIBOS
                knows when to follow up.
              </p>
            )}
          </>
        ))}
      </div>
    </article>
  );
}
