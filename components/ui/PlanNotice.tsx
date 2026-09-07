'use client';

/**
 * PlanNotice — says so when the app cannot confirm which plan you are on.
 *
 * The interface keeps its own copy of your plan so screens can lock and unlock
 * instantly. That copy outlives a sign-out, and it outlived a rebuilt database.
 * When the API cannot read the real answer, the two disagree: paid screens open
 * as normal and then every button behind them refuses. What the owner sees is
 * "upgrade to Pro" on a plan they already pay for, with nothing to argue with.
 *
 * This strip is the missing sentence. It does not lock anything and it does not
 * try to sell an upgrade — it says the check failed, that it is our fault, and
 * offers to try again.
 */

import { useState } from 'react';
import { useProfile } from '@/lib/profile';

export default function PlanNotice() {
  const { planConfirmed, planNote, loading, refresh } = useProfile();
  const [retrying, setRetrying] = useState(false);

  if (loading || planConfirmed) return null;

  return (
    <div
      role="status"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap',
        padding: '14px 16px', margin: '0 0 16px', borderRadius: 10,
        border: '1px solid color-mix(in srgb, var(--amber) 40%, transparent)',
        background: 'color-mix(in srgb, var(--amber) 10%, transparent)',
      }}
    >
      <span
        aria-hidden
        style={{ fontSize: 18, lineHeight: '24px', color: 'var(--amber)' }}
      >
        !
      </span>
      <div style={{ flex: '1 1 320px', minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 16, lineHeight: 1.5, fontWeight: 600, color: 'var(--text-1)',
        }}>
          We could not check your plan
        </p>
        <p style={{
          margin: '4px 0 0', fontSize: 16, lineHeight: 1.6, fontWeight: 400, color: 'var(--text-2)',
        }}>
          {planNote}
        </p>
      </div>
      <button
        type="button"
        onClick={async () => { setRetrying(true); await refresh(); setRetrying(false); }}
        disabled={retrying}
        style={{
          padding: '9px 16px', minHeight: 40, borderRadius: 8,
          border: '1px solid var(--border-md)', background: 'var(--bg-input)',
          color: 'var(--text-1)', fontSize: 15, fontWeight: 600,
          cursor: retrying ? 'default' : 'pointer', opacity: retrying ? 0.6 : 1,
        }}
      >
        {retrying ? 'Checking…' : 'Check again'}
      </button>
    </div>
  );
}
