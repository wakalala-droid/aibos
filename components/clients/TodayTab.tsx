'use client';
/**
 * Find clients, Today: what needs the owner now (replies, messages ready to
 * send, follow-ups due), then the month's research and finding more.
 */
import { useState } from 'react';
import Panel from '@/components/home/Panel';
import { Chip, Fact, Facts, Note } from '@/components/hospitality/kit';
import {
  fillClientCampaign, findClientsOnMap, importClientList, researchClients, saveClientCampaign,
  updateClientProspect, writeClientFollowups,
  type ClientCampaignFields, type ClientStage, type ClientsFull,
} from '@/lib/api';
import CampaignForm, { EMPTY_CAMPAIGN } from './CampaignForm';
import DraftCard from './DraftCard';
import { addedWords, labelTone, plural, said, when, type Said } from './shared';

const JOB_MAX = 25;
const DRAFTS_SHOWN = 8;
const MAX_FILE = 2_000_000;

export default function TodayTab({ home, reload, startedHere, onStarted }: {
  home: ClientsFull;
  reload: () => Promise<void>;
  /** A research run this visit started, so its result is worth saying. */
  startedHere: boolean;
  onStarted: () => void;
}) {
  const canWrite = home.can_write;
  const firstCampaign = home.campaigns.find((c) => c.status === 'active') ?? home.campaigns[0];

  // Start: one line to a campaign.
  const [line, setLine] = useState('');
  const [filled, setFilled] = useState<ClientCampaignFields | null>(null);
  const [startNote, setStartNote] = useState<Said | null>(null);

  // Research.
  const [researchNote, setResearchNote] = useState<Said | null>(null);

  // Find.
  const [kind, setKind] = useState(firstCampaign?.kinds[0] ?? Object.keys(home.kinds)[0] ?? '');
  const [town, setTown] = useState(firstCampaign?.towns[0] ?? home.towns[0] ?? 'Lusaka');
  const [campaignId, setCampaignId] = useState(firstCampaign?.id ?? '');
  const [findNote, setFindNote] = useState<Said | null>(null);
  const [list, setList] = useState('');
  const [listNote, setListNote] = useState<Said | null>(null);

  const [followNote, setFollowNote] = useState<Said | null>(null);
  const [needNote, setNeedNote] = useState<Said | null>(null);
  const [allDrafts, setAllDrafts] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function step(what: string, fn: () => Promise<void>, fail: (text: string) => void, fallback: string) {
    setBusy(what);
    try {
      await fn();
    } catch (e) {
      fail(said(e, fallback));
    } finally {
      setBusy(null);
    }
  }

  const fill = () => step('fill', async () => {
    setStartNote(null);
    setFilled(await fillClientCampaign(line.trim()));
  }, (text) => setStartNote({ tone: 'bad', text }), 'AIBOS could not fill it in just now. Write it yourself or try again in a moment.');

  async function saveFirst(fields: ClientCampaignFields) {
    const c = await saveClientCampaign(fields);
    setFilled(null);
    setLine('');
    setCampaignId(c.id);
    if (c.kinds?.[0]) setKind(c.kinds[0]);
    if (c.towns?.[0]) setTown(c.towns[0]);
    setStartNote({ tone: 'good', text: 'Saved. Now find businesses for it below.' });
    await reload();
  }

  const job = home.job;
  const running = Boolean(job?.running);
  const waiting = home.counts.new ?? 0;
  const next = Math.min(JOB_MAX, waiting, home.usage.left);

  const research = () => step('research', async () => {
    setResearchNote(null);
    await researchClients(null);
    onStarted();
    await reload();
  }, (text) => setResearchNote({ tone: 'bad', text }), 'Research could not start just now. Try again in a moment.');

  const find = () => step('find', async () => {
    setFindNote(null);
    const got = await findClientsOnMap(kind, town, campaignId || null);
    const kindWord = (home.kinds[kind] ?? 'businesses').toLowerCase();
    setFindNote(got.found === 0
      ? { tone: 'info', text: `No ${kindWord} with a name were found around ${town}. Try another kind of business or another town.` }
      : { tone: got.added ? 'good' : 'info', text: `Found ${plural(got.found, 'place')} around ${town}: ${addedWords(got)}.` });
    await reload();
  }, (text) => setFindNote({ tone: 'bad', text }), 'The map could not be searched just now. Try again in a minute.');

  const addList = () => step('list', async () => {
    setListNote(null);
    const got = await importClientList(list, campaignId || null);
    setListNote({ tone: got.added ? 'good' : 'info', text: `Read ${plural(got.read, 'business', 'businesses')}: ${addedWords(got)}.` });
    setList('');
    await reload();
  }, (text) => setListNote({ tone: 'bad', text }), 'The list could not be added just now. Try again in a moment.');

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > MAX_FILE) {
      setListNote({ tone: 'bad', text: 'That file is too big. Send up to 2,000 businesses at a time.' });
      return;
    }
    f.text().then((t) => { setList(t); setListNote(null); })
      .catch(() => setListNote({ tone: 'bad', text: 'That file could not be read. Save it as CSV and try again.' }));
  }

  const followups = () => step('followups', async () => {
    setFollowNote(null);
    const n = await writeClientFollowups();
    setFollowNote({ tone: n ? 'good' : 'info', text: n
      ? `Wrote ${plural(n, 'follow-up')}. ${n === 1 ? 'It is' : 'They are'} under Ready to send.`
      : 'No follow-ups were due after all.' });
    await reload();
  }, (text) => setFollowNote({ tone: 'bad', text }), 'The follow-ups could not be written just now. Try again in a moment.');

  const move = (id: string, stage: ClientStage) => step(`move-${id}`, async () => {
    setNeedNote(null);
    await updateClientProspect(id, { stage });
    await reload();
  }, (text) => setNeedNote({ tone: 'bad', text }), 'That could not be saved just now. Try again in a moment.');

  const drafts = allDrafts ? home.drafts : home.drafts.slice(0, DRAFTS_SHOWN);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {home.campaigns.length === 0 && canWrite && (
        <Panel title="Start here">
          {filled ? (
            <>
              <p className="rs-text" style={{ marginBottom: 18 }}>
                Check what AIBOS filled in and change anything that is not right. Every message is written from this.
              </p>
              <CampaignForm initial={filled} kinds={home.kinds} towns={home.towns} saveLabel="Save the campaign"
                onSave={saveFirst} onCancel={() => setFilled(null)} />
            </>
          ) : (
            <>
              <p className="rs-text">Say in a line what you sell and who to. AIBOS fills in the rest for you to check.</p>
              <div className="rs-form" style={{ marginTop: 14 }}>
                <label style={{ gridColumn: '1 / -1', minWidth: 0 }}>
                  <span className="field-label">What you sell and who to</span>
                  <input className="field" value={line} onChange={(e) => setLine(e.target.value)} maxLength={300}
                    placeholder="For example: accounting software for hardware shops in Lusaka"
                    onKeyDown={(e) => { if (e.key === 'Enter' && line.trim() && !busy) void fill(); }} />
                </label>
              </div>
              <div className="rs-btns" style={{ marginTop: 14 }}>
                <button type="button" className="rs-btn is-navy" onClick={() => void fill()} disabled={!line.trim() || busy !== null}
                  aria-busy={busy === 'fill'}>
                  {busy === 'fill' ? 'Filling it in' : 'Fill it in'}
                </button>
                <button type="button" className="rs-btn is-quiet" onClick={() => setFilled({ ...EMPTY_CAMPAIGN })}>
                  Write it yourself
                </button>
              </div>
            </>
          )}
          {startNote && <Note tone={startNote.tone}>{startNote.text}</Note>}
        </Panel>
      )}
      {home.campaigns.length > 0 && startNote && <Note tone={startNote.tone}>{startNote.text}</Note>}

      {home.needs_you.length > 0 && (
        <Panel title={`Wrote back (${home.needs_you.length})`}>
          <div className="rs-list">
            {home.needs_you.map((n) => (
              <article key={n.prospect.id} className="rs-row" style={{ alignItems: 'flex-start', padding: '16px 18px' }}>
                <div className="rs-row-main">
                  <span className="rs-row-title">{n.prospect.name}</span>
                  <span className="rs-row-line">
                    {[n.prospect.contact_name, n.prospect.town, when(n.reply.at)].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <Chip tone={labelTone(n.reply.label)}>{n.reply.label_words || 'Wrote back'}</Chip>
                <div style={{ flex: '1 1 100%', minWidth: 0, display: 'grid', gap: 12 }}>
                  <div className="rs-quote"><span className="rs-quote-label">They wrote</span>{n.reply.body}</div>
                  {n.answer_waiting && <p className="rs-text is-quiet">Your answer is ready under Ready to send.</p>}
                  {canWrite && (
                    <div className="rs-btns">
                      <button type="button" className="rs-btn is-quiet is-sm" disabled={busy !== null}
                        onClick={() => void move(n.prospect.id, 'meeting')}>Meeting booked</button>
                      <button type="button" className="rs-btn is-quiet is-sm" disabled={busy !== null}
                        onClick={() => void move(n.prospect.id, 'won')}>Won</button>
                      <button type="button" className="rs-btn is-quiet is-sm" disabled={busy !== null}
                        onClick={() => void move(n.prospect.id, 'lost')}>Lost</button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
          {needNote && <Note tone={needNote.tone}>{needNote.text}</Note>}
        </Panel>
      )}

      {home.drafts.length > 0 && (
        <Panel title={`Ready to send (${home.drafts.length})`}>
          <p className="rs-text is-quiet" style={{ marginBottom: 14 }}>
            AIBOS never sends for you. Each message opens in your own email or WhatsApp and you press send there.
          </p>
          <div className="rs-list" style={{ gap: 12 }}>
            {drafts.map((d) => (
              <DraftCard key={d.id} draft={d} kinds={home.kinds} canWrite={canWrite} onDone={reload} />
            ))}
          </div>
          {home.drafts.length > DRAFTS_SHOWN && (
            <div className="rs-btns" style={{ marginTop: 14 }}>
              <button type="button" className="rs-btn is-quiet" onClick={() => setAllDrafts(!allDrafts)}>
                {allDrafts ? 'Show fewer' : `Show all ${home.drafts.length}`}
              </button>
            </div>
          )}
        </Panel>
      )}

      {home.followups_due > 0 && (
        <Panel title="Follow-ups due">
          <p className="rs-text">
            {plural(home.followups_due, 'business', 'businesses')} did not answer yet. AIBOS can write the next message to
            {home.followups_due === 1 ? ' it' : ' each'}.
          </p>
          {canWrite && (
            <div className="rs-btns" style={{ marginTop: 14 }}>
              <button type="button" className="rs-btn is-navy" onClick={() => void followups()} disabled={busy !== null}
                aria-busy={busy === 'followups'}>
                {busy === 'followups' ? 'Writing them' : 'Write them'}
              </button>
            </div>
          )}
          {followNote && <Note tone={followNote.tone}>{followNote.text}</Note>}
        </Panel>
      )}
      {home.followups_due === 0 && followNote && <Note tone={followNote.tone}>{followNote.text}</Note>}

      <Panel title="This month">
        <Facts>
          <Fact label="Researched" value={`${home.usage.used.toLocaleString('en-GB')} of ${home.usage.allowed.toLocaleString('en-GB')}`}
            hint={`${home.usage.left.toLocaleString('en-GB')} left until the 1st`} />
          <Fact label="Waiting to research" value={waiting.toLocaleString('en-GB')} />
          <Fact label="Waiting for an answer" value={(home.counts.contacted ?? 0).toLocaleString('en-GB')} />
          <Fact label="Interested" value={home.hot.toLocaleString('en-GB')} />
          <Fact label="Won" value={(home.counts.won ?? 0).toLocaleString('en-GB')} />
        </Facts>

        <div className="rs-sec">
          {running && job ? (
            <>
              <p className="rs-text is-strong">
                Reading websites and writing messages: {job.done} of {job.total} done.
              </p>
              <div className="rs-progress" role="progressbar" aria-label="Research"
                aria-valuemin={0} aria-valuemax={job.total} aria-valuenow={job.done}>
                <span style={{ width: `${job.total ? Math.round((job.done / job.total) * 100) : 0}%` }} />
              </div>
              <p className="rs-text is-quiet">
                {plural(job.written, 'message')} written so far. You can leave this page; it carries on.
              </p>
            </>
          ) : (
            <>
              <p className="rs-text">
                AIBOS reads each website, scores the fit from 0 to 100 and writes the first message to those that score
                {` ${home.write_from}`} or more. Each business researched counts toward this month&apos;s {home.usage.allowed}.
              </p>
              {canWrite && (
                <div className="rs-btns" style={{ marginTop: 14 }}>
                  <button type="button" className="rs-btn is-navy" onClick={() => void research()}
                    disabled={next <= 0 || busy !== null} aria-busy={busy === 'research'}>
                    {busy === 'research' ? 'Starting' : next > 0 ? `Research the next ${next}` : 'Research'}
                  </button>
                </div>
              )}
              {home.usage.left <= 0 && (
                <Note tone="warn">This month&apos;s {home.usage.allowed} are used. More can be researched from the 1st.</Note>
              )}
              {home.usage.left > 0 && waiting === 0 && (
                <p className="rs-text is-quiet" style={{ marginTop: 12 }}>Nothing is waiting. Find businesses below first.</p>
              )}
              {startedHere && job && !job.error && job.total > 0 && (
                <Note tone="good">
                  Done: {plural(job.done, 'business', 'businesses')} researched and {plural(job.written, 'message')} written.
                  {job.written > 0 ? ' They are under Ready to send.' : ''}
                </Note>
              )}
            </>
          )}
          {job?.error && <Note tone="bad">{job.error}</Note>}
          {researchNote && <Note tone={researchNote.tone}>{researchNote.text}</Note>}
          {!home.ai && (
            <Note tone="info">
              The AI is not connected right now, so AIBOS judges the fit by its rules and writes in its standard words.
              Read each message before you send it.
            </Note>
          )}
        </div>
      </Panel>

      {canWrite && (
        <Panel title="Find businesses">
          <div className="rs-form">
            <label style={{ minWidth: 0 }}>
              <span className="field-label">Kind of business</span>
              <select className="field" value={kind} onChange={(e) => setKind(e.target.value)}>
                {Object.entries(home.kinds).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </label>
            <label style={{ minWidth: 0 }}>
              <span className="field-label">Around</span>
              <select className="field" value={town} onChange={(e) => setTown(e.target.value)}>
                {home.towns.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            {home.campaigns.length > 0 && (
              <label style={{ minWidth: 0 }}>
                <span className="field-label">For the campaign</span>
                <select className="field" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
                  <option value="">None</option>
                  {home.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            )}
          </div>
          <div className="rs-btns" style={{ marginTop: 14 }}>
            <button type="button" className="rs-btn is-navy" onClick={() => void find()} disabled={!kind || !town || busy !== null}
              aria-busy={busy === 'find'}>
              {busy === 'find' ? 'Searching the map' : 'Search the map'}
            </button>
          </div>
          {findNote && <Note tone={findNote.tone}>{findNote.text}</Note>}
          <p className="rs-text is-quiet" style={{ marginTop: 12 }}>
            Places come from OpenStreetMap. Map data © OpenStreetMap contributors.
          </p>

          <div className="rs-sec">
            <h3 className="rs-sec-title" style={{ marginBottom: 8 }}>Or add your own list</h3>
            <p className="rs-text is-quiet" style={{ marginBottom: 12 }}>
              One business a line (name, email, phone, website), or a CSV with headings. Anyone already in your list or
              on your do not contact list is left out.
            </p>
            <textarea className="field" rows={5} value={list} onChange={(e) => setList(e.target.value)}
              aria-label="Your list of businesses"
              placeholder={'Example Hardware, sales@example.com, 0977 000000\nExample Wholesalers, 0966 000000'} />
            <div className="rs-btns" style={{ marginTop: 14 }}>
              <button type="button" className="rs-btn is-navy" onClick={() => void addList()} disabled={!list.trim() || busy !== null}
                aria-busy={busy === 'list'}>
                {busy === 'list' ? 'Adding them' : 'Add these'}
              </button>
              <label className="rs-btn is-quiet" style={{ cursor: 'pointer', position: 'relative' }}>
                Upload a CSV
                <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={onFile}
                  style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }} />
              </label>
            </div>
            {listNote && <Note tone={listNote.tone}>{listNote.text}</Note>}
          </div>
        </Panel>
      )}
    </div>
  );
}
