'use client';

// BusinessSwitcher — pick which venture's books you're looking at (audit #16).
// The active business id lives in localStorage (ACTIVE_BUSINESS_KEY) and rides
// every backend call via authHeaders' X-Business-Id. Switching reloads so all
// scoped data (twin, events, catalog, invoices) refetches under the new books.
// Hidden for team members (they act in the owner's single tenant context) and
// for accounts with no businesses yet (pre-migration-0023).

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { listBusinesses, createBusiness, ACTIVE_BUSINESS_KEY, type Business } from '@/lib/api';
import { useProfile } from '@/lib/profile';
import { canAccess, requiredTier, TIERS, type Tier } from '@/lib/tiers';
import { useStore } from '@/lib/store';

export default function BusinessSwitcher() {
  const { teamRole } = useProfile();
  const tier = useStore((s) => s.tier);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (teamRole !== 'owner') return;
    listBusinesses().then(({ businesses: bs, active }) => {
      setBusinesses(bs);
      let stored: string | null = null;
      try { stored = window.localStorage.getItem(ACTIVE_BUSINESS_KEY); } catch { /* private */ }
      setActiveId(stored && bs.some((b) => b.id === stored) ? stored : (active ?? bs[0]?.id ?? null));
    }).catch(() => {});
  }, [teamRole]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Only owners with a real (migrated) business list see the switcher.
  if (teamRole !== 'owner' || businesses.length === 0) return null;

  const active = businesses.find((b) => b.id === activeId) ?? businesses[0];
  const canMulti = canAccess(tier as Tier, 'multi_business');

  function switchTo(id: string) {
    try { window.localStorage.setItem(ACTIVE_BUSINESS_KEY, id); } catch { /* private */ }
    window.location.reload();     // refetch everything under the new books
  }

  async function add() {
    if (!name.trim()) return;
    setBusy(true); setError(null);
    try {
      const b = await createBusiness({ name: name.trim() });
      switchTo(b.id);             // jump straight into the new venture
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}
        className="touch-target"
        style={{ display: 'flex', alignItems: 'center', gap: 6, maxWidth: 200, padding: '6px 10px', minHeight: 34, borderRadius: 8, border: '1px solid var(--border-md)', background: 'var(--bg-card)', color: 'var(--text-1)', fontSize: 'var(--fs-data)', fontWeight: 600, cursor: 'pointer' }}>
        <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--cyan)', flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{active?.name ?? 'Business'}</span>
        <span aria-hidden style={{ color: 'var(--text-4)' }}>▾</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div role="menu" aria-label="Switch business"
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.14 }}
            className="dash-pop" style={{ width: 'min(280px, 92vw)', right: 0 }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 'var(--fs-label)', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your businesses</div>
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              {businesses.map((b) => (
                <button key={b.id} type="button" role="menuitem" onClick={() => b.id !== active?.id && switchTo(b.id)}
                  style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '11px 14px', border: 'none', background: b.id === active?.id ? 'var(--bg-badge)' : 'transparent', color: 'var(--text-1)', fontSize: 'var(--fs-body)', fontWeight: b.id === active?.id ? 700 : 500, cursor: 'pointer', textAlign: 'left' }}>
                  <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: b.id === active?.id ? 'var(--cyan)' : 'var(--border-md)', flexShrink: 0 }} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
                  {b.is_default && <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)' }}>default</span>}
                </button>
              ))}
            </div>

            <div style={{ borderTop: '1px solid var(--border)', padding: '10px 14px' }}>
              {adding ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New business name"
                    aria-label="New business name" autoFocus
                    style={{ minHeight: 36, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border-md)', background: 'var(--bg-card)', color: 'var(--text-1)', fontSize: 'var(--fs-data)' }} />
                  {error && <span style={{ fontSize: 'var(--fs-label)', color: 'var(--crit)' }}>{error}</span>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => void add()} disabled={busy || !name.trim()}
                      style={{ flex: 1, minHeight: 34, borderRadius: 8, border: 'none', background: 'var(--cyan)', color: '#04121a', fontWeight: 700, cursor: 'pointer', fontSize: 'var(--fs-data)' }}>
                      {busy ? 'Adding…' : 'Add & switch'}
                    </button>
                    <button type="button" onClick={() => { setAdding(false); setError(null); }} style={{ minHeight: 34, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--text-3)', fontWeight: 600, cursor: 'pointer', fontSize: 'var(--fs-data)' }}>Cancel</button>
                  </div>
                </div>
              ) : canMulti ? (
                <button type="button" onClick={() => setAdding(true)}
                  style={{ width: '100%', minHeight: 36, borderRadius: 8, border: '1px dashed var(--border-md)', background: 'transparent', color: 'var(--cyan)', fontWeight: 600, cursor: 'pointer', fontSize: 'var(--fs-data)' }}>
                  + Add a business
                </button>
              ) : (
                <a href={`/checkout?plan=${requiredTier('multi_business')}`}
                  style={{ display: 'block', textAlign: 'center', fontSize: 'var(--fs-label)', color: 'var(--text-3)', textDecoration: 'none' }}>
                  Run several businesses under one login with <strong style={{ color: 'var(--cyan)' }}>{TIERS[requiredTier('multi_business')].name}</strong>
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
