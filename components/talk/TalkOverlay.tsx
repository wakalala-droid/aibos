'use client';

// components/talk/TalkOverlay.tsx
// Talking to AIBOS, full screen (owner, 17 Nov 2026): the AIBOS sphere comes
// up in the middle of a navy screen while the conversation runs. Under it,
// what AIBOS is doing in one word, the words it just heard or the start of
// its answer, and a job waiting for a yes, so it can be tapped as well as
// said. Interrupt while it speaks; End goes back to the page; Type instead
// keeps the chat open without the voice. Escape ends.

import { useEffect, useState } from 'react';
import AibosSphere from './AibosSphere';
import ActionCard from '@/components/chat/ActionCard';
import type { AiAction } from '@/lib/api';
import type { ActionVerb } from '@/lib/aiAssistant';
import type { TalkPhase } from '@/lib/useTalkMode';

const WORDS: Record<Exclude<TalkPhase, 'off'>, string> = {
  briefing: 'Reading your brief',
  speaking: 'Speaking',
  listening: 'Listening',
  thinking: 'Thinking',
};

/** An answer as one plain paragraph, for reading along. */
function plain(text: string, cap = 240): string {
  const flat = text.replace(/[*_#>`|]/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1').replace(/\s+/g, ' ').trim();
  return flat.length > cap ? `${flat.slice(0, cap).replace(/\s\S*$/, '')}…` : flat;
}

export default function TalkOverlay({ phase, heard, answer, job, busy, onAnswer, onInterrupt, onEnd, onType }: {
  phase: Exclude<TalkPhase, 'off'>;
  heard: string;
  answer: string | null;
  job: AiAction | null;
  busy: boolean;
  onAnswer: (id: string, verb: ActionVerb) => void;
  onInterrupt: () => void;
  onEnd: () => void;
  onType: () => void;
}) {
  const [w, setW] = useState(900);
  useEffect(() => {
    const fit = () => setW(Math.min(window.innerWidth - 32, 960));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onEnd(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onEnd]);

  const size = w < 520 ? 220 : 300;
  const listening = phase === 'listening';
  const said = heard && heard !== '…' ? heard : '';

  return (
    <div className="talk-overlay" data-theme="dark" role="dialog" aria-modal="true" aria-label="Talking to AIBOS">
      <div className="talk-overlay-body">
        <AibosSphere size={size} bars width={w} phase={phase} pulse={said} label={`AIBOS is ${WORDS[phase].toLowerCase()}`} />
        <p className="talk-phase" role="status" aria-live="polite">{WORDS[phase]}</p>
        <p className="talk-caption">
          {listening
            ? (said ? `“${said}”` : 'Speak now. Say “that’s all” to finish.')
            : answer ? plain(answer) : ' '}
        </p>
        {job && job.status === 'waiting' && (
          <div className="talk-job"><ActionCard job={job} busy={busy} onAnswer={onAnswer} /></div>
        )}
        <div className="talk-acts">
          {(phase === 'speaking' || phase === 'briefing') && (
            <button type="button" className="pill pill-primary" onClick={onInterrupt}>Interrupt</button>
          )}
          <button type="button" className="pill pill-quiet" onClick={onType}>Type instead</button>
          <button type="button" className="pill" onClick={onEnd}>End</button>
        </div>
      </div>
    </div>
  );
}
