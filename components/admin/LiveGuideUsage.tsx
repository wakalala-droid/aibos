'use client';

// Admin · Usage: the live guide this month (aibos-api live_guide.py, 27 Nov
// 2026). Sessions, minutes, what Google charged and the real cost a minute,
// priced from Google's own token counts; and a check that holds one short
// session from the server to prove Google takes the key and the model.

import { useCallback, useEffect, useState } from 'react';
import SectionCard from '@/components/ui/SectionCard';
import { checkLiveGuide, getLiveUsage, type LiveCheck, type LiveUsage } from '@/lib/api';

const usd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;

export default function LiveGuideUsage() {
  const [u, setU] = useState<LiveUsage | null>(null);
  const [err, setErr] = useState('');
  const [check, setCheck] = useState<LiveCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkErr, setCheckErr] = useState('');

  const load = useCallback(async () => {
    try { setU(await getLiveUsage()); setErr(''); } catch (e) { setErr((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const runCheck = async () => {
    setChecking(true);
    setCheckErr('');
    setCheck(null);
    try { setCheck(await checkLiveGuide()); } catch (e) { setCheckErr((e as Error).message); }
    setChecking(false);
  };

  const passed = check && check.token && check.setup_complete && !check.error && (check.audio_bytes > 0 || !!check.transcript);
  const row = (label: string, value: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)' }}>{label}</span>
      <span style={{ fontSize: 'var(--fs-data)', fontWeight: 700, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{value}</span>
    </div>
  );

  return (
    <SectionCard title="Live guide: this month" subtitle="The talking sphere, priced from Google's own counts" style={{ marginTop: 16 }}>
      {err ? (
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: 0 }}>Could not load: {err}</p>
      ) : !u ? (
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: 0 }}>Loading…</p>
      ) : (
        <div>
          {row('Sessions', `${u.sessions} from ${u.businesses} business${u.businesses === 1 ? '' : 'es'}`)}
          {row('Minutes', String(u.minutes))}
          {row('Spent', `${usd(u.spend_usd)} of ${usd(u.budget_usd)} this month`)}
          {row('Cost a minute', u.cost_per_minute_usd == null ? 'Not measured yet' : `${(u.cost_per_minute_usd * 100).toFixed(1)}¢, from ${u.measured_sessions} session${u.measured_sessions === 1 ? '' : 's'}`)}
          {row('Model', u.model)}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
        <button type="button" className="rs-btn" onClick={() => void runCheck()} disabled={checking}>
          {checking ? 'Checking with Google…' : 'Check with Google'}
        </button>
        {checkErr && <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)' }}>{checkErr}</span>}
        {check && (
          <span role="status" style={{ fontSize: 'var(--fs-body)', color: passed ? 'var(--green)' : 'var(--text-1)' }}>
            {passed
              ? `Working: Google answered on ${check.model}${check.tool_call?.length ? ` and called ${check.tool_call.join(', ')}` : ''}.`
              : `Not working yet: ${check.error || (!check.token ? 'no token' : !check.setup_complete ? 'the session did not open' : 'no answer came back')}.`}
          </span>
        )}
      </div>
    </SectionCard>
  );
}
