'use client';

// CustomMetricsCard — shows owner-APPROVED function proposals (SAFEGUARD Layer 2)
// computed live on the current file. Owner-only. Every metric is re-critiqued at
// compute time, so a metric that no longer passes the gate is flagged for review
// instead of showing a bogus number (no deception).

import { useCallback, useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { useProfile } from '@/lib/profile';
import { authHeaders } from '@/lib/api';
import SectionCard from './SectionCard';

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
    <SectionCard
      title="Custom Metrics"
      subtitle="Owner-approved functions, computed live on this file · re-checked each run"
      delay={0.16}
    >
      {loading ? (
        <p style={{ color: 'var(--text-3)', fontFamily: 'Geist, sans-serif', fontSize: '0.82rem', margin: 0 }}>Computing…</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
          {results.map((m) => (
            <div key={m.name} style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)' }}>
              <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.68rem', color: 'var(--text-4)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.4 }}>
                {m.name}
              </p>
              {m.ok ? (
                <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '1.5rem', fontWeight: 800, color: 'var(--cyan)', margin: 0, letterSpacing: '-0.03em' }}>
                  {typeof m.value === 'number' ? m.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                </p>
              ) : (
                <p title={m.error} style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.72rem', color: 'var(--warn)', margin: 0, lineHeight: 1.4 }}>
                  ⚠ flagged — failed re-check
                </p>
              )}
              {m.status && (
                <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: m.status === 'stable' ? 'var(--good)' : 'var(--cyan)', margin: '6px 0 0' }}>
                  {m.status === 'stable' ? 'stable' : 'monitoring'}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
