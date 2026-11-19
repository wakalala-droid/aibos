'use client';

// components/chat/ActionCard.tsx
// A job AIBOS did or is waiting to do (Jarvis phase 2, aibos-api actions.py),
// under the answer that brought it, or on the home page's "Needs you" list
// when one of AIBOS's workers found it (phase 3, workers.py). Waiting: what
// AIBOS will do, why it asks, with Yes and Not now. Done: what it did, with
// Undo while it can still be taken back. The same answers work out loud in
// the chat ("yes", "not now", "undo").

import { useEffect, useRef, useState } from 'react';
import { setAutopilot, type AiAction } from '@/lib/api';
import { teamChanged } from '@/lib/autoMode';
import type { ActionVerb } from '@/lib/aiAssistant';

const STATE: Record<AiAction['status'], string> = {
  waiting: 'Waiting for your yes',
  done: 'Done',
  declined: 'Left as it was',
  undone: 'Taken back',
  failed: 'Could not be done',
  expired: 'No longer waiting',
};

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five'];

export default function ActionCard({ job, busy, onAnswer, offers = false }: {
  job: AiAction;
  busy: boolean;
  onAnswer: (id: string, verb: ActionVerb) => void;
  /** Show the "do these yourself" offer here (Needs you); the chat says it in its answer. */
  offers?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [autoSaid, setAutoSaid] = useState<string | null>(null);

  // After a Yes or an Undo here the buttons that had focus are gone, and focus
  // fell to the top of the page (audit 19 Nov 2026). It moves to what the card
  // offers next (Undo, Open WhatsApp), or the card, whose new state is read out.
  const card = useRef<HTMLDivElement>(null);
  const answered = useRef(false);
  const seen = useRef(job.status);
  useEffect(() => {
    if (seen.current === job.status) return;
    seen.current = job.status;
    if (!answered.current) return;
    answered.current = false;
    const node = card.current;
    if (!node) return;
    const at = document.activeElement;
    if (at && at !== document.body && !node.contains(at)) return;   // the owner moved on
    const next = node.querySelector<HTMLElement>('.ai-job-actions button:not([disabled]), .ai-job-actions a[href]');
    (next ?? node).focus({ preventScroll: true });
  }, [job.status]);
  const earning = job.status === 'done' ? job.earning : undefined;
  const left = earning ? earning.needs - earning.approved_in_a_row : 0;

  async function turnOn(kind: string) {
    try {
      await setAutopilot(kind, true);
      setAutoSaid('Done. AIBOS records entries like these by itself now, each with an Undo.');
      teamChanged();
    } catch {
      setAutoSaid('That did not go through. Try again from the Assistant on your AIBOS team.');
    }
  }
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
    <div ref={card} className="ai-job" data-status={job.status} tabIndex={-1} role="group" aria-label={label}
      onClickCapture={() => { answered.current = true; }}>
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
      {earning && left > 0 && (
        <p className="ai-job-why">
          {`${earning.approved_in_a_row} of ${earning.needs}: ${WORDS[left] ?? left} more ${left === 1 ? 'yes' : 'yeses'} like this and AIBOS can record these by itself.`}
        </p>
      )}
      {offers && job.status === 'done' && job.offer_autopilot && (
        autoSaid ? <p className="ai-job-why" role="status">{autoSaid}</p> : (
          <>
            <p className="ai-job-why">{job.offer_autopilot.said}</p>
            <div className="ai-job-actions">
              <button type="button" className="pill pill-primary" onClick={() => void turnOn(job.offer_autopilot!.kind)}>
                Yes, record these yourself
              </button>
            </div>
          </>
        )
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
