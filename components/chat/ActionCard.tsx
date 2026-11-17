'use client';

// components/chat/ActionCard.tsx
// A job AIBOS did or is waiting to do (Jarvis phase 2, aibos-api actions.py),
// under the answer that brought it, or on the home page's "Needs you" list
// when one of AIBOS's workers found it (phase 3, workers.py). Waiting: what
// AIBOS will do, why it asks, with Yes and Not now. Done: what it did, with
// Undo while it can still be taken back. The same answers work out loud in
// the chat ("yes", "not now", "undo").

import { useState } from 'react';
import type { AiAction } from '@/lib/api';
import type { ActionVerb } from '@/lib/aiAssistant';

const STATE: Record<AiAction['status'], string> = {
  waiting: 'Waiting for your yes',
  done: 'Done',
  declined: 'Left as it was',
  undone: 'Taken back',
  failed: 'Could not be done',
  expired: 'No longer waiting',
};

export default function ActionCard({ job, busy, onAnswer }: {
  job: AiAction;
  busy: boolean;
  onAnswer: (id: string, verb: ActionVerb) => void;
}) {
  const [copied, setCopied] = useState(false);
  const state = job.status === 'done' && job.how === 'automatic' ? 'Done by itself' : STATE[job.status];
  const label = job.worker ? (job.status === 'waiting' ? job.worker.name : `${job.worker.name}: ${state}`) : state;
  const words = job.status === 'waiting' || job.status === 'declined' || job.status === 'expired' ? job.said : job.did;

  async function copy() {
    if (!job.message) return;
    try {
      await navigator.clipboard.writeText(job.message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { /* the text is on screen to copy by hand */ }
  }

  return (
    <div className="ai-job" data-status={job.status}>
      <p className="eyebrow" style={{ margin: 0 }}>{label}</p>
      <p className="ai-job-said">{words}</p>
      {job.status === 'waiting' && job.why && <p className="ai-job-why">{job.why}</p>}
      {job.status === 'done' && job.message && (
        <>
          <p className="ai-job-message">{job.message}</p>
          <div className="ai-job-actions">
            {job.whatsapp && (
              <a className="pill pill-primary" href={job.whatsapp} target="_blank" rel="noopener noreferrer">
                Open WhatsApp
              </a>
            )}
            <button type="button" className="pill pill-quiet" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
          </div>
        </>
      )}
      {job.status === 'waiting' && (
        <div className="ai-job-actions">
          <button type="button" className="pill pill-primary" disabled={busy} onClick={() => onAnswer(job.id, 'yes')}>
            {job.yes || 'Yes, do it'}
          </button>
          <button type="button" className="pill pill-quiet" disabled={busy} onClick={() => onAnswer(job.id, 'no')}>
            {job.no || 'Not now'}
          </button>
        </div>
      )}
      {job.status === 'done' && job.can_undo && (
        <div className="ai-job-actions">
          <button type="button" className="pill pill-quiet" disabled={busy} onClick={() => onAnswer(job.id, 'undo')}>
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
