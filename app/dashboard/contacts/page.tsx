'use client';
/**
 * AI-BOS — Contacts (audit #6): the customer & supplier ENTITIES AIBOS builds
 * from what you record, finally with a home. Shows who you deal with, how much
 * has flowed each way, and a MERGE TOOL to fold duplicate records into one
 * (AIBOS then remembers the alias so it never splits them again).
 */
import { useCallback, useEffect, useState } from 'react';
import { listParties, mergeParties, type Party } from '@/lib/api';
import { useStore } from '@/lib/store';
import { fmt } from '@/lib/utils';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';

const KIND_LABEL: Record<Party['kind'], string> = { customer: 'Customer', supplier: 'Supplier', both: 'Both' };

export default function ContactsPage() {
  const sym = useStore((s) => s.currencySymbol) || 'K';
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mergeMode, setMergeMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setParties(await listParties()); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  function toggle(id: string) {
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : s.length < 2 ? [...s, id] : [s[1], id]);
  }

  async function doMerge() {
    if (selected.length !== 2) return;
    const [keep, remove] = selected;
    setBusy(true); setError(null);
    try {
      await mergeParties(keep, remove);
      setSelected([]); setMergeMode(false);
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  const keepName = parties.find((p) => p.id === selected[0])?.name;
  const dropName = parties.find((p) => p.id === selected[1])?.name;

  return (
    <>
      <PageHeader
        title="Contacts"
        subtitle="The customers and suppliers AIBOS learns from what you record."
      />

      {error && <p role="alert" style={{ color: 'var(--crit)', fontSize: 'var(--fs-body)', margin: '0 0 14px' }}>{error}</p>}

      <SectionCard
        title={`${parties.length} contact${parties.length === 1 ? '' : 's'}`}
        subtitle={mergeMode ? 'Pick the two to combine — the first you keep, the second folds in.' : 'Money in (as customer) and money out (as supplier), from your records.'}
        action={
          parties.length > 1 ? (
            <button type="button" onClick={() => { setMergeMode((v) => !v); setSelected([]); }}
              style={{ minHeight: 32, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-md)', background: mergeMode ? 'var(--bg-badge)' : 'transparent', color: 'var(--text-3)', fontWeight: 600, cursor: 'pointer', fontSize: 'var(--fs-label)' }}>
              {mergeMode ? 'Cancel' : 'Merge duplicates'}
            </button>
          ) : undefined
        }
      >
        {loading ? (
          <div className="skeleton" style={{ height: 120 }} />
        ) : parties.length === 0 ? (
          <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: 0 }}>
            No contacts yet — as you record sales and purchases with a customer or supplier name, they appear here.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {parties.map((p) => {
              const sel = selected.includes(p.id);
              return (
                <div key={p.id}
                  onClick={mergeMode ? () => toggle(p.id) : undefined}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, cursor: mergeMode ? 'pointer' : 'default', border: `1px solid ${sel ? 'var(--cyan)' : 'var(--border)'}`, background: sel ? 'var(--cyan-dim)' : 'transparent' }}>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-1)' }}>{p.name}</span>
                    <span className="badge" style={{ marginLeft: 8, color: 'var(--text-3)', borderColor: 'var(--border)' }}>{KIND_LABEL[p.kind]}</span>
                  </span>
                  <span style={{ display: 'flex', gap: 14, flexShrink: 0, fontSize: 'var(--fs-label)', fontVariantNumeric: 'tabular-nums' }}>
                    {p.stats && p.stats.revenue > 0 && <span style={{ color: 'var(--good)' }}>in {fmt(p.stats.revenue, true, sym)}</span>}
                    {p.stats && p.stats.spend > 0 && <span style={{ color: 'var(--text-3)' }}>out {fmt(p.stats.spend, true, sym)}</span>}
                    <span style={{ color: 'var(--text-4)' }}>{p.stats?.txn_count ?? 0}×</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {mergeMode && selected.length === 2 && (
          <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 8, border: '1px solid var(--cyan)', background: 'var(--bg-card)' }}>
            <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-1)', margin: '0 0 10px' }}>
              Keep <strong>{keepName}</strong>, fold <strong>{dropName}</strong> into it? AIBOS will remember they&apos;re the same from now on.
            </p>
            <button type="button" onClick={() => void doMerge()} disabled={busy}
              style={{ minHeight: 40, padding: '9px 16px', borderRadius: 8, border: 'none', background: 'var(--cyan)', color: '#04121a', fontWeight: 700, cursor: 'pointer' }}>
              {busy ? 'Merging…' : 'Merge them'}
            </button>
          </div>
        )}
      </SectionCard>
    </>
  );
}
