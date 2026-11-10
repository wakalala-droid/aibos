'use client';
/**
 * Find clients, Businesses: every business found, by stage. Open one to see
 * why it fits, write to it, paste what it wrote back, move it on, keep it
 * from ever being written to again, or delete its details for good.
 * Find on LinkedIn opens a search in the owner's own LinkedIn; the address
 * they find is pasted in Edit details (AIBOS never opens LinkedIn itself).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Panel from '@/components/home/Panel';
import { Chip, Fact, Facts, Note } from '@/components/hospitality/kit';
import {
  addClientProspect, deleteClientProspect, getClientProspect, listClientProspects, recordClientReply,
  saveClientSettings, updateClientProspect, writeClientMessage,
  type ClientMessage, type ClientProspect, type ClientStage, type ClientsFull,
} from '@/lib/api';
import {
  Field, KIND_WORDS, SOURCE_WORDS, STAGE_ORDER, STAGE_WORDS, clip, said, stageTone, when, type Said,
} from './shared';

const PAGE = 100;

export default function BusinessesTab({ home, reload }: { home: ClientsFull; reload: () => Promise<void> }) {
  const [stage, setStage] = useState<ClientStage | null>(null);
  const [campaignId, setCampaignId] = useState('');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<ClientProspect[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  // The list is read again when the counts move (research, a reply, a stage).
  const stamp = `${home.total}|${home.hot}|${STAGE_ORDER.map((s) => home.counts[s] ?? 0).join(',')}`;

  useEffect(() => {
    let alive = true;
    listClientProspects({ stage, campaign_id: campaignId || null })
      .then((r) => { if (alive) { setRows(r); setFailed(null); } })
      .catch((e) => { if (alive) setFailed(said(e, 'The list could not be loaded just now. Try again in a moment.')); });
    return () => { alive = false; };
  }, [stage, campaignId, stamp]);

  useEffect(() => { setShown(PAGE); }, [stage, campaignId, query]);

  const q = query.trim().toLowerCase();
  const list = useMemo(() => (rows ?? []).filter((p) => !q
    || [p.name, p.town, p.email, p.contact_name, p.phone, p.website, p.linkedin].some((v) => (v ?? '').toLowerCase().includes(q))),
  [rows, q]);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Panel
        title={`Your businesses (${home.total.toLocaleString('en-GB')})`}
        action={home.can_write ? (
          <button type="button" className="rs-btn is-quiet is-sm" onClick={() => setAdding(!adding)} aria-expanded={adding}>
            {adding ? 'Close' : 'Add one by hand'}
          </button>
        ) : undefined}
      >
        {adding && <AddOne home={home} onAdded={reload} />}

        <div className="chips" role="group" aria-label="Stage" style={{ marginTop: adding ? 20 : 0 }}>
          <button type="button" className="chip" aria-pressed={stage === null} onClick={() => setStage(null)}>
            All <span className="chip-count">{home.total.toLocaleString('en-GB')}</span>
          </button>
          {STAGE_ORDER.filter((s) => (home.counts[s] ?? 0) > 0 || s === stage).map((s) => (
            <button key={s} type="button" className="chip" aria-pressed={stage === s} onClick={() => setStage(s)}>
              {STAGE_WORDS[s]} <span className="chip-count">{(home.counts[s] ?? 0).toLocaleString('en-GB')}</span>
            </button>
          ))}
        </div>

        <div className="rs-form" style={{ marginTop: 16 }}>
          <label style={{ minWidth: 0 }}>
            <span className="field-label">Search</span>
            <input className="field" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, town, email or phone" />
          </label>
          {home.campaigns.length > 0 && (
            <label style={{ minWidth: 0 }}>
              <span className="field-label">Campaign</span>
              <select className="field" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
                <option value="">All campaigns</option>
                {home.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}
        </div>

        {failed && <Note tone="bad">{failed}</Note>}
        {!rows && !failed && <div className="skeleton" style={{ height: 180, marginTop: 16, borderRadius: 'var(--radius-lg)' }} />}
        {rows && list.length === 0 && (
          <p className="rs-text is-quiet" style={{ marginTop: 16 }}>
            {home.total === 0 ? 'No businesses yet. Find some on Today, or add one by hand.' : 'Nothing matches.'}
          </p>
        )}

        {list.length > 0 && (
          <div className="rs-list" style={{ marginTop: 16 }}>
            {list.slice(0, shown).map((p) => (
              <article key={p.id} className="rs-row">
                <div className="rs-row-main">
                  <span className="rs-row-title">{p.name}</span>
                  <span className="rs-row-line">
                    {[p.kind ? home.kinds[p.kind] ?? p.kind : null, p.town,
                      p.fit !== null && p.fit !== undefined ? `fit ${p.fit}` : null].filter(Boolean).join(' · ')}
                  </span>
                </div>
                {p.hot && <Chip tone="stay">Interested</Chip>}
                <Chip tone={stageTone(p.stage)}>{STAGE_WORDS[p.stage]}</Chip>
                <button type="button" className="rs-btn is-quiet is-sm" aria-expanded={open === p.id}
                  onClick={() => setOpen(open === p.id ? null : p.id)}>
                  {open === p.id ? 'Close' : 'Open'}
                </button>
                {open === p.id && (
                  <div style={{ flex: '1 1 100%', minWidth: 0 }}>
                    <ProspectDetail id={p.id} home={home} onChanged={reload}
                      onGone={() => { setOpen(null); setRows((r) => (r ?? []).filter((x) => x.id !== p.id)); void reload(); }} />
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
        {list.length > shown && (
          <div className="rs-btns" style={{ marginTop: 14 }}>
            <button type="button" className="rs-btn is-quiet" onClick={() => setShown(shown + PAGE)}>
              Show {Math.min(PAGE, list.length - shown)} more of {list.length.toLocaleString('en-GB')}
            </button>
          </div>
        )}
      </Panel>
    </div>
  );
}

function AddOne({ home, onAdded }: { home: ClientsFull; onAdded: () => Promise<void> }) {
  const blank = { name: '', email: '', phone: '', website: '', linkedin: '', town: '', contact_name: '', contact_role: '' };
  const [f, setF] = useState(blank);
  const [campaignId, setCampaignId] = useState(home.campaigns[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Said | null>(null);
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) { setNote({ tone: 'bad', text: 'A business needs a name.' }); return; }
    setBusy(true);
    setNote(null);
    try {
      const got = await addClientProspect({
        name: f.name.trim(), email: f.email.trim() || null, phone: f.phone.trim() || null, website: f.website.trim() || null,
        linkedin: f.linkedin.trim() || null, town: f.town.trim() || null, contact_name: f.contact_name.trim() || null,
        contact_role: f.contact_role.trim() || null, campaign_id: campaignId || null,
      });
      setNote(got.added
        ? { tone: 'good', text: `${f.name.trim()} is added. Research it from Today, or open it below to write to it now.` }
        : got.blocked
          ? { tone: 'warn', text: `${f.name.trim()} is on your do not contact list, so it was not added.` }
          : { tone: 'info', text: `${f.name.trim()} is already in your list.` });
      if (got.added) setF(blank);
      await onAdded();
    } catch (err) {
      setNote({ tone: 'bad', text: said(err, 'The business could not be added just now. Try again in a moment.') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={add} className="rs-sec" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
      <div className="rs-form" style={{ alignItems: 'start' }}>
        <Field label="Name"><input className="field" value={f.name} onChange={set('name')} maxLength={160} /></Field>
        <Field label="Email"><input className="field" type="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="Phone or WhatsApp"><input className="field" type="tel" value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Website"><input className="field" value={f.website} onChange={set('website')} placeholder="example.co.zm" /></Field>
        <Field label="LinkedIn"><input className="field" value={f.linkedin} onChange={set('linkedin')} placeholder="linkedin.com/company/their-name" /></Field>
        <Field label="Town">
          <input className="field" value={f.town} onChange={set('town')} list="clients-towns" />
          <datalist id="clients-towns">{home.towns.map((t) => <option key={t} value={t} />)}</datalist>
        </Field>
        <Field label="Who to write to"><input className="field" value={f.contact_name} onChange={set('contact_name')} /></Field>
        <Field label="Their role"><input className="field" value={f.contact_role} onChange={set('contact_role')} placeholder="Owner" /></Field>
        {home.campaigns.length > 0 && (
          <Field label="Campaign">
            <select className="field" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
              <option value="">None</option>
              {home.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}
      </div>
      {note && <Note tone={note.tone}>{note.text}</Note>}
      <div className="rs-btns" style={{ marginTop: 14 }}>
        <button type="submit" className="rs-btn is-navy" disabled={busy} aria-busy={busy}>{busy ? 'Adding' : 'Add the business'}</button>
      </div>
    </form>
  );
}

/** Where the do not contact list stops them: the email, the phone and their
 *  LinkedIn, else the website. */
function stopValues(p: ClientProspect): string[] {
  const out = [p.email, p.phone, p.linkedin].filter((v): v is string => Boolean(v)).map((v) => v.toLowerCase());
  if (!out.length && p.website) {
    try { out.push(new URL(p.website).hostname.replace(/^www\./, '').toLowerCase()); } catch { /* not a web address */ }
  }
  return out;
}

const SENT_ON: Record<string, string> = { email: ', sent by email', whatsapp: ', sent on WhatsApp', linkedin: ', sent on LinkedIn' };

function ProspectDetail({ id, home, onChanged, onGone }: {
  id: string;
  home: ClientsFull;
  onChanged: () => Promise<void>;
  onGone: () => void;
}) {
  const [data, setData] = useState<{ prospect: ClientProspect; messages: ClientMessage[] } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [note, setNote] = useState<Said | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [notes, setNotes] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ email: '', phone: '', website: '', linkedin: '', contact_name: '', contact_role: '' });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await getClientProspect(id);
      setData(d);
      setNotes(d.prospect.notes ?? '');
      setFailed(null);
    } catch (e) {
      setFailed(said(e, 'This business could not be opened just now. Try again in a moment.'));
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function act(what: string, fn: () => Promise<string | null>) {
    setBusy(what);
    setNote(null);
    try {
      const text = await fn();
      if (text) setNote({ tone: 'good', text });
      await load();
      await onChanged();
    } catch (e) {
      setNote({ tone: 'bad', text: said(e, 'That did not work just now. Try again in a moment.') });
    } finally {
      setBusy(null);
    }
  }

  if (failed) return <Note tone="bad">{failed}</Note>;
  if (!data) return <div className="skeleton" style={{ height: 160, marginTop: 8, borderRadius: 'var(--radius-lg)' }} />;

  const p = data.prospect;
  const can = home.can_write;
  const reachable = Boolean(p.email || p.whatsapp || p.linkedin);
  const campaign = home.campaigns.find((c) => c.id === p.campaign_id);
  const history = data.messages.filter((m) => m.status !== 'discarded');

  const moveTo = (s: ClientStage) => act(`stage-${s}`, async () => {
    await updateClientProspect(id, { stage: s });
    return `Moved to ${STAGE_WORDS[s]}.`;
  });

  return (
    <div style={{ display: 'grid', gap: 16, marginTop: 8 }}>
      {editing ? (
        <form className="rs-form" style={{ alignItems: 'start' }} onSubmit={(e) => {
          e.preventDefault();
          void act('details', async () => {
            await updateClientProspect(id, {
              email: form.email.trim() || null, phone: form.phone.trim() || null, website: form.website.trim() || null,
              linkedin: form.linkedin.trim() || null, contact_name: form.contact_name.trim() || null,
              contact_role: form.contact_role.trim() || null,
            });
            setEditing(false);
            return 'Saved.';
          });
        }}>
          <Field label="Email"><input className="field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Phone or WhatsApp"><input className="field" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Website"><input className="field" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></Field>
          <Field label="LinkedIn" hint="Their page or the profile of the person who decides.">
            <input className="field" value={form.linkedin} onChange={(e) => setForm({ ...form, linkedin: e.target.value })}
              placeholder="linkedin.com/in/their-name" />
          </Field>
          <Field label="Who to write to"><input className="field" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></Field>
          <Field label="Their role"><input className="field" value={form.contact_role} onChange={(e) => setForm({ ...form, contact_role: e.target.value })} /></Field>
          <div className="rs-btns" style={{ gridColumn: '1 / -1' }}>
            <button type="submit" className="rs-btn is-navy" disabled={busy !== null}>{busy === 'details' ? 'Saving' : 'Save'}</button>
            <button type="button" className="rs-btn is-quiet" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <Facts>
          <Fact label="Email" value={p.email ?? 'Not known'} />
          <Fact label="Phone" value={p.phone ? `${p.phone}${p.whatsapp ? ' (WhatsApp)' : ''}` : 'Not known'} />
          <Fact label="Website" value={p.website
            ? <a href={p.website} target="_blank" rel="noopener noreferrer">{p.website.replace(/^https?:\/\//, '')}</a>
            : 'None found'} />
          <Fact label="LinkedIn" value={p.linkedin
            ? <a href={p.linkedin} target="_blank" rel="noopener noreferrer" style={{ overflowWrap: 'anywhere' }}>
                {p.linkedin.replace(/^https?:\/\/(www\.)?/, '')}
              </a>
            : p.linkedin_search
              ? <a href={p.linkedin_search} target="_blank" rel="noopener noreferrer">Find on LinkedIn</a>
              : 'Not known'}
            hint={p.linkedin ? undefined : 'Opens in your own LinkedIn. Paste what you find in Edit details.'} />
          <Fact label="Who to write to" value={p.contact_name ? `${p.contact_name}${p.contact_role ? `, ${p.contact_role}` : ''}` : 'Not known'} />
          <Fact label="Fit" value={p.fit !== null && p.fit !== undefined ? `${p.fit} of 100` : 'Not researched yet'}
            hint={p.researched_at ? `Researched ${when(p.researched_at)}` : undefined} />
          <Fact label="Found" value={SOURCE_WORDS[p.source] ?? 'Added'} hint={campaign ? campaign.name : undefined} />
          {p.next_followup_at && <Fact label="Next follow-up" value={when(p.next_followup_at)} />}
        </Facts>
      )}

      {(p.summary || (p.fit_reasons ?? []).length > 0 || p.research_note) && (
        <div style={{ display: 'grid', gap: 8 }}>
          {p.summary && <p className="rs-text">{p.summary}</p>}
          {(p.fit_reasons ?? []).length > 0 && <p className="rs-text is-quiet">Why: {p.fit_reasons.join('; ')}.</p>}
          {p.research_note && <p className="rs-text is-quiet">{p.research_note}</p>}
        </div>
      )}

      {note && <Note tone={note.tone}>{note.text}</Note>}

      {can && (
        <div className="rs-btns">
          {reachable && !['won', 'lost'].includes(p.stage) && (
            <button type="button" className="rs-btn is-navy is-sm" disabled={busy !== null}
              onClick={() => void act('write', async () => {
                await writeClientMessage(id);
                return 'The message is ready on Today, under Ready to send.';
              })}>
              {busy === 'write' ? 'Writing' : 'Write a message'}
            </button>
          )}
          {!editing && (
            <button type="button" className="rs-btn is-quiet is-sm" onClick={() => {
              setForm({ email: p.email ?? '', phone: p.phone ?? '', website: p.website ?? '', linkedin: p.linkedin ?? '',
                contact_name: p.contact_name ?? '', contact_role: p.contact_role ?? '' });
              setEditing(true);
            }}>Edit details</button>
          )}
          <button type="button" className="rs-btn is-quiet is-sm" disabled={busy !== null}
            onClick={() => void act('hot', async () => {
              await updateClientProspect(id, { hot: !p.hot });
              return p.hot ? 'No longer marked interested.' : 'Marked interested.';
            })}>
            {p.hot ? 'Not interested after all' : 'Mark interested'}
          </button>
          {p.stage !== 'meeting' && <button type="button" className="rs-btn is-quiet is-sm" disabled={busy !== null} onClick={() => void moveTo('meeting')}>Meeting booked</button>}
          {p.stage !== 'won' && <button type="button" className="rs-btn is-quiet is-sm" disabled={busy !== null} onClick={() => void moveTo('won')}>Won</button>}
          {p.stage !== 'lost' && <button type="button" className="rs-btn is-quiet is-sm" disabled={busy !== null} onClick={() => void moveTo('lost')}>Lost</button>}
          {!['skipped', 'won', 'lost'].includes(p.stage) && (
            <button type="button" className="rs-btn is-quiet is-sm" disabled={busy !== null} onClick={() => void moveTo('skipped')}>Skip</button>
          )}
        </div>
      )}

      {can && p.stage !== 'lost' && (
        <div>
          <label style={{ display: 'block' }}>
            <span className="field-label">Paste what they wrote back</span>
            <textarea className="field" rows={4} value={reply} onChange={(e) => setReply(e.target.value)} maxLength={20000} />
          </label>
          <p className="rs-text is-quiet" style={{ marginTop: 6 }}>
            AIBOS says what it means, moves the business on and writes your answer. Asked to stop means never again.
          </p>
          <div className="rs-btns" style={{ marginTop: 12 }}>
            <button type="button" className="rs-btn is-quiet is-sm" disabled={!reply.trim() || busy !== null}
              onClick={() => void act('reply', async () => {
                const got = await recordClientReply(id, reply);
                setReply('');
                return `AIBOS read it as: ${got.label_words}.${got.draft ? ' Your answer is ready on Today.' : ''}${
                  got.label === 'unsubscribe' ? ' They are on your do not contact list now.' : ''}`;
              })}>
              {busy === 'reply' ? 'Reading it' : 'Read their reply'}
            </button>
          </div>
        </div>
      )}

      {can && (
        <div>
          <label style={{ display: 'block' }}>
            <span className="field-label">Your notes</span>
            <textarea className="field" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
          </label>
          {notes !== (p.notes ?? '') && (
            <div className="rs-btns" style={{ marginTop: 12 }}>
              <button type="button" className="rs-btn is-quiet is-sm" disabled={busy !== null}
                onClick={() => void act('notes', async () => { await updateClientProspect(id, { notes }); return 'Notes saved.'; })}>
                {busy === 'notes' ? 'Saving' : 'Save notes'}
              </button>
            </div>
          )}
        </div>
      )}
      {!can && p.notes && <p className="rs-text" style={{ whiteSpace: 'pre-wrap' }}>{p.notes}</p>}

      {history.length > 0 && (
        <div>
          <span className="field-label">What was said</span>
          <ul className="rs-timeline" style={{ marginTop: 8 }}>
            {history.map((m) => (
              <li key={m.id}>
                <span className={`rs-dot${m.direction === 'in' ? '' : m.status === 'draft' ? ' is-off' : ''}`} aria-hidden="true" />
                <div style={{ minWidth: 0 }}>
                  <div className="rs-tl-what">
                    {m.direction === 'in'
                      ? `They wrote${m.label ? `: ${home.labels[m.label] ?? m.label}` : ''}`
                      : `${KIND_WORDS[m.kind]}${m.status === 'draft' ? ', waiting for you' : SENT_ON[m.channel] ?? SENT_ON.email}`}
                  </div>
                  <div className="rs-tl-when">{when(m.sent_at ?? m.created_at)}</div>
                  <p className="rs-text is-quiet" style={{ marginTop: 4, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{clip(m.body, 280)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {home.is_owner && (
        <div className="rs-actions" style={{ marginTop: 4 }}>
          <p className="rs-text">If they asked not to be contacted, or want their details removed:</p>
          <div className="rs-btns">
            {stopValues(p).length > 0 && (
              <button type="button" className="rs-btn is-quiet is-sm" disabled={busy !== null}
                onClick={() => void act('stop', async () => {
                  const have = home.settings.do_not_contact ?? [];
                  const add = stopValues(p).filter((v) => !have.includes(v));
                  if (add.length) await saveClientSettings({ do_not_contact: [...have, ...add] });
                  if (p.stage !== 'lost') await updateClientProspect(id, { stage: 'lost' });
                  return `${p.name} will never be written to or added again.`;
                })}>
                Never contact again
              </button>
            )}
            {confirmDelete ? (
              <>
                <button type="button" className="rs-btn is-danger is-sm" disabled={busy !== null}
                  onClick={async () => {
                    setBusy('delete');
                    try {
                      await deleteClientProspect(id);
                      onGone();
                    } catch (e) {
                      setNote({ tone: 'bad', text: said(e, 'The details could not be deleted just now. Try again in a moment.') });
                      setBusy(null);
                    }
                  }}>
                  {busy === 'delete' ? 'Deleting' : 'Delete for good'}
                </button>
                <button type="button" className="rs-btn is-quiet is-sm" onClick={() => setConfirmDelete(false)}>Keep them</button>
              </>
            ) : (
              <button type="button" className="rs-btn is-quiet is-sm" onClick={() => setConfirmDelete(true)}>Delete their details</button>
            )}
          </div>
          {confirmDelete && (
            <p className="rs-text is-quiet" style={{ marginTop: 10 }}>
              This deletes the business and every message with it. To also keep it from being found again, press Never
              contact again first.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
