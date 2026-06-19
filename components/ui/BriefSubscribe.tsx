'use client';

// BriefSubscribe — schedules the daily/weekly AI brief to email (the retention
// engine, per conversion_psychology.md HABIT FORMATION RULE). Uses the existing
// Groq-backed pipeline via subscribeEmail(). WhatsApp delivery is a fast-follow.

import { useState } from 'react';
import SectionCard from '@/components/ui/SectionCard';
import { subscribeEmail } from '@/lib/api';

type Frequency = 'daily' | 'weekly';
type Status = 'idle' | 'saving' | 'done' | 'error';

export default function BriefSubscribe() {
  const [email, setEmail] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('weekly');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  const valid = /\S+@\S+\.\S+/.test(email);

  const submit = async () => {
    if (!valid) return;
    setStatus('saving');
    setError('');
    try {
      const res = await subscribeEmail({ user_id: 'default-user', email, frequency });
      if (!res.ok) throw new Error('Could not save your subscription.');
      setStatus('done');
    } catch (e) {
      setStatus('error');
      setError((e as Error).message || 'Something went wrong.');
    }
  };

  return (
    <SectionCard title="AI Brief" subtitle="Your numbers, summarised — straight to your inbox">
      {status === 'done' ? (
        <div role="status" style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }}>
            <path d="M20 6L9 17l-5-5" stroke="var(--good)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
            You’re subscribed. Your {frequency} brief will land in {email}, leading with the one number that matters that day.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label htmlFor="brief-email" style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
              Email <span style={{ color: 'var(--text-4)', fontWeight: 400 }}>(required)</span>
            </label>
            <input
              id="brief-email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@business.co.zm"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10,
                border: '1px solid var(--border-md)', background: 'var(--bg-input)',
                color: 'var(--text-1)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem',
                outline: 'none',
              }}
            />
          </div>

          <div role="group" aria-label="Delivery frequency" style={{ display: 'flex', gap: 8 }}>
            {(['daily', 'weekly'] as Frequency[]).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={frequency === f}
                onClick={() => setFrequency(f)}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif', fontSize: '0.78rem', fontWeight: 600,
                  textTransform: 'capitalize',
                  border: `1px solid ${frequency === f ? 'var(--cyan)' : 'var(--border-md)'}`,
                  background: frequency === f ? 'color-mix(in srgb, var(--cyan) 10%, transparent)' : 'var(--bg-card)',
                  color: frequency === f ? 'var(--cyan)' : 'var(--text-2)',
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {status === 'error' && (
            <p role="alert" style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.74rem', color: 'var(--crit)', margin: 0 }}>
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={!valid || status === 'saving'}
            style={{
              padding: '11px 16px', borderRadius: 10, border: 'none',
              fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', fontWeight: 700,
              color: '#fff', background: 'var(--cyan)',
              cursor: !valid || status === 'saving' ? 'not-allowed' : 'pointer',
              opacity: !valid || status === 'saving' ? 0.55 : 1,
            }}
          >
            {status === 'saving' ? 'Saving…' : 'Send me the brief'}
          </button>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.66rem', color: 'var(--text-4)', margin: 0 }}>
            WhatsApp delivery coming soon. Unsubscribe anytime from any brief.
          </p>
        </div>
      )}
    </SectionCard>
  );
}
