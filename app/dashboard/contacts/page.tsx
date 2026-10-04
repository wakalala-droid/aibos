'use client';
/**
 * AIBOS — Contacts (audit #6): the customer & supplier ENTITIES AIBOS builds
 * from what you record, finally with a home. Shows who you deal with, how much
 * has flowed each way, and a MERGE TOOL to fold duplicate records into one
 * (AIBOS then remembers the alias so it never splits them again).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Combine, Search } from 'lucide-react';
import { deleteParty, listParties, mergeParties, type Party } from '@/lib/api';
import { confirmSheet } from '@/lib/confirm';
import { notify } from '@/lib/toast';
import { useStore } from '@/lib/store';
import { fmt } from '@/lib/utils';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import Stat from '@/components/ui/Stat';

const KIND_LABEL: Record<Party['kind'], string> = { customer: 'Customer', supplier: 'Supplier', both: 'Customer and supplier' };

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('') || '?';
}

type Show = 'all' | 'customer' | 'supplier';

export default function ContactsPage() {
  const sym = useStore((s) => s.currencySymbol) || 'K';
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mergeMode, setMergeMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState<Show>('all');
  const [query, setQuery] = useState('');

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

  const sells = parties.filter((p) => p.kind !== 'supplier');
  const buys = parties.filter((p) => p.kind !== 'customer');
  const top = useMemo(() => [...parties].sort((a, b) => (b.stats?.revenue ?? 0) - (a.stats?.revenue ?? 0))[0], [parties]);
  const shown = parties.filter((p) =>
    (show === 'all' || (show === 'customer' ? p.kind !== 'supplier' : p.kind !== 'customer'))
    && (!query.trim() || p.name.toLowerCase().includes(query.trim().toLowerCase())));

  const keepName = parties.find((p) => p.id === selected[0])?.name;
  const dropName = parties.find((p) => p.id === selected[1])?.name;

  // A name read from a note or a file that is not a person or business
  // (UI/UX audit A24). Only the contact goes; its entries stay in the books.
  async function notCustomer(p: Party) {
    const ok = await confirmSheet({
      title: `Take ${p.name} off your contacts?`,
      body: 'Its sales and payments stay in your books. It comes back only if you record it as a customer or supplier again.',
      confirmLabel: 'Take it off',
      cancelLabel: 'Keep it',
    });
    if (!ok) return;
    try {
      await deleteParty(p.id);
      setParties((xs) => xs.filter((x) => x.id !== p.id));
      notify(`${p.name} is off your contacts.`);
    } catch (e) { setError((e as Error).message); }
  }

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle="Everyone you sell to or buy from, learned from what you record."
        actions={parties.length > 1 ? (
          <button type="button" className="pill" aria-pressed={mergeMode} onClick={() => { setMergeMode((v) => !v); setSelected([]); }}>
            <Combine aria-hidden="true" />{mergeMode ? 'Stop merging' : 'Merge duplicates'}
          </button>
        ) : undefined}
      />

      {error && <p role="alert" style={{ color: 'var(--crit)', fontSize: 'var(--fs-body)', margin: '0 0 16px' }}>{error}</p>}

      <div className="home-trio" style={{ marginBottom: 16 }}>
        <Stat label="You sell to" count={sells.length} loading={loading}
          sub={sells.length === 1 ? 'customer' : 'customers'} />
        <Stat label="You buy from" count={buys.length} loading={loading}
          sub={buys.length === 1 ? 'supplier' : 'suppliers'} />
        <Stat label="Best customer" loading={loading}
          text={top && (top.stats?.revenue ?? 0) > 0 ? top.name : 'Not yet'}
          sub={top && (top.stats?.revenue ?? 0) > 0 ? `${fmt(top.stats!.revenue, false, sym)} brought in` : 'Record a sale with a name to see who'} />
      </div>

      <SectionCard
        title={mergeMode ? 'Pick the two to combine' : 'Everyone'}
        subtitle={mergeMode ? 'The first you pick is kept, the second folds into it.' : undefined}
      >
        {!mergeMode && parties.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
            <div className="chips" role="group" aria-label="Show">
              {([['all', 'All'], ['customer', 'Customers'], ['supplier', 'Suppliers']] as const).map(([k, l]) => (
                <button key={k} type="button" className="chip" aria-pressed={show === k} onClick={() => setShow(k)}>{l}</button>
              ))}
            </div>
            <label style={{ position: 'relative', flex: '1 1 220px', maxWidth: 360, marginLeft: 'auto' }}>
              <span className="sr-only">Find a contact</span>
              <Search aria-hidden="true" style={{ position: 'absolute', left: 14, top: 13, width: 18, height: 18, color: 'var(--text-4)' }} />
              <input className="field" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a name" style={{ paddingLeft: 42, borderRadius: 999 }} />
            </label>
          </div>
        )}
        {loading ? (
          <div className="skeleton" style={{ height: 120 }} />
        ) : parties.length === 0 ? (
          <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: 0 }}>
            No contacts yet. As you record sales and purchases with a customer or supplier name, they appear here.
          </p>
        ) : shown.length === 0 ? (
          <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: 0 }}>Nobody matches that.</p>
        ) : (
          <div>
            {shown.map((p) => {
              const sel = selected.includes(p.id);
              const order = selected.indexOf(p.id);
              const inbound = p.stats?.revenue ?? 0;
              const outbound = p.stats?.spend ?? 0;
              const times = p.stats?.txn_count ?? 0;
              return (
                <div key={p.id} className="row"
                  role={mergeMode ? 'button' : undefined}
                  tabIndex={mergeMode ? 0 : undefined}
                  aria-pressed={mergeMode ? sel : undefined}
                  onClick={mergeMode ? () => toggle(p.id) : undefined}
                  onKeyDown={mergeMode ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(p.id); } } : undefined}
                  style={{ cursor: mergeMode ? 'pointer' : 'default', flexWrap: 'wrap', ...(sel ? { background: 'var(--cyan-dim)', boxShadow: 'inset 0 0 0 1px var(--cyan)' } : {}) }}>
                  <span className={`avatar${p.kind === 'supplier' ? '' : ' avatar-brand'}`} aria-hidden="true">{initials(p.name)}</span>
                  <span className="row-main">
                    <span className="row-title">{p.name}</span>
                    <span className="row-sub">
                      {mergeMode && sel ? (order === 0 ? 'Keep this one' : 'Fold this one in') : `${KIND_LABEL[p.kind]}, ${times} time${times === 1 ? '' : 's'}`}
                    </span>
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    {inbound > 0 && <span className="row-amount in">+{fmt(inbound, false, sym)}</span>}
                    {outbound > 0 && <span className="row-amount" style={{ color: 'var(--text-2)', fontWeight: 500 }}>−{fmt(outbound, false, sym)}</span>}
                  </span>
                  {!mergeMode && (
                    <button type="button" className="pill pill-quiet" onClick={() => void notCustomer(p)}
                      aria-label={`${p.name} is not a customer or supplier`}>
                      Not a contact
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {mergeMode && selected.length === 2 && (
          <div style={{ marginTop: 16, padding: 16, borderRadius: 'var(--radius-md)', background: 'var(--pill-bg)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-1)', margin: 0, flex: '1 1 260px' }}>
              Keep <strong>{keepName}</strong> and fold <strong>{dropName}</strong> into it? AIBOS remembers they&apos;re the same from now on.
            </p>
            <button type="button" className="pill pill-primary" onClick={() => void doMerge()} disabled={busy}>
              {busy ? 'Merging…' : 'Merge them'}
            </button>
          </div>
        )}
      </SectionCard>
    </>
  );
}
