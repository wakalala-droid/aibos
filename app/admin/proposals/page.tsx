'use client';

// Admin · Function Proposals — the owner review queue (SAFEGUARD.md Layer 2).
// AI/rule-proposed derived metrics arrive here with a sandbox preview and a
// critique verdict. The owner approves / rejects. Nothing executes here; approval
// only records intent for a human to implement through the normal build gate.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import SectionCard from '@/components/ui/SectionCard';
import { useStore } from '@/lib/store';

interface Proposal {
  id: string;
  name: string;
  purpose: string | null;
  extends_engine: string | null;
  inputs: string[];
  formula: string;
  preview: Record<string, number> | null;
  confidence: number;
  assumptions: string[];
  risks: string[];
  critique: {
    passed?: boolean;
    checks?: Record<string, boolean>;
    critic_notes?: string;
    llm?: { checked?: boolean; sound?: boolean; score?: number; notes?: string };
  };
  source: string;
  status: string;
  source_file: string | null;
  created_at: string;
  monitor_until?: string | null;
  monitor_runs?: number;
  monitor_fails?: number;
}

const STATUS_TONE: Record<string, string> = {
  proposed: 'var(--warn)', monitoring: 'var(--cyan)', stable: 'var(--good)',
  rejected: 'var(--crit)', implemented: 'var(--purple)',
};

function daysLeft(until?: string | null): number {
  if (!until) return 0;
  return Math.max(0, Math.ceil((new Date(until).getTime() - Date.now()) / 86400000));
}

export default function AdminProposalsPage() {
  const { cabinetId, filename } = useStore();
  const [items, setItems] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/admin/proposals');
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `Failed to load (${r.status})`);
      setItems(j.proposals as Proposal[]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Generate from the file currently loaded in this session, then persist.
  const scan = useCallback(async () => {
    if (!cabinetId) { setNote('Upload a file first — there is no current file to scan.'); return; }
    setBusy(true); setNote('');
    try {
      const r = await fetch(`/api/proxy/propose?cabinet_id=${encodeURIComponent(cabinetId)}`, { method: 'POST' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || j.error || `Scan failed (${r.status})`);
      const proposals = (j.proposals as Record<string, unknown>[]) ?? [];
      if (proposals.length === 0) { setNote('No new functions proposed for this file.'); }
      else {
        const save = await fetch('/api/admin/proposals', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proposals, source_file: filename }),
        });
        const sj = await save.json();
        if (!save.ok) throw new Error(sj.error || 'Could not save proposals');
        setNote(`Added ${sj.inserted} proposal(s) from “${filename ?? 'current file'}”.`);
        await load();
      }
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [cabinetId, filename, load]);

  const setStatus = useCallback(async (id: string, status: string) => {
    setItems((xs) => xs.map((p) => (p.id === id ? { ...p, status } : p)));  // optimistic
    try {
      const r = await fetch('/api/admin/proposals', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!r.ok) { const j = await r.json(); throw new Error(j.error || 'Update failed'); }
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      await load();  // refresh to pick up monitor_until / counters set server-side
    }
  }, [load]);

  const nav = (
    <nav aria-label="Admin sections" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
      <Link href="/admin" style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-3)', textDecoration: 'none', padding: '6px 12px', borderRadius: 8 }}>Accounts</Link>
      <Link href="/admin/usage" style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-3)', textDecoration: 'none', padding: '6px 12px', borderRadius: 8 }}>Usage</Link>
      <Link href="/admin/proposals" aria-current="page" style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-1)', textDecoration: 'none', padding: '6px 12px', borderRadius: 8, background: 'var(--bg-badge)', border: '1px solid var(--border)' }}>Proposals</Link>
    </nav>
  );

  return (
    <div style={{ maxWidth: 980, margin: '0 auto' }}>
      {nav}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.03em' }}>
            Function Proposals
          </h1>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: 'var(--text-3)', margin: '4px 0 0' }}>
            AI/rule-proposed metrics · sandbox-validated · you approve before anything ships
          </p>
        </div>
        <button onClick={scan} disabled={busy}
          style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: 700, color: '#001018', background: 'var(--cyan)', border: 'none', borderRadius: 8, padding: '10px 16px', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Scanning…' : 'Scan current file for functions'}
        </button>
      </div>

      {note && (
        <p role="status" aria-live="polite" style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.78rem', color: 'var(--text-2)', margin: '0 0 16px', padding: '10px 12px', borderRadius: 8, background: 'var(--bg-badge)', border: '1px solid var(--border)' }}>{note}</p>
      )}

      {loading ? (
        <SectionCard><p style={{ color: 'var(--text-3)', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem' }}>Loading proposals…</p></SectionCard>
      ) : error ? (
        <SectionCard><p style={{ color: 'var(--crit)', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem' }}>{error}</p></SectionCard>
      ) : items.length === 0 ? (
        <SectionCard title="No proposals yet" subtitle="Upload a file, then “Scan current file for functions”">
          <p style={{ color: 'var(--text-3)', fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', lineHeight: 1.6, margin: 0 }}>
            When a file contains columns the engines don’t use (e.g. a promotion multiplier),
            AI-BOS proposes a derived metric here — already run safely on your data — for you to approve.
          </p>
        </SectionCard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {items.map((p) => {
            const passed = p.critique?.passed;
            const previewStr = p.preview
              ? Object.entries(p.preview).map(([k, v]) => `${k}=${v}`).join(' · ')
              : '—';
            return (
              <SectionCard key={p.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 320px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <h3 style={{ fontFamily: 'Inter, sans-serif', fontSize: '1rem', fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>{p.name}</h3>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: p.source === 'ai' ? 'var(--purple)' : 'var(--text-3)', padding: '2px 6px', borderRadius: 5, border: '1px solid var(--border)' }}>{p.source}</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: STATUS_TONE[p.status] ?? 'var(--text-3)', padding: '2px 6px', borderRadius: 5, border: `1px solid color-mix(in srgb, ${STATUS_TONE[p.status] ?? 'var(--text-3)'} 35%, transparent)` }}>{p.status}</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: passed ? 'var(--good)' : 'var(--crit)' }}>{passed ? '✓ passed critique' : '✕ failed critique'}</span>
                    </div>
                    {p.purpose && <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: 'var(--text-2)', margin: '0 0 8px', lineHeight: 1.5 }}>{p.purpose}</p>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.3rem', fontWeight: 800, color: 'var(--cyan)', margin: 0, letterSpacing: '-0.03em' }}>{Math.round(p.confidence * 100)}%</p>
                    <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'var(--text-4)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>confidence</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.66rem', color: 'var(--text-3)', margin: '6px 0 12px', padding: '10px 12px', borderRadius: 8, background: 'var(--bg-badge)', border: '1px solid var(--border)' }}>
                  <div><span style={{ color: 'var(--text-4)' }}>extends</span> {p.extends_engine ?? '—'} · <span style={{ color: 'var(--text-4)' }}>inputs</span> {p.inputs?.join(', ') || '—'}</div>
                  <div><span style={{ color: 'var(--text-4)' }}>formula</span> <code style={{ color: 'var(--text-2)' }}>{p.formula}</code></div>
                  <div><span style={{ color: 'var(--text-4)' }}>preview</span> <span style={{ color: 'var(--good)' }}>{previewStr}</span></div>
                  {p.critique?.llm && (
                    <div>
                      <span style={{ color: 'var(--text-4)' }}>AI critic</span>{' '}
                      {p.critique.llm.checked ? (
                        <span style={{ color: p.critique.llm.sound ? 'var(--good)' : 'var(--crit)' }}>
                          {p.critique.llm.sound ? '✓ sound' : '✕ rejected'}
                          {typeof p.critique.llm.score === 'number' ? ` (${Math.round(p.critique.llm.score * 100)}%)` : ''}
                          {p.critique.llm.notes ? ` — ${p.critique.llm.notes}` : ''}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-4)' }}>not independently reviewed</span>
                      )}
                    </div>
                  )}
                  {p.risks?.length > 0 && <div><span style={{ color: 'var(--warn)' }}>risks</span> {p.risks.join('; ')}</div>}
                </div>

                {p.status === 'proposed' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setStatus(p.id, 'monitoring')} disabled={!passed}
                      title={passed ? 'Approve into a 15-day monitoring window' : 'Cannot approve — failed the critique gate'}
                      style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.76rem', fontWeight: 700, color: passed ? '#04210f' : 'var(--text-4)', background: passed ? 'var(--good)' : 'var(--bg-badge)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', cursor: passed ? 'pointer' : 'not-allowed' }}>
                      Approve → 15-day monitor
                    </button>
                    <button onClick={() => setStatus(p.id, 'rejected')}
                      style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-2)', background: 'var(--bg-badge)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer' }}>
                      Reject
                    </button>
                  </div>
                )}

                {p.status === 'monitoring' && (() => {
                  const dl = daysLeft(p.monitor_until);
                  const fails = p.monitor_fails ?? 0;
                  const runs = p.monitor_runs ?? 0;
                  const eligible = dl === 0 && fails === 0 && runs > 0;
                  return (
                    <div>
                      <div role="status" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'var(--text-3)', margin: '0 0 10px' }}>
                        <span style={{ color: 'var(--cyan)' }}>Monitoring · {dl} day{dl === 1 ? '' : 's'} left</span>
                        <span>re-checks {runs}</span>
                        <span style={{ color: fails > 0 ? 'var(--crit)' : 'var(--good)' }}>failures {fails}</span>
                        {fails > 0 && <span style={{ color: 'var(--crit)' }}>— not stable until it holds 0 failures for the full window</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setStatus(p.id, 'stable')} disabled={!eligible}
                          title={eligible ? 'Promote to stable' : `Stable after ${dl} more day(s) with 0 failures (${runs} re-checks so far)`}
                          style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.76rem', fontWeight: 700, color: eligible ? '#04210f' : 'var(--text-4)', background: eligible ? 'var(--good)' : 'var(--bg-badge)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', cursor: eligible ? 'pointer' : 'not-allowed' }}>
                          Promote to stable
                        </button>
                        <button onClick={() => setStatus(p.id, 'rejected')}
                          style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-2)', background: 'var(--bg-badge)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer' }}>
                          Drop
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </SectionCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
