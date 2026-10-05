'use client';

// CustomMetricsCard — shows owner-APPROVED function proposals (SAFEGUARD Layer 2)
// computed live on the current file. Owner-only. Every metric is re-critiqued at
// compute time, so a metric that no longer passes the gate is flagged for review
// instead of showing a bogus number (no deception).

import { useCallback, useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { useProfile } from '@/lib/profile';
import { authHeaders } from '@/lib/api';
import { Sigma } from 'lucide-react';
import BentoCard from './BentoCard';

interface ComputeResult {
  name: string;
  value?: number;
  ok: boolean;
  error?: string;
  status?: string;
}
interface ApprovedProposal {
  id: string;
  name: string;
  formula: string;
  inputs: string[];
  status: string;
  critique?: { passed?: boolean };
}

export default function CustomMetricsCard() {
  const { isAdmin } = useProfile();
  const { cabinetId } = useStore();
  const [results, setResults] = useState<ComputeResult[]>([]);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    if (!isAdmin || !cabinetId) return;
    setLoading(true);
    try {
      const r = await fetch('/api/admin/proposals');
      if (!r.ok) return;
      const j = await r.json();
      // Live metrics = those past the gate: in their monitoring window or stable.
      const active = ((j.proposals as ApprovedProposal[]) ?? []).filter(
        (p) => p.status === 'monitoring' || p.status === 'stable',
      );
      if (active.length === 0) { setResults([]); return; }

      const c = await fetch(`/api/proxy/compute-metrics?cabinet_id=${encodeURIComponent(cabinetId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ metrics: active.map((p) => ({ name: p.name, formula: p.formula, inputs: p.inputs })) }),
      });
      if (!c.ok) return;
      const cj = await c.json();
      const results = ((cj.results as ComputeResult[]) ?? []).map((res) => {
        const p = active.find((a) => a.name === res.name);
        return { ...res, status: p?.status };
      });
      setResults(results);

      // Monitoring = 15 days of back-to-back scrutiny: record each re-check so the
      // metric only earns "stable" after holding up over the window.
      void Promise.all(
        results.map((res) => {
          const p = active.find((a) => a.name === res.name);
          if (!p || p.status !== 'monitoring') return null;
          return fetch('/api/admin/proposals', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: p.id, action: 'record-run', pass: res.ok }),
          }).catch(() => null);
        }),
      );
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, [isAdmin, cabinetId]);

  useEffect(() => { void run(); }, [run]);

  if (!isAdmin || (!loading && results.length === 0)) return null;

  return (
    <BentoCard
      icon={<Sigma />}
      title="Your own figures"
      tag={`${results.length} live`}
      style={{ marginBottom: 20 }}
      motion="pulse"
      text="Figures you approved, worked out on this file and checked again every time."
    >
      {loading ? (
        <p className="bento-note" style={{ marginTop: 16 }}>Working them out…</p>
      ) : (
        <div className="mini-stats" style={{ marginTop: 16 }}>
          {results.map((m) => (
            <div key={m.name} className="mini-stat">
              <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', lineHeight: 1.4 }}>{m.name}</span>
              {m.ok ? (
                <span className="tnum" style={{ fontSize: 'var(--fs-h2)', fontWeight: 600, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
                  {typeof m.value === 'number' ? m.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : 'None'}
                </span>
              ) : (
                <span title={m.error} style={{ fontSize: 'var(--fs-body)', color: 'var(--red)', lineHeight: 1.4 }}>
                  Failed its check
                </span>
              )}
              {m.status && (
                <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
                  {m.status === 'stable' ? 'Proven' : 'Still being watched'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </BentoCard>
  );
}
