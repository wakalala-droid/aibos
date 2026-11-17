'use client';

// components/home/HomeTeam.tsx
// The AIBOS team on Home (owner, 17 Nov 2026): the whole team scene, edge to
// edge across the page, in place of a strip that opened a page of its own.
// "Expansive and immersive, not windowed", and part of Home, so the owner
// works with the team where they already are. Tap a worker for its sheet; tap
// the mark for the Assistant; the bar under the stage asks or talks.
//
// The scene spans the content frame (#main-content), not the page column: it
// measures the frame and sets its own left edge and width. (A CSS container
// on the frame would do it too, but would also trap every drawer and sheet
// inside the frame.)
//
// Owners only: the workers ask the owner. On a plan without them the team
// shows asleep with what they would do and which plan has them (never a
// price, and nothing to buy in the iPhone app). Before migration 0047 it
// says what is missing.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Note } from '@/components/hospitality/kit';
import TeamScene from '@/components/team/TeamScene';
import WorkerSheet from '@/components/team/WorkerSheet';
import type { ActionVerb } from '@/lib/aiAssistant';
import { useAiAssistant } from '@/lib/aiAssistant';
import {
  ApiError, approveAction, declineAction, getTeam, listRecentActions, listWaitingActions,
  setAutopilot, undoAction, type AiAction, type AiTeam, type AiWorker,
} from '@/lib/api';
import { teamChanged, useAutoMode, useOnTeamChange } from '@/lib/autoMode';
import { NOT_ON_PLAN_SHORT, useIosApp } from '@/lib/iosApp';
import { useProfile } from '@/lib/profile';
import { useStore } from '@/lib/store';
import { startTalk } from '@/lib/talkEvent';
import { canAccess, type Tier } from '@/lib/tiers';

// The team as it stands on a plan without it: everyone asleep.
const ASLEEP: AiWorker[] = [
  ['bookkeeper', 'Bookkeeper'], ['collector', 'Collector'], ['tax', 'Tax clerk'],
  ['payroll', 'Payroll clerk'], ['scout', 'Sales scout'], ['guest_desk', 'Guest desk'],
].map(([id, name]) => ({ id, name, does: '', on: false, off_reason: 'Asleep', waiting: 0, done_this_week: 0, last: null }));

const byTime = (a: AiAction, b: AiAction) => (Date.parse(b.at ?? '') || 0) - (Date.parse(a.at ?? '') || 0);

/** Stretch `ref` across the content frame, whatever the page column's width and padding. */
function useBleed(ref: React.RefObject<HTMLElement>) {
  useLayoutEffect(() => {
    const el = ref.current;
    const frame = document.getElementById('main-content');
    const parent = el?.parentElement;
    if (!el || !frame || !parent) return;
    const fit = () => {
      const f = frame.getBoundingClientRect();
      const p = parent.getBoundingClientRect();
      el.style.marginLeft = `${Math.round(f.left - p.left)}px`;
      el.style.width = `${Math.round(f.width)}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(frame);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [ref]);
}

export default function HomeTeam() {
  const router = useRouter();
  const tier = useStore((s) => s.tier) as Tier;
  const sym = useStore((s) => s.currencySymbol) || 'K';
  const booksVersion = useStore((s) => s.booksVersion);
  const { teamRole } = useProfile();
  const ios = useIosApp();
  const { setOpen, sendMessage } = useAiAssistant();
  const { on: autoOn } = useAutoMode();
  const hasTeam = canAccess(tier, 'chat_actions');
  const owner = !teamRole || teamRole === 'owner';

  const [team, setTeam] = useState<AiTeam | null>(null);
  const [waiting, setWaiting] = useState<AiAction[]>([]);
  const [recent, setRecent] = useState<AiAction[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useBleed(ref);

  const load = useCallback(async () => {
    if (!hasTeam || !owner) return;
    try {
      const [t, w, r] = await Promise.all([getTeam(), listWaitingActions(), listRecentActions(20)]);
      setFailed(null);
      setTeam(t);
      // Keep answered jobs on screen until the next visit (their message, their Undo).
      setWaiting((prev) => [...prev.filter((j) => j.status !== 'waiting'), ...[...w].reverse()]);
      setRecent([...r].sort(byTime));
    } catch (e) {
      setFailed(e instanceof ApiError && e.status === 503 ? e.message
        : 'Your AIBOS team could not be read just now. Try again in a moment.');
    }
  }, [hasTeam, owner]);

  useEffect(() => { load(); }, [load, booksVersion]);
  useOnTeamChange(load);

  if (!owner) return null;

  const whose = (job: AiAction) => job.worker?.id ?? 'assistant';

  async function answer(id: string, verb: ActionVerb) {
    setBusy(id);
    setSaid(null);
    try {
      const run = verb === 'yes' ? approveAction : verb === 'no' ? declineAction : undoAction;
      const job = await run(id);
      setWaiting((prev) => (verb === 'no' ? prev.filter((j) => j.id !== id) : prev.map((j) => (j.id === id ? job : j))));
      if (verb === 'yes' && job.offer_autopilot) setSaid({ tone: 'good', text: job.offer_autopilot.said });
      teamChanged();
      if (verb === 'yes' && job.link?.href) router.push(job.link.href);
    } catch (e) {
      setSaid({ tone: 'bad', text: e instanceof ApiError ? e.message : 'That did not go through. Try again in a moment.' });
      load();
    } finally {
      setBusy(null);
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

  const ready = hasTeam && team && !failed;
  const sheetWorker = sheet ? team?.workers.find((w) => w.id === sheet) : undefined;
  const locked = !hasTeam ? (
    <>
      <p className="scene-locked-head">Six workers who look through your books and ask before they act</p>
      <p className="scene-locked-text">They confirm entries, chase what you are owed, keep tax and pay on time and spot quiet customers. Nothing happens until you say yes.</p>
      {ios ? <p className="scene-locked-text">{NOT_ON_PLAN_SHORT}.</p>
        : <Link href="/dashboard/billing" className="pill pill-primary">They come with Pro+. See plans</Link>}
    </>
  ) : failed ? <p className="scene-locked-text">{failed}</p> : null;

  return (
    <div id="team" className="home-team" ref={ref} style={{ scrollMarginTop: 96 }}>
      <TeamScene workers={ready ? team.workers : ASLEEP} recent={recent} auto={autoOn} checking={false}
        picked={sheet} locked={ready ? undefined : locked ?? <p className="scene-locked-text">Waking your team.</p>}
        onPick={(id) => (ready ? setSheet(id) : !hasTeam && !ios ? router.push('/dashboard/billing') : undefined)}
        onTalk={startTalk} onAsk={ask} />
      {said && <div className="home-team-said"><Note tone={said.tone}>{said.text}</Note></div>}
      {ready && sheetWorker && (
        <WorkerSheet worker={sheetWorker} jobs={waiting.filter((j) => whose(j) === sheetWorker.id)}
          sym={sym} ios={ios} busy={busy} auto={autoOn} onAnswer={answer} onAutopilot={switchAutopilot}
          onAsk={() => { setSheet(null); setOpen(true); }} onClose={() => setSheet(null)} />
      )}
    </div>
  );
}
