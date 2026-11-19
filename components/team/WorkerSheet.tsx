'use client';

// components/team/WorkerSheet.tsx
// One worker, opened from the team scene (17 Nov 2026): what used to be seven
// cards on the page is one sheet that slides in for the worker tapped. What
// it looks after, what it has waiting (answered right here), what it did this
// week and its last job. The Assistant's sheet carries the earned "do these
// yourself" switch. Escape or the close button shuts it.

import { useEffect, useRef } from 'react';
import { useModalFocus } from '@/hooks/useModalFocus';
import Link from 'next/link';
import { MessageCircle, X } from 'lucide-react';
import ActionCard from '@/components/chat/ActionCard';
import type { ActionVerb } from '@/lib/aiAssistant';
import type { AiAction, AiAutopilotKind, AiWorker } from '@/lib/api';
import { timeAgo } from '@/lib/notifications';
import { fmt } from '@/lib/utils';
import { WORKER_ICONS, workerState } from './TeamScene';

const ENTRY_WORDS: Record<string, string> = {
  Sale: 'sales', Expense: 'expenses', Purchase: 'stock bought', CustomerPayment: 'payments in',
  SupplierPayment: 'payments to suppliers', Refund: 'refunds',
};

function listWords(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export default function WorkerSheet({ worker, jobs, sym, ios, busy, auto, onAnswer, onAutopilot, onAsk, onClose }: {
  worker: AiWorker;
  jobs: AiAction[];
  sym: string;
  ios: boolean;
  busy: string | null;
  auto: boolean;
  onAnswer: (id: string, verb: ActionVerb) => void;
  onAutopilot: (kind: string, on: boolean) => void;
  onAsk: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  // Focus stays in the sheet and goes back to the worker when it closes.
  const panel = useRef<HTMLElement>(null);
  useModalFocus(panel);

  const s = workerState(worker);
  const Icon = worker.id === 'assistant' ? MessageCircle : (WORKER_ICONS[worker.id] ?? MessageCircle);
  const last = worker.last
    ? `${worker.last.status === 'waiting' ? worker.last.said : worker.last.did}, ${timeAgo(worker.last.at).toLowerCase()}.`
    : null;

  function autopilot(a: AiAutopilotKind) {
    const types = listWords(a.types.map((t) => ENTRY_WORDS[t] ?? t.toLowerCase())) || 'entries';
    if (a.on) {
      return (
        <>
          <p className="sheet-text">Records {types} by itself, up to {fmt(a.largest, false, sym)} each. Anything else it asks.</p>
          <button type="button" className="pill pill-quiet" disabled={busy === `auto-${a.kind}`} onClick={() => onAutopilot(a.kind, false)}>Ask me first again</button>
        </>
      );
    }
    if (a.earned) {
      return (
        <>
          <p className="sheet-text">You said yes {a.approved_in_a_row} times in a row. It can record {types} like these by itself, up to {fmt(a.largest, false, sym)} each.</p>
          <button type="button" className="pill pill-primary" disabled={busy === `auto-${a.kind}`} onClick={() => onAutopilot(a.kind, true)}>Let it do these itself</button>
        </>
      );
    }
    return <p className="sheet-text">Entries: you said yes {a.approved_in_a_row} of {a.needs} times in a row. After {a.needs} it can offer to record them by itself.</p>;
  }

  return (
    <>
      <button type="button" className="sheet-backdrop" aria-label="Close" onClick={onClose} />
      <aside ref={panel} className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <header className="sheet-head">
          <span className={`bento-icon sheet-icon is-${s.tone}`} aria-hidden="true"><Icon /></span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 id="sheet-title" className="sheet-title">{worker.name}</h2>
            <p className="sheet-state">{s.tone === 'watch' && auto ? 'Working on auto' : s.word}</p>
          </div>
          <button type="button" className="icon-pill" aria-label="Close" onClick={onClose}><X aria-hidden="true" /></button>
        </header>

        <p className="sheet-text">{worker.does}</p>
        {worker.on && (
          <div className="mini-stats" style={{ marginTop: 16 }}>
            <div className="mini-stat"><span className="sheet-label">Need you</span><span className="money money-md">{worker.waiting}</span></div>
            <div className="mini-stat"><span className="sheet-label">Done this week</span><span className="money money-md">{worker.done_this_week}</span></div>
          </div>
        )}
        {worker.on && <p className="sheet-text">{last ? `Last: ${last}` : 'Nothing yet.'}</p>}
        {!worker.on && !ios && <Link href="/dashboard/billing" className="pill pill-primary" style={{ marginTop: 16 }}>See plans</Link>}

        {worker.id === 'assistant' && (
          <div className="sheet-block">
            {(worker.autopilot ?? []).map((a) => <div key={a.kind} className="ai-job-actions" style={{ display: 'block' }}>{autopilot(a)}</div>)}
            <button type="button" className="pill" style={{ marginTop: 12 }} onClick={onAsk}>Ask it something</button>
          </div>
        )}

        {jobs.length > 0 && (
          <div className="sheet-block">
            <p className="eyebrow" style={{ margin: '0 0 8px' }}>Waiting for your yes</p>
            <div style={{ display: 'grid', gap: 12 }}>
              {jobs.map((job) => <ActionCard key={job.id} job={job} busy={busy === job.id} onAnswer={onAnswer} />)}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
