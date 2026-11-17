'use client';

// components/chat/ActionCard.tsx
// A job AIBOS did or is waiting to do (Jarvis phase 2, aibos-api actions.py),
// under the answer that brought it. Waiting: what AIBOS will do, with Yes and
// Not now. Done: what it did, with Undo while it can still be taken back.
// The same answers work out loud ("yes", "not now", "undo").

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
  const label = job.status === 'done' && job.how === 'automatic' ? 'Done by itself' : STATE[job.status];
  const words = job.status === 'waiting' || job.status === 'declined' || job.status === 'expired' ? job.said : job.did;
  return (
    <div className="ai-job" data-status={job.status}>
      <p className="eyebrow" style={{ margin: 0 }}>{label}</p>
      <p className="ai-job-said">{words}</p>
      {job.status === 'waiting' && (
        <div className="ai-job-actions">
          <button type="button" className="pill pill-primary" disabled={busy} onClick={() => onAnswer(job.id, 'yes')}>
            Yes, do it
          </button>
          <button type="button" className="pill pill-quiet" disabled={busy} onClick={() => onAnswer(job.id, 'no')}>
            Not now
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
