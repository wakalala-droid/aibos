'use client';
/**
 * Find clients: one message waiting for the owner. AIBOS never sends it:
 * Open in email, Gmail or WhatsApp puts it in the owner's own app with
 * everything filled in, they press send there, then I sent it here so AIBOS
 * knows to follow up.
 *
 * LinkedIn (10 Nov 2026) the safe way: AIBOS never opens LinkedIn itself.
 * The LinkedIn button copies the note (or the message) and opens their page
 * in the owner's own LinkedIn, or a search for them when the page is not
 * known. The owner pastes it, presses send there, then I sent it here.
 */
import { useState, type ReactNode } from 'react';
import { Chip, Note } from '@/components/hospitality/kit';
import { discardClientMessage, editClientMessage, markClientMessageSent, type ClientChannel, type ClientDraft } from '@/lib/api';
import { Field, KIND_WORDS, said } from './shared';

const BLANK = /\[[^\]\n]{2,80}\]/;
/** What a free LinkedIn account takes with an invitation (Premium takes 300). */
const NOTE_MAX = 200;

/** "A", "A or B", "A, B or C": no comma before the "or". */
function orList(items: ReactNode[]): ReactNode {
  return items.map((item, i) => (
    <span key={i}>{i === 0 ? '' : i === items.length - 1 ? ' or ' : ', '}{item}</span>
  ));
}

/** linkedin.com/company/their-name, short enough to read in a line. */
function shortLinkedIn(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, '');
}

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
  const [note, setNote] = useState(draft.linkedin ?? '');
  const [opened, setOpened] = useState<ClientChannel | null>(null);
  const [copied, setCopied] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasEmail = Boolean(p.email);
  const hasWa = Boolean(p.whatsapp);
  const hasNote = draft.linkedin !== null && draft.linkedin !== undefined;
  // Where the LinkedIn button opens: their page when it is known, else a search.
  const liPage = draft.links.linkedin ?? null;
  const liOpen = liPage ?? draft.links.linkedin_search ?? null;
  const liOnly = !hasEmail && !hasWa;
  // A first message goes as the invitation's note (drafts from before the
  // note have none, and the message is too long for one); the rest go as a
  // message to someone already on their LinkedIn.
  const liText = draft.kind === 'first' ? draft.linkedin ?? '' : draft.whatsapp || draft.body;
  const showLi = Boolean(liOpen && liText && (draft.kind === 'first' || p.linkedin));
  // Words in brackets are for the owner to write (an answer only they know):
  // the draft does not open to send until they are gone.
  const blank = [draft.subject, draft.body, draft.whatsapp, draft.linkedin]
    .map((t) => (t ?? '').match(BLANK)?.[0]).find(Boolean) ?? null;
  const kindWord = p.kind ? kinds[p.kind] ?? p.kind : null;
  const reasons = (p.fit_reasons ?? []).slice(0, 3);
  // Without the AI the summary can be just their website's title, often their name.
  const summary = p.summary && p.summary.trim().toLowerCase() !== p.name.trim().toLowerCase() ? p.summary : null;
  const main = hasEmail ? draft.body : hasWa ? draft.whatsapp || draft.body : liText || draft.whatsapp || draft.body;

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

  // On LinkedIn only, edit just the words that are copied: the note for a
  // first message, the short version for the rest, the message itself when
  // the draft has neither.
  const liWords = !liOnly ? null
    : draft.kind === 'first' ? (hasNote ? 'note' : 'body') : (draft.whatsapp ? 'wa' : 'body');
  const editBody = !liOnly || liWords === 'body';
  const editWa = hasWa || liWords === 'wa';
  const save = () => run('save', () => editClientMessage(draft.id, {
    ...(hasEmail ? { subject } : {}), ...(editBody ? { body } : {}), ...(editWa ? { whatsapp: wa } : {}),
    ...(hasNote ? { linkedin: note } : {}),
  }), () => setEditing(false));
  const sent = () => run('sent', () => markClientMessageSent(draft.id, opened ?? draft.channel));
  const discard = () => run('discard', () => discardClientMessage(draft.id));

  // The link opens LinkedIn in a new tab by itself; this copies the words to paste there.
  function toLinkedIn() {
    setOpened('linkedin');
    setCopied(null);
    try {
      void navigator.clipboard.writeText(liText).then(() => setCopied(true), () => setCopied(false));
    } catch {
      setCopied(false);
    }
  }

  const ways: ReactNode[] = [];
  if (hasEmail) ways.push(<>To <strong>{p.email}</strong></>);
  if (hasWa) ways.push(<>WhatsApp <strong>+{p.whatsapp}</strong></>);
  if (p.linkedin) ways.push(<>LinkedIn <strong style={{ overflowWrap: 'anywhere' }}>{shortLinkedIn(p.linkedin)}</strong></>);

  const what = draft.kind === 'first' ? 'note' : 'message';
  const linkedInSteps = draft.kind === 'first'
    ? (liPage
      ? 'On their page press Connect, then Add a note, paste it and send.'
      : 'Open the person who decides, press Connect, then Add a note, paste it and send.')
    : 'Paste it in a message to them on LinkedIn and send.';

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
        {ways.length > 0 && <p className="rs-text">{orList(ways)}</p>}

        {editing ? (
          <div className="rs-form" style={{ alignItems: 'start' }}>
            {hasEmail && (
              <Field label="Subject" wide>
                <input className="field" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} />
              </Field>
            )}
            {editBody && (
              <Field label={hasEmail ? 'Email' : 'Message'} wide>
                <textarea className="field" rows={10} value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} />
              </Field>
            )}
            {editWa && (
              <Field label={hasWa ? 'On WhatsApp' : 'On LinkedIn'} wide
                hint={hasWa ? 'Shorter, as people write on WhatsApp.' : 'Sent as a message to them on LinkedIn.'}>
                <textarea className="field" rows={5} value={wa} onChange={(e) => setWa(e.target.value)} maxLength={1500} />
              </Field>
            )}
            {hasNote && (
              <Field label="LinkedIn note" wide
                hint={`Sent with your invitation to connect. ${note.length} of ${NOTE_MAX} characters, the most a free LinkedIn account takes (Premium takes 300).`}>
                <textarea className="field" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
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
              {liOnly && draft.kind === 'first' && draft.linkedin && <span className="rs-quote-label">Note to send with your invitation</span>}
              {main}
            </div>
            {hasEmail && hasWa && draft.whatsapp && (
              <details>
                <summary className="rs-text" style={{ display: 'flex', alignItems: 'center', minHeight: 44, cursor: 'pointer' }}>
                  The WhatsApp version
                </summary>
                <div className="rs-quote is-plain">{draft.whatsapp}</div>
              </details>
            )}
            {!liOnly && draft.linkedin && (
              <details>
                <summary className="rs-text" style={{ display: 'flex', alignItems: 'center', minHeight: 44, cursor: 'pointer' }}>
                  The LinkedIn note
                </summary>
                <div className="rs-quote is-plain">{draft.linkedin}</div>
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
              setNote(draft.linkedin ?? '');
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
              {showLi && liOpen && (
                <a className={`rs-btn ${liOnly && !opened ? 'is-navy' : 'is-quiet'}`} href={liOpen} target="_blank"
                  rel="noopener noreferrer" onClick={toLinkedIn}>
                  {liPage ? 'Open in LinkedIn' : 'Find on LinkedIn'}
                </a>
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
            {opened === 'linkedin' ? (
              <>
                <p className="rs-text is-quiet">
                  {copied === false
                    ? `Copy the ${what} below. `
                    : `The ${what} is copied. `}
                  {linkedInSteps} Then press I sent it here so AIBOS knows when to follow up.
                </p>
                {copied === false && <div className="rs-quote is-plain" style={{ userSelect: 'all' }}>{liText}</div>}
              </>
            ) : opened && (
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
