'use client';
/**
 * Find clients, Today: what needs the owner now (replies, messages ready to
 * send, follow-ups due), then the month's research and finding more.
 *
 * Priced the way Explee prices it (9 Nov 2026): Free gets one free day, the
 * paid plans a month's businesses, and anyone can top up by card. Someone new
 * starts with one line and one press ("Show me who could buy from me"): AIBOS
 * drafts the campaign from the line, finds businesses near them and
 * researches the first few, so the first visit ends with real messages to
 * read, not an empty list. Searches read AIBOS's own directory of places
 * first, so they answer in seconds.
 */
import { useState } from 'react';
import Link from 'next/link';
import Panel from '@/components/home/Panel';
import { Chip, Fact, Facts, Note } from '@/components/hospitality/kit';
import {
  fillClientCampaign, findClientsOnMap, importClientList, researchClients, saveClientCampaign,
  updateClientProspect, writeClientFollowups,
  type ClientCampaignFields, type ClientJob, type ClientStage, type ClientsFull,
} from '@/lib/api';
import { FIND_CLIENTS_PER_MONTH, FIND_CLIENTS_TRIAL, TIERS, isTier, nextTierUp } from '@/lib/tiers';
import CampaignForm, { EMPTY_CAMPAIGN } from './CampaignForm';
import DraftCard from './DraftCard';
import TopUp, { topupWords } from './TopUp';
import { addedWords, labelTone, plural, said, when, type Said } from './shared';

const JOB_MAX = 25;
const DEMO_RESEARCH = 10;
const DRAFTS_SHOWN = 8;
const MAX_FILE = 2_000_000;
/** About how long a search takes when the place is not held yet, for the bar. */
const MAP_SECONDS = 20;

/** "in 23 hours", "in 40 minutes": how long the free day has left. */
function endsIn(iso: string | null | undefined): string {
  const end = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(end)) return '';
  const minutes = Math.max(1, Math.round((end - Date.now()) / 60_000));
  return minutes >= 60 ? `in ${plural(Math.floor(minutes / 60), 'hour')}` : `in ${plural(minutes, 'minute')}`;
}

/**
 * A map search as it runs on the server, and what it found when it is done.
 * `fresh` is a search started on this visit: only then is a finished one
 * worth saying again.
 */
function SearchStatus({ job, kinds, fresh }: { job: ClientJob; kinds: Record<string, string>; fresh: boolean }) {
  const kindWord = ((job.kind && kinds[job.kind]) || 'businesses').toLowerCase();
  const found = job.found ?? 0;
  const more = job.more ?? 0;
  const foundLine = found === 0
    ? `No ${kindWord} with a name were found around ${job.town}. Try another kind of business or another town.`
    : `Found ${plural(found, 'place')} around ${job.town}: `
      + `${addedWords({ added: job.added ?? 0, known: job.known ?? 0, blocked: job.blocked ?? 0 })}.`
      + (more > 0 ? ` ${more.toLocaleString('en-GB')} more nearby: search again to add the next ones.` : '');

  if (job.running && job.phase !== 'research') {
    const started = job.started_at ? Date.parse(job.started_at) : NaN;
    const seconds = Number.isFinite(started) ? (Date.now() - started) / 1000 : 0;
    const width = Math.max(6, Math.min(92, Math.round((seconds / (job.waiting ? 600 : MAP_SECONDS)) * 100)));
    return (
      <>
        <p className="rs-text is-strong">Looking for {kindWord} around {job.town}.</p>
        <div className="rs-progress" role="progressbar" aria-label="Searching" aria-valuetext="Searching">
          <span style={{ width: `${width}%` }} />
        </div>
        <p className="rs-text is-quiet">
          {job.waiting && job.note
            ? `${job.note}${job.tries ? ` Asked ${plural(job.tries, 'time')} so far.` : ''}`
            : 'This usually takes a few seconds. You can leave this page; it carries on.'}
        </p>
      </>
    );
  }
  if (job.running) {
    return (
      <>
        <p className="rs-text">{foundLine}</p>
        <p className="rs-text is-strong">Reading websites and writing messages: {job.done} of {job.total} done.</p>
        <div className="rs-progress" role="progressbar" aria-label="Research"
          aria-valuemin={0} aria-valuemax={job.total} aria-valuenow={job.done}>
          <span style={{ width: `${job.total ? Math.round((job.done / job.total) * 100) : 0}%` }} />
        </div>
        <p className="rs-text is-quiet">
          {plural(job.written, 'message')} written so far. You can leave this page; it carries on.
        </p>
      </>
    );
  }
  if (!fresh) return null;
  if (job.error) {
    return <Note tone="bad">{job.phase === 'research' ? `${foundLine} ${job.error}` : job.error}</Note>;
  }
  if (job.phase === 'research') {
    return (
      <Note tone={job.written > 0 ? 'good' : 'info'}>
        {foundLine} AIBOS researched {job.done} and wrote {plural(job.written, 'message')}.
        {job.written > 0
          ? ' Read them under Ready to send, change anything you like, then send them yourself.'
          : ' None fit well enough to write to yet. Research the rest below.'}
      </Note>
    );
  }
  return <Note tone={found && job.added ? 'good' : 'info'}>{foundLine}</Note>;
}

export default function TodayTab({ home, reload, startedHere, onStarted }: {
  home: ClientsFull;
  reload: () => Promise<void>;
  /** A research run this visit started, so its result is worth saying. */
  startedHere: boolean;
  onStarted: () => void;
}) {
  const canWrite = home.can_write;
  const firstCampaign = home.campaigns.find((c) => c.status === 'active') ?? home.campaigns[0];

  // Start: one line to a campaign, or straight to the first customers.
  const [line, setLine] = useState('');
  const [filled, setFilled] = useState<ClientCampaignFields | null>(null);
  const [startNote, setStartNote] = useState<Said | null>(null);
  const [demo, setDemo] = useState(false);
  // The search whose result was put away with Done, so it is not said again below.
  const [putAway, setPutAway] = useState<string | null>(null);

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

  // The first-time demo: the campaign drafted from the line and saved (it can
  // be changed under Campaigns any time), then the map searched and the first
  // few researched, all on the server while the page reports.
  const showMe = () => step('demo', async () => {
    setStartNote(null);
    const fields = await fillClientCampaign(line.trim());
    const c = await saveClientCampaign(fields);
    const k = c.kinds?.[0] ?? fields.kinds?.[0] ?? Object.keys(home.kinds)[0];
    const t = c.towns?.[0] ?? fields.towns?.[0] ?? home.towns[0] ?? 'Lusaka';
    setCampaignId(c.id);
    setKind(k);
    setTown(t);
    setLine('');
    setDemo(true);
    try {
      await findClientsOnMap(k, t, c.id, true);
      onStarted();
    } finally {
      await reload();          // the campaign is saved either way
    }
  }, (text) => setStartNote({ tone: 'bad', text }), 'AIBOS could not start just now. Try again in a moment.');

  const job = home.job;
  const running = Boolean(job?.running);
  const searching = Boolean(job?.kind);      // a map search (perhaps going on to research), not research alone
  const waiting = home.counts.new ?? 0;
  const bal = home.usage;
  const next = Math.min(JOB_MAX, waiting, bal.left);
  const demoN = Math.min(home.demo_research ?? DEMO_RESEARCH, bal.left);

  // Where the businesses researched come from: the free day (Free), the
  // month (a paid plan), then top-ups bought by card. 9 Nov 2026.
  const trial = bal.trial;
  const month = bal.month ?? { allowed: bal.allowed, used: bal.used, left: Math.max(0, bal.allowed - bal.used) };
  const topup = bal.topup ?? { bought: 0, used: 0, left: 0 };
  const trialN = trial?.allowed ?? home.trial_research ?? FIND_CLIENTS_TRIAL.research;
  const [topping, setTopping] = useState(false);

  // The plan with more, for the line under the balance and when it is used up.
  const plan = isTier(home.plan) ? home.plan : 'free';
  const up = nextTierUp(plan);
  const upName = up ? TIERS[up].name : '';
  const upAllowed = up ? (home.allowances?.[up] ?? FIND_CLIENTS_PER_MONTH[up]) : 0;
  const packs = topupWords(home.topups ?? bal.topups);

  // What to say when nothing is left, and how to carry on.
  const usedUpHead = month.allowed > 0
    ? `This month's ${month.allowed.toLocaleString('en-GB')} are used.`
    : trial?.ended ? 'Your free day has ended.' : `Your free day's ${trialN} businesses are used.`;
  const usedUpWays = month.allowed > 0
    ? <>Top up to carry on now, wait for the 1st{up ? <> or move up to <Link href="/dashboard/billing">{upName}</Link> for {upAllowed} a month</> : null}.</>
    : <>Top up to carry on{up ? <> or choose <Link href="/dashboard/billing">{upName}</Link> for {upAllowed} a month</> : null}.</>;

  // The top-up, opened from the balance or from the used-up note. Owner
  // only: the business pays, and the route refuses staff.
  const topUpBlock = home.is_owner ? (
    topping ? (
      <div style={{ marginTop: 14 }}>
        <TopUp packs={home.topups ?? bal.topups} bought={topup.bought} reload={reload} onCancel={() => setTopping(false)} />
      </div>
    ) : (
      <div className="rs-btns" style={{ marginTop: 14 }}>
        <button type="button" className={bal.left > 0 ? 'rs-btn is-quiet' : 'rs-btn is-navy'} onClick={() => setTopping(true)}>
          Top up
        </button>
      </div>
    )
  ) : (
    <p className="rs-text is-quiet" style={{ marginTop: 12 }}>Ask the owner to top up when these run out.</p>
  );

  const research = () => step('research', async () => {
    setResearchNote(null);
    await researchClients(null);
    onStarted();
    await reload();
  }, (text) => setResearchNote({ tone: 'bad', text }), 'Research could not start just now. Try again in a moment.');

  const find = () => step('find', async () => {
    setFindNote(null);
    const got = await findClientsOnMap(kind, town, campaignId || null);
    if (got.already) {
      setFindNote({ tone: 'info', text: 'AIBOS is still on the last search or research. Search again when it is done.' });
    } else {
      onStarted();
    }
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
      {(home.campaigns.length === 0 || demo) && canWrite && (
        <Panel title={demo ? 'Your first customers' : 'Start here'}>
          {demo ? (
            <>
              {job && searching
                ? <SearchStatus job={job} kinds={home.kinds} fresh={startedHere} />
                : busy === 'demo' && <p className="rs-text is-strong">Starting the search.</p>}
              {job && searching && !running && (
                <p className="rs-text is-quiet" style={{ marginTop: 12 }}>
                  AIBOS saved what you sell as your first campaign. Change it any time under Campaigns.
                </p>
              )}
              {!running && busy === null && (
                <div className="rs-btns" style={{ marginTop: 14 }}>
                  <button type="button" className="rs-btn is-quiet"
                    onClick={() => { setDemo(false); setPutAway(job?.started_at ?? null); }}>Done</button>
                </div>
              )}
            </>
          ) : filled ? (
            <>
              <p className="rs-text" style={{ marginBottom: 18 }}>
                Check what AIBOS filled in and change anything that is not right. Every message is written from this.
              </p>
              <CampaignForm initial={filled} kinds={home.kinds} towns={home.towns} saveLabel="Save the campaign"
                onSave={saveFirst} onCancel={() => setFilled(null)} />
            </>
          ) : (
            <>
              <p className="rs-text">
                Say in a line what you sell and who to. AIBOS finds businesses near you that could buy, reads their
                websites and writes to the ones that fit. Nothing is sent until you send it yourself.
              </p>
              <div className="rs-form" style={{ marginTop: 14 }}>
                <label style={{ gridColumn: '1 / -1', minWidth: 0 }}>
                  <span className="field-label">What you sell and who to</span>
                  <input className="field" value={line} onChange={(e) => setLine(e.target.value)} maxLength={300}
                    placeholder="For example: office cleaning for lodges and offices in Lusaka"
                    onKeyDown={(e) => { if (e.key === 'Enter' && line.trim() && !busy && !running) void showMe(); }} />
                </label>
              </div>
              <div className="rs-btns" style={{ marginTop: 14 }}>
                <button type="button" className="rs-btn is-navy" onClick={() => void showMe()}
                  disabled={!line.trim() || busy !== null || running} aria-busy={busy === 'demo'}>
                  {busy === 'demo' ? 'Finding them' : 'Show me who could buy from me'}
                </button>
                <button type="button" className="rs-btn is-quiet" onClick={() => void fill()} disabled={!line.trim() || busy !== null}
                  aria-busy={busy === 'fill'}>
                  {busy === 'fill' ? 'Filling it in' : 'Check the details first'}
                </button>
                <button type="button" className="rs-btn is-quiet" onClick={() => setFilled({ ...EMPTY_CAMPAIGN })}>
                  Write it yourself
                </button>
              </div>
              {demoN > 0 && (
                <p className="rs-text is-quiet" style={{ marginTop: 12 }}>
                  {trial?.active && !trial.started_at
                    ? `Free for a day: Show me finds businesses near you and researches the first ${demoN}. Your free day starts with your first search and lasts ${trial.hours} hours.`
                    : trial?.active
                      ? `Show me finds businesses near you and researches the first ${demoN} of your free day's ${trialN}. It ends ${endsIn(trial.ends_at)}.`
                      : month.allowed > 0
                        ? `Show me finds businesses near you and researches the first ${demoN}, out of this month's ${month.allowed}.`
                        : `Show me finds businesses near you and researches the first ${demoN} from your top-ups.`}
                </p>
              )}
            </>
          )}
          {startNote && <Note tone={startNote.tone}>{startNote.text}</Note>}
        </Panel>
      )}
      {home.campaigns.length > 0 && !demo && startNote && <Note tone={startNote.tone}>{startNote.text}</Note>}

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
            AIBOS never sends for you. Each message opens in your own email, WhatsApp or LinkedIn and you press send there.
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

      <Panel title={trial && month.allowed === 0 ? (trial.active ? 'Your free day' : 'Your businesses') : 'This month'}>
        <Facts>
          {trial && month.allowed === 0 && (
            <Fact label="Free day" value={`${trial.used.toLocaleString('en-GB')} of ${trial.allowed.toLocaleString('en-GB')} researched`}
              hint={!trial.active ? 'Ended' : trial.started_at ? `Ends ${endsIn(trial.ends_at)}` : 'Starts with your first search'} />
          )}
          {month.allowed > 0 && (
            <Fact label="Researched" value={`${month.used.toLocaleString('en-GB')} of ${month.allowed.toLocaleString('en-GB')}`}
              hint={`${month.left.toLocaleString('en-GB')} left until the 1st`} />
          )}
          {(topup.bought > 0 || topup.left > 0) && (
            <Fact label="Topped up" value={`${topup.left.toLocaleString('en-GB')} left`} hint="They never run out" />
          )}
          <Fact label="Waiting to research" value={waiting.toLocaleString('en-GB')} />
          <Fact label="Waiting for an answer" value={(home.counts.contacted ?? 0).toLocaleString('en-GB')} />
          <Fact label="Interested" value={home.hot.toLocaleString('en-GB')} />
          <Fact label="Won" value={(home.counts.won ?? 0).toLocaleString('en-GB')} />
        </Facts>
        {home.is_owner && bal.left > 0 && (
          <p className="rs-text is-quiet" style={{ marginTop: 12 }}>
            {month.allowed > 0 ? 'Need more this month? Top up '
              : topup.left > 0 ? 'Top up more any time: '
                : trial?.active ? 'After your free day, top up ' : 'When these run out, top up '}
            {packs}.
            {up ? <> Or {month.allowed > 0 ? 'move up to' : 'choose'} {upName} for {upAllowed} a month. <Link href="/dashboard/billing">See the plans</Link></> : null}
          </p>
        )}
        {bal.left <= 0 && <Note tone="warn">{usedUpHead} {usedUpWays}</Note>}
        {/* One place for the top-up, so a payment that lands keeps its own "added" note. */}
        {topUpBlock}

        <div className="rs-sec">
          {running && job && !searching ? (
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
                {` ${home.write_from}`} or more.{' '}
                {bal.left > 0
                  ? `Each business researched uses one of the ${bal.left.toLocaleString('en-GB')} you have left.`
                  : 'Each business researched uses one credit.'}{' '}
                Finding businesses costs nothing.
              </p>
              {canWrite && (
                <div className="rs-btns" style={{ marginTop: 14 }}>
                  <button type="button" className="rs-btn is-navy" onClick={() => void research()}
                    disabled={next <= 0 || busy !== null || running} aria-busy={busy === 'research'}>
                    {busy === 'research' ? 'Starting' : next > 0 ? `Research the next ${next}` : 'Research'}
                  </button>
                </div>
              )}
              {bal.left > 0 && waiting === 0 && (
                <p className="rs-text is-quiet" style={{ marginTop: 12 }}>Nothing is waiting. Find businesses below first.</p>
              )}
              {startedHere && job && !searching && !job.error && job.total > 0 && (
                <Note tone="good">
                  Done: {plural(job.done, 'business', 'businesses')} researched and {plural(job.written, 'message')} written.
                  {job.written > 0 ? ' They are under Ready to send.' : ''}
                </Note>
              )}
            </>
          )}
          {job?.error && !searching && <Note tone="bad">{job.error}</Note>}
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
            <button type="button" className="rs-btn is-navy" onClick={() => void find()}
              disabled={!kind || !town || busy !== null || running}
              aria-busy={busy === 'find' || (running && searching && job?.phase === 'map')}>
              {busy === 'find' || (running && searching && job?.phase === 'map') ? 'Searching the map' : 'Search the map'}
            </button>
          </div>
          {job && searching && !demo && (running || (startedHere && job.started_at !== putAway)) && (
            <div style={{ marginTop: 14 }}>
              <SearchStatus job={job} kinds={home.kinds} fresh={startedHere} />
            </div>
          )}
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
