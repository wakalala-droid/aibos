'use client';

// The AI-BOS team on the landing page (UX audit step 5, 17 Nov 2026): the
// same navy scene owners see on Home, with a sample business, right after the
// promise. Before, nothing before sign-up said that AI-BOS has a team that
// works the books, talks and can run the safe jobs by itself.
// Tapping a worker says what it does; there is no ask bar (nothing to ask
// before there are books).

import { useState } from 'react';
import { Check } from 'lucide-react';
import TeamScene from '@/components/team/TeamScene';
import Rise from '@/components/marketing/Rise';
import { requiredTier, TIERS } from '@/lib/tiers';
import type { AiAction, AiWorker } from '@/lib/api';

const W = (id: string, name: string, does: string, waiting: number, done: number): AiWorker =>
  ({ id, name, does, on: true, off_reason: null, waiting, done_this_week: done, last: null });

const WORKERS: AiWorker[] = [
  W('assistant', 'Assistant', 'Does the jobs you ask for, typed or spoken', 0, 6),
  W('bookkeeper', 'Bookkeeper', 'Confirms the entries that came in', 2, 9),
  W('collector', 'Collector', 'Gets back the money customers owe', 1, 4),
  W('tax', 'Tax clerk', 'Keeps PAYE, NAPSA, NHIMA and the levy on time', 0, 3),
  W('payroll', 'Payroll clerk', 'Gets your staff paid right and on time', 0, 2),
  W('scout', 'Sales scout', 'Spots regular customers who have gone quiet', 1, 5),
  W('guest_desk', 'Guest desk', 'Looks after arrivals and booking requests', 0, 6),
];

// Local times with no zone, so the server and the phone print the same clock.
const at = (h: number, m: number) => `2026-11-17T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
const J = (id: string, worker: [string, string], status: AiAction['status'], text: string, when: string): AiAction =>
  ({ id, kind: 'note', status, how: status === 'done' ? 'automatic' : null, said: text, did: text, can_undo: false,
    at: when, worker: { id: worker[0], name: worker[1] } });

const RECENT: AiAction[] = [
  J('s1', ['collector', 'Collector'], 'waiting', 'Mwila Catering owes K2,350 and is 9 days late. Send the reminder?', at(9, 12)),
  J('s2', ['bookkeeper', 'Bookkeeper'], 'done', 'Recorded 3 crates of Coke sold for K450', at(8, 40)),
  J('s3', ['tax', 'Tax clerk'], 'done', 'Put NAPSA, K3,120, on Friday’s schedule', at(7, 5)),
];

export default function TeamSection() {
  const [picked, setPicked] = useState<string | null>(null);
  const plan = TIERS[requiredTier('chat_actions')].name;
  const worker = WORKERS.find((w) => w.id === picked);
  const values = [
    'They ask before they act. Nothing is sent and no money moves until you say yes',
    'Talk to AI-BOS: it says good morning, asks what you need and listens',
    'Turn on AI-BOS auto and the safe jobs get done by themselves, each with an Undo',
  ];

  return (
    <section id="team" className="mkt-section" aria-labelledby="team-h">
      <div className="mkt-wrap">
        <Rise className="mkt-head">
          <div>
            <p className="mkt-eyebrow">Your AI-BOS team</p>
            <h2 id="team-h" className="mkt-h2">Six workers on your books, all day.</h2>
          </div>
          <p className="mkt-head-sub">
            Every few hours they look through your books and bring you only what needs you. They come with {plan}.
          </p>
        </Rise>
      </div>
      <div className="mkt-team">
        <TeamScene workers={WORKERS} recent={RECENT} auto={false} checking={false} ask={false}
          picked={picked} onPick={(id) => setPicked((p) => (p === id ? null : id))}
          onTalk={() => setPicked('assistant')} onAsk={() => {}} />
      </div>
      <div className="mkt-wrap">
        <p className="mkt-preview-cap" aria-live="polite" style={{ textAlign: 'center', marginTop: 12 }}>
          {worker ? `${worker.name}: ${worker.does}.` : 'Tap a worker to see what it does. A sample business.'}
        </p>
        <ul className="mkt-values mkt-team-values">
          {values.map((v) => <li key={v}><Check aria-hidden />{v}</li>)}
        </ul>
      </div>
    </section>
  );
}
