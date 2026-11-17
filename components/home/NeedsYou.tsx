'use client';

// components/home/NeedsYou.tsx
// "Needs you": the one list in AIBOS of what the owner should look at
// (17 Nov 2026 cleanup, Hick's law: one place to look, one thing at a time).
// It used to be eight blocks on the home page. Now it holds:
//   - the workers' questions (aibos-api workers.py), each waiting for a yes;
//   - the home's own signals (useHomeDecisions): cash running short, critical
//     alerts, stock to reorder, a regular gone quiet, a margin that fell and
//     the top piece of advice.
// Anything that cannot wait comes first, then the workers' questions oldest
// first, then the rest. Three show; the rest open with "See all". When the
// list is empty that is the reward: nothing needs you, and what AIBOS
// handled today, said in one line (the UX audit, 17 Nov 2026: an empty list
// stood 225px tall). It sits right under the greeting.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import Panel from '@/components/home/Panel';
import ActionCard from '@/components/chat/ActionCard';
import type { ActionVerb } from '@/lib/aiAssistant';
import { useStore } from '@/lib/store';
import {
  ApiError, approveAction, declineAction, listRecentActions, listWaitingActions, runWorkers, undoAction,
  type AiAction,
} from '@/lib/api';
import { useHomeDecisions, type HomeDecision } from './useHomeDecisions';
import { teamChanged, useOnTeamChange } from '@/lib/autoMode';

const SHOWN = 3;

type Item = { key: string; job?: AiAction; decision?: HomeDecision };

function today(at?: string): boolean {
  if (!at) return false;
  return new Date(at).toDateString() === new Date().toDateString();
}

export default function NeedsYou() {
  const router = useRouter();
  const booksVersion = useStore((s) => s.booksVersion);
  const { decisions, draftState, draft, followUpDone, answerAdvice, busy: adviceBusy, canAutomate } = useHomeDecisions();
  // null: not this person or not this plan (the API answered no).
  const [jobs, setJobs] = useState<AiAction[] | null>(null);
  const [handled, setHandled] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  // The first answer from the jobs list, yes or no: until then "Nothing
  // needs you" could be said before it was known.
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      // Oldest first, the order the spoken brief reads them in. A copy:
      // two loads at once can share one answer, and reverse() would flip it twice.
      const waiting = [...(await listWaitingActions())].reverse();
      // Keep what was just answered on screen (its message, its Undo).
      setJobs((prev) => [...(prev ?? []).filter((j) => j.status !== 'waiting'), ...waiting]);
      listRecentActions(60)
        .then((r) => setHandled(r.filter((j) => j.status === 'done' && today(j.at)).length))
        .catch(() => {});
    } catch {
      setJobs((prev) => prev ?? null);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { load(); }, [load, booksVersion]);
  useOnTeamChange(load);

  async function answer(id: string, verb: ActionVerb) {
    setBusy(id);
    setSaid(null);
    try {
      const run = verb === 'yes' ? approveAction : verb === 'no' ? declineAction : undoAction;
      const job = await run(id);
      if (verb === 'no') setJobs((prev) => (prev ?? []).filter((j) => j.id !== id));
      else setJobs((prev) => (prev ?? []).map((j) => (j.id === id ? job : j)));
      if (verb === 'yes') setHandled((n) => n + 1);
      teamChanged();
      if (verb === 'yes' && job.link?.href) router.push(job.link.href);
    } catch (e) {
      setSaid(e instanceof ApiError ? e.message : 'That did not go through. Try again in a moment.');
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
      if (!out.new) setSaid('Nothing new. Everything that needs you is here.');
      teamChanged();
    } catch (e) {
      setSaid(e instanceof ApiError ? e.message : 'AIBOS could not look just now. Try again in a moment.');
    } finally {
      setChecking(false);
    }
  }

  // The bell's link is /dashboard#needs-you; the list arrives after the page draws.
  useEffect(() => {
    if (jobs && window.location.hash === '#needs-you') {
      document.getElementById('needs-you')?.scrollIntoView({ block: 'start' });
    }
  }, [jobs]);

  // A worker already asking about the same thing stands for the home's signal.
  const asking = new Set((jobs ?? []).filter((j) => j.status === 'waiting').map((j) => j.kind));
  const signals = decisions.filter((d) => !d.coveredBy || !asking.has(d.coveredBy));
  const items: Item[] = [
    ...signals.filter((d) => d.severity === 'crit').map((d) => ({ key: d.id, decision: d })),
    ...(jobs ?? []).map((j) => ({ key: j.id, job: j })),
    ...signals.filter((d) => d.severity !== 'crit').map((d) => ({ key: d.id, decision: d })),
  ];
  const open = items.filter((i) => (i.job ? i.job.status === 'waiting' : true)).length;
  const shown = all ? items : items.slice(0, SHOWN);
  const more = items.length - shown.length;

  // Nothing needs the owner: one line, not a panel.
  if (items.length === 0) {
    if (!loaded) return <div id="needs-you" data-tour="needs-you" className="needs-you-line skeleton" aria-hidden="true" />;
    return (
      <section id="needs-you" data-tour="needs-you" className="needs-you-line" aria-labelledby="needs-you-title" style={{ scrollMarginTop: 96 }}>
        <span className="avatar avatar-in" aria-hidden="true"><Check /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 id="needs-you-title" className="needs-you-line-title">Nothing needs you</h2>
          <p role="status" className="needs-you-line-sub">
            {said ?? (handled > 0
              ? `AIBOS handled ${handled} ${handled === 1 ? 'thing' : 'things'} today and keeps looking.`
              : 'All clear. AIBOS keeps looking.')}
          </p>
        </div>
        {jobs !== null && (
          <button type="button" className="pill pill-quiet" style={{ minHeight: 44 }} disabled={checking} onClick={checkNow}>
            {checking ? 'Looking' : 'Check now'}
          </button>
        )}
      </section>
    );
  }

  return (
    <div id="needs-you" data-tour="needs-you" style={{ scrollMarginTop: 96 }}>
      <Panel labelledBy="needs-you-title"
        title={
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <h2 id="needs-you-title" className="panel-title" style={{ margin: 0 }}>
              {open === 0 ? 'All answered' : 'Needs you'}
              {open > 0 && <span className="needs-you-count">{open}</span>}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-data)', color: 'var(--text-2)' }}>
              {open === 0
                ? handled > 0
                  ? `AIBOS handled ${handled} ${handled === 1 ? 'thing' : 'things'} today. Enjoy the quiet.`
                  : 'Cash, stock, customers and spending are all inside their limits.'
                : 'Nothing happens until you say yes.'}
            </p>
          </div>
        }
        action={jobs !== null ? (
          <button type="button" className="pill pill-quiet" style={{ minHeight: 44 }} disabled={checking} onClick={checkNow}>
            {checking ? 'Looking' : 'Check now'}
          </button>
        ) : undefined}>
        {said && <p role="status" style={{ margin: '0 0 12px', fontSize: 'var(--fs-data)', color: 'var(--text-2)' }}>{said}</p>}
        <div className="needs-you-list">
          {shown.map((i) => i.job ? (
            <ActionCard key={i.key} job={i.job} busy={busy === i.job.id} onAnswer={answer} offers />
          ) : (
            <DecisionCard key={i.key} d={i.decision!} canAutomate={canAutomate}
              drafting={i.decision!.proposal ? draftState[i.decision!.proposal.productId] : undefined}
              busy={!!i.decision!.advice?.rec_id && adviceBusy === i.decision!.advice?.rec_id}
              onDraft={draft} onFollowUpDone={followUpDone} onAdvice={answerAdvice} />
          ))}
        </div>
        {(more > 0 || all) && items.length > SHOWN && (
          <button type="button" className="pill pill-quiet" style={{ marginTop: 12, minHeight: 44 }} onClick={() => setAll((v) => !v)}>
            {all ? 'Show fewer' : `See all ${items.length}`}
          </button>
        )}
      </Panel>
    </div>
  );
}

/** A home signal, drawn as a job card so the list reads as one. */
function DecisionCard({ d, canAutomate, drafting, busy, onDraft, onFollowUpDone, onAdvice }: {
  d: HomeDecision;
  canAutomate: boolean;
  drafting?: 'drafting' | 'done' | 'error';
  busy: boolean;
  onDraft: ReturnType<typeof useHomeDecisions>['draft'];
  onFollowUpDone: (customerId: string) => void;
  onAdvice: ReturnType<typeof useHomeDecisions>['answerAdvice'];
}) {
  return (
    <div className="ai-job" data-status={drafting === 'done' ? 'done' : 'waiting'} data-severity={d.severity}>
      <p className="eyebrow" style={{ margin: 0 }}>{d.severity === 'crit' ? `${d.area}: cannot wait` : d.area}</p>
      <p className="ai-job-said">{d.headline}</p>
      <p className="ai-job-why">{d.reason}</p>
      <div className="ai-job-actions">
        {d.kind === 'link' && d.href && <Link href={d.href} className="pill pill-primary">{d.actionLabel}</Link>}
        {d.kind === 'draft' && d.proposal && (canAutomate ? (
          <button type="button" className={drafting === 'done' ? 'pill pill-quiet' : 'pill pill-primary'}
            disabled={drafting === 'drafting' || drafting === 'done'} onClick={() => void onDraft(d.proposal!)}>
            {drafting === 'drafting' ? 'Drafting' : drafting === 'done' ? 'Drafted. Confirm it when it arrives' : drafting === 'error' ? 'Try again' : d.actionLabel}
          </button>
        ) : (
          <Link href={d.href!} className="pill pill-primary">{d.actionLabel}</Link>
        ))}
        {d.kind === 'followup' && d.waLink && d.customerId && (
          <>
            <a href={d.waLink} target="_blank" rel="noopener noreferrer" className="pill pill-primary">{d.actionLabel}</a>
            <button type="button" className="pill pill-quiet" onClick={() => onFollowUpDone(d.customerId!)}>Done</button>
          </>
        )}
        {d.kind === 'advice' && d.advice && (
          <>
            <button type="button" className="pill pill-primary" disabled={busy} onClick={() => void onAdvice(d.advice!, 'accepted')}>{d.actionLabel}</button>
            <button type="button" className="pill pill-quiet" disabled={busy} onClick={() => void onAdvice(d.advice!, 'dismissed')}>Not for me</button>
            <Link href={d.href!} className="pill pill-quiet">Why</Link>
          </>
        )}
      </div>
    </div>
  );
}
