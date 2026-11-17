'use client';

// components/home/NeedsYou.tsx
// "Needs you": AIBOS as Jarvis, phase 3. Six workers (aibos-api workers.py)
// look through the books every few hours: entries to confirm, money a week
// late, tax due, pay not worked out, regulars gone quiet, guests arriving
// owing. Each finding waits here for the owner's yes. Nothing is done before
// it: the Collector writes the reminder and the owner sends it themself.
//
// Only an owner on a plan where AIBOS does jobs gets an answer from the API;
// for everyone else, and before migration 0047, the panel is not there at all.
// It is also not there when nothing is waiting: no empty box on the home page.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Panel from '@/components/home/Panel';
import ActionCard from '@/components/chat/ActionCard';
import type { ActionVerb } from '@/lib/aiAssistant';
import {
  ApiError, approveAction, declineAction, listWaitingActions, runWorkers, undoAction, type AiAction,
} from '@/lib/api';

export default function NeedsYou({ spaced = false }: {
  /** Leave room under it: the Overview stacks blocks, Simple mode spaces them with a gap. */
  spaced?: boolean;
}) {
  const router = useRouter();
  const [jobs, setJobs] = useState<AiAction[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [said, setSaid] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // Oldest first, the order the spoken brief reads them in.
      // A copy: two loads at once can share one answer, and reverse() would flip it twice.
      const waiting = [...(await listWaitingActions())].reverse();
      // Keep what was just answered on screen (its message, its Undo).
      setJobs((prev) => [...(prev ?? []).filter((j) => j.status !== 'waiting'), ...waiting]);
    } catch {
      setJobs((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // The bell's link is /dashboard#needs-you, but the list arrives after the
  // page has drawn, so the browser had nothing to scroll to yet.
  const shown = !!jobs && jobs.length > 0;
  useEffect(() => {
    if (shown && window.location.hash === '#needs-you') {
      document.getElementById('needs-you')?.scrollIntoView({ block: 'start' });
    }
  }, [shown]);

  async function answer(id: string, verb: ActionVerb) {
    setBusy(id);
    setSaid(null);
    try {
      const run = verb === 'yes' ? approveAction : verb === 'no' ? declineAction : undoAction;
      const job = await run(id);
      if (verb === 'no') {
        setJobs((prev) => (prev ?? []).filter((j) => j.id !== id));
      } else {
        setJobs((prev) => (prev ?? []).map((j) => (j.id === id ? job : j)));
      }
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
      await load();
    } catch (e) {
      setSaid(e instanceof ApiError ? e.message : 'AIBOS could not look just now. Try again in a moment.');
    } finally {
      setChecking(false);
    }
  }

  if (!jobs || jobs.length === 0) return null;
  const waiting = jobs.filter((j) => j.status === 'waiting').length;

  return (
    <div id="needs-you" style={{ marginBottom: spaced ? 24 : 0, scrollMarginTop: 96 }}>
      <Panel labelledBy="needs-you-title"
        title={
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <h2 id="needs-you-title" className="panel-title" style={{ margin: 0 }}>Needs you</h2>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-data)', color: 'var(--text-2)' }}>
              {waiting === 0
                ? 'All answered. AIBOS looks again in a few hours.'
                : `${waiting} ${waiting === 1 ? 'thing' : 'things'} AIBOS found. Nothing happens until you say yes.`}
            </p>
          </div>
        }
        action={
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" className="pill pill-quiet" style={{ minHeight: 44 }} disabled={checking} onClick={checkNow}>
              {checking ? 'Looking' : 'Check now'}
            </button>
            <Link href="/dashboard/team" className="pill pill-quiet" style={{ minHeight: 44 }}>Your AIBOS team</Link>
          </div>
        }>
        {said && <p role="status" style={{ margin: '0 0 12px', fontSize: 'var(--fs-data)', color: 'var(--text-2)' }}>{said}</p>}
        <div className="needs-you-list">
          {jobs.map((job) => (
            <ActionCard key={job.id} job={job} busy={busy === job.id} onAnswer={answer} />
          ))}
        </div>
      </Panel>
    </div>
  );
}
