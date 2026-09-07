'use client';

/**
 * Admin · System health — is this deployment actually wired up?
 *
 * The failure this exists for produced no error anywhere. The API's Supabase
 * key was the anon key rather than the service_role key, so every read came
 * back empty and every write was dropped, silently. Downstream that looked
 * like ordinary emptiness: a Growth owner opening Hospitality was told to
 * upgrade to Pro, because their plan read as absent and absent defaults to
 * Free. Nothing in the product could be asked about it.
 *
 * So the product answers it now. One card, two hosts, one sentence when
 * something is wrong — including which dashboard to go and fix it in.
 */

import { useCallback, useEffect, useState } from 'react';

interface KeyVerdict { configured: boolean; service_role: boolean; note: string }
interface Health {
  healthy: boolean;
  verdict: string;
  web: KeyVerdict;
  api: {
    reachable?: boolean;
    note?: string;
    db_service_role?: boolean;
    db_note?: string;
    ai_configured?: boolean;
    ai_provider?: string;
    ai_model?: string;
    build_sha?: string;
    host?: string;
    expects_migration?: number;
  };
}

function Light({ ok }: { ok: boolean | null }) {
  const colour = ok === null ? 'var(--text-4)' : ok ? 'var(--good)' : 'var(--crit)';
  return (
    <span
      aria-hidden
      style={{
        width: 10, height: 10, borderRadius: '50%', background: colour,
        display: 'inline-block', flex: '0 0 auto',
      }}
    />
  );
}

function Row({ ok, label, detail }: { ok: boolean | null; label: string; detail?: string }) {
  return (
    <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0' }}>
      <span style={{ paddingTop: 6 }}><Light ok={ok} /></span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>
          {label}
        </span>
        {detail && (
          <span style={{ display: 'block', fontSize: 15, lineHeight: 1.6, color: 'var(--text-3)' }}>
            {detail}
          </span>
        )}
      </span>
    </li>
  );
}

export default function SystemHealth() {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState('');

  const check = useCallback(async () => {
    setLoading(true);
    setFailed('');
    try {
      // 503 is a real answer here (something is wrong), not a transport failure.
      const r = await fetch('/api/health', { cache: 'no-store' });
      setHealth((await r.json()) as Health);
    } catch (e) {
      setFailed((e as Error).message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void check(); }, [check]);

  const api = health?.api ?? {};
  const apiKeyOk = api.reachable ? api.db_service_role === true : null;

  return (
    <div className="section-card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-1)' }}>
          System health
        </h2>
        <button
          type="button"
          onClick={() => void check()}
          disabled={loading}
          style={{
            marginLeft: 'auto', minHeight: 36, padding: '7px 12px', borderRadius: 8,
            border: '1px solid var(--border-md)', background: 'var(--bg-card)',
            color: 'var(--text-2)', fontSize: 14, fontWeight: 600,
            cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Checking…' : 'Check again'}
        </button>
      </div>

      {loading && !health && <div className="skeleton" style={{ height: 120 }} />}

      {failed && (
        <p style={{ fontSize: 15, color: 'var(--crit)', margin: '8px 0 0' }}>
          The check itself could not run: {failed}
        </p>
      )}

      {health && (
        <>
          <p style={{
            margin: '0 0 8px', fontSize: 16, lineHeight: 1.6, fontWeight: 600,
            color: health.healthy ? 'var(--good)' : 'var(--crit)',
          }}>
            {health.verdict}
          </p>

          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            <Row
              ok={health.web.service_role}
              label="Website key"
              detail={health.web.service_role
                ? 'Can read and write the database.'
                : health.web.note}
            />
            <Row
              ok={api.reachable === true}
              label="API reachable"
              detail={api.reachable
                ? `${api.host ?? 'unknown host'} · build ${api.build_sha ?? '—'} · expects migration ${api.expects_migration ?? '—'}`
                : (api.note ?? 'No answer.')}
            />
            <Row
              ok={apiKeyOk}
              label="API key"
              detail={apiKeyOk === null
                ? 'Not checked. The API did not answer.'
                : apiKeyOk
                  ? 'Can read and write the database.'
                  : (api.db_note ?? 'Cannot see the database.')}
            />
            <Row
              ok={api.reachable ? Boolean(api.ai_configured) : null}
              label="AI provider"
              detail={api.reachable
                ? (api.ai_configured
                    ? `${api.ai_provider} · ${api.ai_model}`
                    : 'No AI key is set, so the CFO chat cannot answer.')
                : 'Not checked. The API did not answer.'}
            />
          </ul>
        </>
      )}
    </div>
  );
}
