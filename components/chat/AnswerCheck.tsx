'use client';

// Under each AI answer: what it looked at, and was it right?
// (UI/UX audit 2026-10 C7 answer check with B7, C8 show your working with B11.)
//
// "What I looked at" is one quiet line, the first lookup in words ("Read 214
// sales from 1 to 30 September 2026"); open it for every lookup and a link to
// the entries themselves. "Right" and "That's wrong" are logged to
// usage_events (event "answer_feedback") for the AIBOS team, with the question
// and the start of the answer. "That's wrong" points at the entries the answer
// used, where each one has Fix (A9), because a wrong answer is usually a
// wrong entry.

import { useState } from 'react';
import Link from 'next/link';
import type { ChatMessage } from '@/lib/aiAssistant';
import { logUsage } from '@/lib/usage';

const btn: React.CSSProperties = {
  padding: '0 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-md)',
  background: 'transparent', color: 'var(--text-2)', fontSize: 'var(--fs-label)', fontWeight: 600, cursor: 'pointer',
};

export default function AnswerCheck({ message, question, settled }: {
  message: ChatMessage;
  /** The owner's question this answers, for the feedback log. */
  question?: string;
  /** False while the answer is still being written. */
  settled: boolean;
}) {
  const [verdict, setVerdict] = useState<'right' | 'wrong' | null>(null);
  const reads = message.reads ?? [];
  const ids = Array.from(new Set(reads.flatMap((r) => r.ids))).slice(0, 50);
  const recordsHref = ids.length ? `/dashboard/timeline?status=all&ids=${ids.join(',')}` : null;

  const send = (v: 'right' | 'wrong') => {
    setVerdict(v);
    logUsage('answer_feedback', {
      meta: {
        verdict: v,
        question: (question ?? '').slice(0, 300),
        answer: message.content.slice(0, 600),
        tools: reads.map((r) => r.tool),
        records: ids.length,
      },
    });
  };

  if (!settled) return null;

  return (
    <div style={{ marginTop: 8, display: 'grid', gap: 8, maxWidth: '88%' }}>
      {reads.length > 0 && (
        <details>
          <summary style={{ cursor: 'pointer', fontSize: 'var(--fs-label)', color: 'var(--text-3)', minHeight: 44, display: 'flex', alignItems: 'center' }}>
            {reads.length === 1 ? reads[0].said : `${reads[0].said}, and ${reads.length - 1} more`}
          </summary>
          <ul style={{ margin: '4px 0 0', paddingLeft: 20, display: 'grid', gap: 4, fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
            {reads.map((r, i) => <li key={i}>{r.said}</li>)}
          </ul>
          {recordsHref && (
            <Link href={recordsHref} className="tap-link" style={{ fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--cyan)', textDecoration: 'none' }}>
              Open the {ids.length} {ids.length === 1 ? 'entry' : 'entries'} it used ›
            </Link>
          )}
        </details>
      )}

      {verdict === null ? (
        <div role="group" aria-label="Was this answer right?" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>Was this right?</span>
          <button type="button" style={btn} onClick={() => send('right')}>Right</button>
          <button type="button" style={btn} onClick={() => send('wrong')}>That&rsquo;s wrong</button>
        </div>
      ) : verdict === 'right' ? (
        <p role="status" style={{ margin: 0, fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>Thanks.</p>
      ) : (
        <p role="status" style={{ margin: 0, fontSize: 'var(--fs-label)', color: 'var(--text-2)', lineHeight: 1.5 }}>
          Thanks, noted for the AIBOS team.{' '}
          {recordsHref ? (
            <>A wrong answer is often a wrong entry: <Link href={recordsHref} style={{ color: 'var(--cyan)', fontWeight: 600 }}>check the {ids.length} it used</Link> and fix any that are off.</>
          ) : (
            <>Tell me what is wrong below and I&rsquo;ll look again.</>
          )}
        </p>
      )}
    </div>
  );
}
