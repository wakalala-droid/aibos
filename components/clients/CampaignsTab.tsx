'use client';
/**
 * Find clients, Campaigns: what the owner sells and to whom, each with how
 * far it has got. AIBOS can draft one from a line; the owner checks it.
 */
import { useState } from 'react';
import Panel from '@/components/home/Panel';
import { Chip, Note } from '@/components/hospitality/kit';
import {
  deleteClientCampaign, fillClientCampaign, saveClientCampaign,
  type ClientCampaign, type ClientCampaignFields, type ClientsFull,
} from '@/lib/api';
import CampaignForm, { EMPTY_CAMPAIGN } from './CampaignForm';
import { said, type Said } from './shared';

function countsLine(c: ClientCampaign): string {
  const n = c.counts;
  if (!n) return '';
  const parts = [`${n.all.toLocaleString('en-GB')} ${n.all === 1 ? 'business' : 'businesses'}`];
  if (n.waiting) parts.push(`${n.waiting.toLocaleString('en-GB')} not researched`);
  if (n.contacted) parts.push(`${n.contacted.toLocaleString('en-GB')} written to`);
  if (n.replied) parts.push(`${n.replied.toLocaleString('en-GB')} wrote back`);
  if (n.won) parts.push(`${n.won.toLocaleString('en-GB')} won`);
  return parts.join(' · ');
}

export default function CampaignsTab({ home, reload }: { home: ClientsFull; reload: () => Promise<void> }) {
  const [line, setLine] = useState('');
  const [draft, setDraft] = useState<ClientCampaignFields | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Said | null>(null);
  const can = home.can_write;

  async function step(what: string, fn: () => Promise<string | null>) {
    setBusy(what);
    setNote(null);
    try {
      const text = await fn();
      if (text) setNote({ tone: 'good', text });
    } catch (e) {
      setNote({ tone: 'bad', text: said(e, 'That did not work just now. Try again in a moment.') });
    } finally {
      setBusy(null);
    }
  }

  const fill = () => step('fill', async () => {
    setDraft(await fillClientCampaign(line.trim()));
    return null;
  });

  async function saveNew(fields: ClientCampaignFields) {
    await saveClientCampaign(fields);
    setDraft(null);
    setLine('');
    setNote({ tone: 'good', text: `${fields.name} is saved. Find businesses for it on Today.` });
    await reload();
  }

  async function saveEdit(id: string, fields: ClientCampaignFields) {
    await saveClientCampaign(fields, id);
    setEditing(null);
    setNote({ tone: 'good', text: `${fields.name} is saved.` });
    await reload();
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {can && (
        <Panel title="New campaign">
          {draft ? (
            <>
              <p className="rs-text" style={{ marginBottom: 18 }}>Check it and change anything that is not right.</p>
              <CampaignForm initial={draft} kinds={home.kinds} towns={home.towns} saveLabel="Save the campaign"
                onSave={saveNew} onCancel={() => setDraft(null)} />
            </>
          ) : (
            <>
              <label style={{ display: 'block' }}>
                <span className="field-label">What you sell and who to</span>
                <input className="field" value={line} onChange={(e) => setLine(e.target.value)} maxLength={300}
                  placeholder="For example: stock counting for supermarkets in Kitwe and Ndola"
                  onKeyDown={(e) => { if (e.key === 'Enter' && line.trim() && !busy) void fill(); }} />
              </label>
              <div className="rs-btns" style={{ marginTop: 14 }}>
                <button type="button" className="rs-btn is-navy" onClick={() => void fill()} disabled={!line.trim() || busy !== null}
                  aria-busy={busy === 'fill'}>
                  {busy === 'fill' ? 'Filling it in' : 'Fill it in'}
                </button>
                <button type="button" className="rs-btn is-quiet" onClick={() => setDraft({ ...EMPTY_CAMPAIGN })}>
                  Write it yourself
                </button>
              </div>
            </>
          )}
        </Panel>
      )}

      {note && <Note tone={note.tone}>{note.text}</Note>}

      <Panel title={`Your campaigns (${home.campaigns.length})`}>
        {home.campaigns.length === 0 ? (
          <p className="rs-text is-quiet">
            None yet. A campaign tells AIBOS what you sell and who to, so it can judge each business and write to it.
          </p>
        ) : (
          <div className="rs-list">
            {home.campaigns.map((c) => (
              <article key={c.id} className="rs-row">
                <div className="rs-row-main">
                  <span className="rs-row-title">{c.name}</span>
                  <span className="rs-row-line">{countsLine(c) || c.offer || ''}</span>
                </div>
                {c.status === 'paused' && <Chip tone="off">Paused</Chip>}
                {(c.counts?.hot ?? 0) > 0 && <Chip tone="stay">{c.counts?.hot} interested</Chip>}
                {can && (
                  <div className="rs-btns" style={{ gap: 8 }}>
                    <button type="button" className="rs-btn is-quiet is-sm" aria-expanded={editing === c.id}
                      onClick={() => setEditing(editing === c.id ? null : c.id)}>
                      {editing === c.id ? 'Close' : 'Edit'}
                    </button>
                    <button type="button" className="rs-btn is-quiet is-sm" disabled={busy !== null}
                      onClick={() => void step(`pause-${c.id}`, async () => {
                        await saveClientCampaign({ status: c.status === 'paused' ? 'active' : 'paused' }, c.id);
                        await reload();
                        return c.status === 'paused' ? `${c.name} is active again.` : `${c.name} is paused.`;
                      })}>
                      {c.status === 'paused' ? 'Resume' : 'Pause'}
                    </button>
                    {home.is_owner && (confirm === c.id ? (
                      <>
                        <button type="button" className="rs-btn is-danger is-sm" disabled={busy !== null}
                          onClick={() => void step(`delete-${c.id}`, async () => {
                            await deleteClientCampaign(c.id);
                            setConfirm(null);
                            await reload();
                            return `${c.name} is deleted. Its businesses stay in your list.`;
                          })}>
                          Delete for good
                        </button>
                        <button type="button" className="rs-btn is-quiet is-sm" onClick={() => setConfirm(null)}>Keep it</button>
                      </>
                    ) : (
                      <button type="button" className="rs-btn is-quiet is-sm" onClick={() => setConfirm(c.id)}>Delete</button>
                    ))}
                  </div>
                )}
                {editing === c.id && (
                  <div style={{ flex: '1 1 100%', minWidth: 0, marginTop: 8 }}>
                    <CampaignForm initial={c} kinds={home.kinds} towns={home.towns}
                      onSave={(fields) => saveEdit(c.id, fields)} onCancel={() => setEditing(null)} />
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
