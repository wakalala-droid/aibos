'use client';
/**
 * AIBOS team (Jarvis phase 4, 17 November 2026): mission control for the
 * work AIBOS does for the owner.
 *
 * The Assistant does the jobs the owner asks for, typed or spoken (aibos-api
 * actions.py). Six workers look through the books every few hours and put
 * what they find forward, each waiting for a yes (workers.py). This page shows
 * them all at once: the map, what is waiting with its answers, one card per
 * worker with what it did this week and its last job, the Assistant's earned
 * "do these yourself" switch, and the week's record of every job.
 *
 * Owner only (the API refuses everyone else) and on plans where AIBOS does
 * jobs (Pro+). Before migration 0047 the page says what is missing.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import FeatureGate from '@/components/ui/FeatureGate';
import Panel from '@/components/home/Panel';
import { BentoCard } from '@/components/kit';
import { Note } from '@/components/hospitality/kit';
import ActionCard from '@/components/chat/ActionCard';
import TeamMap, { WORKER_ICONS, workerState } from '@/components/team/TeamMap';
import type { ActionVerb } from '@/lib/aiAssistant';
import { useAiAssistant } from '@/lib/aiAssistant';
import {
  ApiError, approveAction, declineAction, getTeam, listRecentActions, listWaitingActions, runWorkers,
  setAutopilot, undoAction, type AiAction, type AiAutopilotKind, type AiTeam, type AiWorker,
} from '@/lib/api';
import { useIosApp } from '@/lib/iosApp';
import { timeAgo } from '@/lib/notifications';
import { useStore } from '@/lib/store';
import { fmt } from '@/lib/utils';

const STATE_WORDS: Record<AiAction['status'], string> = {
  waiting: 'waiting for your yes', done: 'done', declined: 'you said not now', undone: 'taken back',
  failed: 'could not be done', expired: 'no longer needed',
};
const ENTRY_WORDS: Record<string, string> = {
  Sale: 'sales', Expense: 'expenses', Purchase: 'stock bought', CustomerPayment: 'payments in',
  SupplierPayment: 'payments to suppliers', Refund: 'refunds',
};

function listWords(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function hour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

/** A small figure in a .mini-stat: a quiet label over the number. */
function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mini-stat">
      <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>{label}</span>
      <span className="tnum" style={{ fontSize: 'var(--fs-h3)', fontWeight: 600, color: 'var(--text-1)' }}>{children}</span>
    </div>
  );
}

export default function TeamPage() {
  const sym = useStore((s) => s.currencySymbol) || 'K';
  const ios = useIosApp();
  const { setOpen } = useAiAssistant();
  const [team, setTeam] = useState<AiTeam | null>(null);
  const [waiting, setWaiting] = useState<AiAction[]>([]);
  const [recent, setRecent] = useState<AiAction[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [said, setSaid] = useState<{ tone: 'good' | 'warn' | 'bad'; text: string } | null>(null);
  const waitingRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const [t, w, r] = await Promise.all([getTeam(), listWaitingActions(), listRecentActions(40)]);
      setFailed(null);
      setTeam(t);
      // Keep answered jobs on screen until the next visit (their message, their Undo).
      setWaiting((prev) => [...prev.filter((j) => j.status !== 'waiting'), ...[...w].reverse()]);
      setRecent(r);
    } catch (e) {
      setFailed(e instanceof ApiError && e.status === 503 ? e.message
        : e instanceof ApiError && e.status === 403 ? 'This page is for the owner of the business.'
        : 'Your AIBOS team could not be read just now. Try again in a moment.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const byId = useMemo(() => new Map((team?.workers ?? []).map((w) => [w.id, w])), [team]);
  const whose = (job: AiAction) => job.worker?.id ?? 'assistant';
  const shown = picked ? waiting.filter((j) => whose(j) === picked) : waiting;
  const open = waiting.filter((j) => j.status === 'waiting').length;
  const doneThisWeek = (team?.workers ?? []).reduce((n, w) => n + w.done_this_week, 0);
  // Newest answer first: `at` is when it was decided (or asked, if never).
  const when = (j: AiAction) => Date.parse(j.at ?? '') || 0;
  const history = recent.filter((j) => j.status !== 'waiting').sort((a, b) => when(b) - when(a)).slice(0, 15);

  function pick(id: string | null) {
    setPicked(id);
    if (id) waitingRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  async function answer(id: string, verb: ActionVerb) {
    setBusy(id);
    setSaid(null);
    try {
      const run = verb === 'yes' ? approveAction : verb === 'no' ? declineAction : undoAction;
      const job = await run(id);
      setWaiting((prev) => (verb === 'no' ? prev.filter((j) => j.id !== id) : prev.map((j) => (j.id === id ? job : j))));
      if (verb === 'yes' && job.offer_autopilot) setSaid({ tone: 'good', text: job.offer_autopilot.said });
      if (verb === 'yes' && job.link?.href) { window.location.assign(job.link.href); return; }
      const [t, r] = await Promise.all([getTeam(), listRecentActions(40)]);
      setTeam(t);
      setRecent(r);
    } catch (e) {
      setSaid({ tone: 'bad', text: e instanceof ApiError ? e.message : 'That did not go through. Try again in a moment.' });
      load();
    } finally {
      setBusy(null);
    }
  }

  async function checkNow() {
    setChecking(true);
    setSaid(null);
    try {
      const out = await runWorkers();
      setSaid(out.new
        ? { tone: 'good', text: `${out.new} new ${out.new === 1 ? 'thing needs' : 'things need'} you.` }
        : { tone: 'good', text: 'Nothing new. Everything that needs you is on this page.' });
      await load();
    } catch (e) {
      setSaid({ tone: 'bad', text: e instanceof ApiError ? e.message : 'AIBOS could not look just now. Try again in a moment.' });
    } finally {
      setChecking(false);
    }
  }

  async function switchAutopilot(kind: string, on: boolean) {
    setBusy(`auto-${kind}`);
    setSaid(null);
    try {
      await setAutopilot(kind, on);
      setSaid({ tone: 'good', text: on
        ? 'Done. AIBOS records entries like the ones you approved by itself now. Undo is always there.'
        : 'Done. AIBOS asks you before every entry again.' });
      setTeam(await getTeam());
    } catch (e) {
      setSaid({ tone: 'bad', text: e instanceof ApiError ? e.message : 'That did not go through. Try again in a moment.' });
    } finally {
      setBusy(null);
    }
  }

  function autopilotLine(a: AiAutopilotKind) {
    const types = listWords(a.types.map((t) => ENTRY_WORDS[t] ?? t.toLowerCase()));
    if (a.on) {
      return (
        <>
          <p className="team-last">Records {types || 'entries'} by itself, up to {fmt(a.largest, false, sym)} each. Anything else it asks.</p>
          <button type="button" className="pill pill-quiet" style={{ minHeight: 44, marginTop: 12 }}
            disabled={busy === `auto-${a.kind}`} onClick={() => switchAutopilot(a.kind, false)}>Ask me first again</button>
        </>
      );
    }
    if (a.earned) {
      return (
        <>
          <p className="team-last">You said yes {a.approved_in_a_row} times in a row. It can record {types || 'entries'} like these by itself, up to {fmt(a.largest, false, sym)} each.</p>
          <button type="button" className="pill pill-primary" style={{ minHeight: 44, marginTop: 12 }}
            disabled={busy === `auto-${a.kind}`} onClick={() => switchAutopilot(a.kind, true)}>Let it do these itself</button>
        </>
      );
    }
    return (
      <p className="team-last">
        Entries: you said yes {a.approved_in_a_row} of {a.needs} times in a row. After {a.needs} it can offer to record them by itself.
      </p>
    );
  }

  function card(w: AiWorker, className: string) {
    const s = workerState(w);
    const Icon = w.id === 'assistant' ? MessageCircle : (WORKER_ICONS[w.id] ?? MessageCircle);
    const last = w.last
      ? [w.last.status === 'waiting' ? w.last.said : w.last.did, STATE_WORDS[w.last.status],
         timeAgo(w.last.at).toLowerCase()].filter(Boolean).join(', ') + '.'
      : null;
    return (
      <BentoCard key={w.id} className={className} icon={<Icon />} title={w.name} tag={s.word} text={w.does}
        foot={
          <>
            {w.waiting > 0 && (
              <button type="button" className="pill pill-primary" style={{ minHeight: 44 }} onClick={() => pick(w.id)}>
                Answer {w.waiting === 1 ? 'it' : `all ${w.waiting}`}
              </button>
            )}
            {w.id === 'assistant' && (
              <button type="button" className="pill pill-quiet" style={{ minHeight: 44 }} onClick={() => setOpen(true)}>Ask it something</button>
            )}
            {!w.on && !ios && <Link href="/dashboard/billing" className="pill pill-quiet" style={{ minHeight: 44 }}>See plans</Link>}
          </>
        }>
        {w.on && (
          <div className="mini-stats" style={{ marginTop: 12 }}>
            <Figure label="Need you">{w.waiting}</Figure>
            <Figure label="Done this week">{w.done_this_week}</Figure>
          </div>
        )}
        {w.on && <p className="team-last">{last ? `Last: ${last}` : 'Nothing yet.'}</p>}
        {w.id === 'assistant' && (w.autopilot ?? []).map((a) => <div key={a.kind}>{autopilotLine(a)}</div>)}
      </BentoCard>
    );
  }

  const assistant = byId.get('assistant');
  const crew = (team?.workers ?? []).filter((w) => w.id !== 'assistant');
  const every = team ? `every ${team.every_hours} hours from ${hour(team.day_from)} to ${hour(team.day_to)}` : 'every few hours in the day';

  return (
    <>
      <PageHeader
        title="AIBOS team"
        subtitle={`Six workers look through your books ${every}. Nothing happens until you say yes.`}
        actions={
          <button type="button" className="pill pill-primary" style={{ minHeight: 44 }} disabled={checking || !team} onClick={checkNow}>
            {checking ? 'Looking' : 'Check now'}
          </button>
        }
      />
      <FeatureGate feature="chat_actions" title="AIBOS team" colour="var(--cyan)"
        headline="Six workers that look through your books and ask before they act"
        detail="They confirm entries, chase what you are owed, keep tax and pay on time and spot quiet customers. Every job waits for your yes.">
        {failed && <Note tone="warn">{failed}</Note>}
        {said && <div style={{ marginBottom: 16 }}><Note tone={said.tone}>{said.text}</Note></div>}

        {team && (
          <>
            <Panel style={{ marginBottom: 24 }}>
              <div className="mini-stats">
                <Figure label="Need you">{open}</Figure>
                <Figure label="Done this week">{doneThisWeek}</Figure>
                <Figure label="Last looked">{team.looked_at ? timeAgo(team.looked_at) : 'Not yet'}</Figure>
              </div>
              <TeamMap workers={team.workers} picked={picked} onPick={(id) => pick(picked === id ? null : id)} />
            </Panel>

            <div ref={waitingRef} style={{ scrollMarginTop: 96, marginBottom: 24 }}>
              <Panel title="Waiting for your yes" labelledBy="team-waiting-title">
                {waiting.length > 0 && (
                  <div className="chips" role="group" aria-label="Show" style={{ marginBottom: 16 }}>
                    <button type="button" className="chip" aria-pressed={picked === null} onClick={() => setPicked(null)}>
                      Everyone <span className="chip-count">{open}</span>
                    </button>
                    {(team.workers ?? []).filter((w) => waiting.some((j) => whose(j) === w.id)).map((w) => (
                      <button key={w.id} type="button" className="chip" aria-pressed={picked === w.id} onClick={() => setPicked(w.id)}>
                        {w.name} <span className="chip-count">{waiting.filter((j) => whose(j) === w.id && j.status === 'waiting').length}</span>
                      </button>
                    ))}
                  </div>
                )}
                {shown.length > 0 ? (
                  <div className="needs-you-list">
                    {shown.map((job) => <ActionCard key={job.id} job={job} busy={busy === job.id} onAnswer={answer} />)}
                  </div>
                ) : (
                  <Note tone="good">
                    {picked ? `Nothing from ${byId.get(picked)?.name ?? 'this one'} is waiting for you.` : 'Nothing is waiting for you. The workers look again in a few hours.'}
                  </Note>
                )}
              </Panel>
            </div>

            <div className="bento-grid" style={{ marginBottom: 24 }}>
              {assistant && card(assistant, 'span-6')}
              {crew.map((w) => card(w, 'span-3'))}
            </div>

            <Panel title="This week" labelledBy="team-week-title">
              {history.length === 0 ? (
                <Note tone="info">Nothing yet. Every job AIBOS does or asks about is written here.</Note>
              ) : (
                <div>
                  {history.map((j) => (
                    <div key={j.id} className="row">
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="row-title">{j.status === 'done' ? j.did : j.said}</div>
                        <div className="row-sub">
                          {[j.worker?.name ?? 'Assistant',
                            j.how === 'automatic' && j.status === 'done' ? 'done by itself' : STATE_WORDS[j.status],
                            timeAgo(j.at).toLowerCase()].filter(Boolean).join(', ')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </>
        )}
      </FeatureGate>
    </>
  );
}
