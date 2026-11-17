'use client';
/**
 * AIBOS team: mission control for the work AIBOS does for the owner.
 *
 * Since 17 November 2026 the page is one scene and one list (owner's cleanup,
 * Hick's law): the navy stage with the AIBOS mark in the middle and the six
 * workers around it, the live activity beside it and the bar to talk to
 * AIBOS under it (components/team/TeamScene.tsx), then what is waiting for a
 * yes. Tapping a worker, or the mark for the Assistant, opens its sheet
 * (WorkerSheet) in place of the seven cards the page used to carry.
 *
 * The Assistant does the jobs the owner asks for, typed or spoken (aibos-api
 * actions.py). Six workers look through the books every few hours, every hour
 * on AIBOS auto, and put forward what they find (workers.py).
 *
 * Owner only (the API refuses everyone else) and on plans where AIBOS does
 * jobs (Pro+). Before migration 0047 the page says what is missing.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import FeatureGate from '@/components/ui/FeatureGate';
import Panel from '@/components/home/Panel';
import { Note } from '@/components/hospitality/kit';
import ActionCard from '@/components/chat/ActionCard';
import TeamScene from '@/components/team/TeamScene';
import WorkerSheet from '@/components/team/WorkerSheet';
import type { ActionVerb } from '@/lib/aiAssistant';
import { useAiAssistant } from '@/lib/aiAssistant';
import {
  ApiError, approveAction, declineAction, getTeam, listRecentActions, listWaitingActions, runWorkers,
  setAutopilot, undoAction, type AiAction, type AiTeam,
} from '@/lib/api';
import { teamChanged, useAutoMode, useOnTeamChange } from '@/lib/autoMode';
import { useIosApp } from '@/lib/iosApp';
import { useStore } from '@/lib/store';
import { startTalk } from '@/lib/talkEvent';

function hour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

export default function TeamPage() {
  const sym = useStore((s) => s.currencySymbol) || 'K';
  const ios = useIosApp();
  const { setOpen, sendMessage } = useAiAssistant();
  const { on: autoOn } = useAutoMode();
  const [team, setTeam] = useState<AiTeam | null>(null);
  const [waiting, setWaiting] = useState<AiAction[]>([]);
  const [recent, setRecent] = useState<AiAction[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [said, setSaid] = useState<{ tone: 'good' | 'warn' | 'bad'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [t, w, r] = await Promise.all([getTeam(), listWaitingActions(), listRecentActions(40)]);
      setFailed(null);
      setTeam(t);
      // Keep answered jobs on screen until the next visit (their message, their Undo).
      setWaiting((prev) => [...prev.filter((j) => j.status !== 'waiting'), ...[...w].reverse()]);
      setRecent([...r].sort((a, b) => (Date.parse(b.at ?? '') || 0) - (Date.parse(a.at ?? '') || 0)));
    } catch (e) {
      setFailed(e instanceof ApiError && e.status === 503 ? e.message
        : e instanceof ApiError && e.status === 403 ? 'This page is for the owner of the business.'
        : 'Your AIBOS team could not be read just now. Try again in a moment.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  // Auto switched in the top bar, or a check elsewhere: read the team again.
  useOnTeamChange(load);

  const byId = useMemo(() => new Map((team?.workers ?? []).map((w) => [w.id, w])), [team]);
  const whose = (job: AiAction) => job.worker?.id ?? 'assistant';
  const shown = picked ? waiting.filter((j) => whose(j) === picked) : waiting;
  const open = waiting.filter((j) => j.status === 'waiting').length;

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
      setRecent([...r].sort((a, b) => (Date.parse(b.at ?? '') || 0) - (Date.parse(a.at ?? '') || 0)));
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
      teamChanged();
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

  function ask(text: string) {
    setOpen(true);
    sendMessage(text);
  }

  const every = team ? `every ${team.every_hours === 1 ? 'hour' : `${team.every_hours} hours`} from ${hour(team.day_from)} to ${hour(team.day_to)}` : 'every few hours in the day';
  const sheetWorker = sheet ? byId.get(sheet) : undefined;

  return (
    <>
      <PageHeader
        title="AIBOS team"
        subtitle={autoOn
          ? `AIBOS auto is on: your team looks through your books ${every} and does the safe jobs itself. It asks before anything goes out.`
          : `Six workers look through your books ${every}. Nothing happens until you say yes.`}
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
            <TeamScene workers={team.workers} recent={recent} auto={autoOn} checking={checking} picked={sheet}
              onPick={(id) => setSheet(id)} onTalk={startTalk} onAsk={ask} />

            <div style={{ marginTop: 24 }}>
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
                    {picked ? `Nothing from ${byId.get(picked)?.name ?? 'this one'} is waiting for you.` : 'Nothing is waiting for you. The team keeps looking.'}
                  </Note>
                )}
              </Panel>
            </div>

            {sheetWorker && (
              <WorkerSheet worker={sheetWorker} jobs={waiting.filter((j) => whose(j) === sheetWorker.id)}
                sym={sym} ios={ios} busy={busy} auto={autoOn} onAnswer={answer} onAutopilot={switchAutopilot}
                onAsk={() => { setSheet(null); setOpen(true); }} onClose={() => setSheet(null)} />
            )}
          </>
        )}
      </FeatureGate>
    </>
  );
}
