'use client';

// Admin · Accounts — every account with tier, source, signup, last active and
// usage counts. Search / filter / sort, and one-click tier actions (with the
// flagship "Grant full access (demo)"). Optimistic UI + aria-live toast.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { AccountOverview } from '@/lib/admin';
import type { Tier } from '@/lib/tiers';

// ── Small presentational helpers ─────────────────────────────────────────────

function tierStyle(tier: Tier): React.CSSProperties {
  if (tier === 'growth')
    return { color: 'var(--e3)', background: 'color-mix(in srgb, var(--e3) 14%, transparent)', borderColor: 'color-mix(in srgb, var(--e3) 35%, transparent)' };
  if (tier === 'pro')
    return { color: 'var(--cyan)', background: 'var(--cyan-dim)', borderColor: 'color-mix(in srgb, var(--cyan) 35%, transparent)' };
  return { color: 'var(--text-3)', background: 'var(--bg-badge)', borderColor: 'var(--border)' };
}

function TierBadge({ tier }: { tier: Tier }) {
  return (
    <span className="badge" style={{ ...tierStyle(tier), textTransform: 'uppercase' }}>
      {tier}
    </span>
  );
}

function SourceTag({ source }: { source: string | null }) {
  if (source === 'admin_demo')
    return (
      <span className="badge" style={{ color: 'var(--warn)', background: 'color-mix(in srgb, var(--warn) 14%, transparent)', borderColor: 'color-mix(in srgb, var(--warn) 35%, transparent)' }}>
        DEMO GRANT
      </span>
    );
  if (source === 'payment')
    return <span className="badge" style={{ color: 'var(--good)', background: 'color-mix(in srgb, var(--good) 14%, transparent)', borderColor: 'color-mix(in srgb, var(--good) 35%, transparent)' }}>PAID</span>;
  return <span style={{ color: 'var(--text-4)' }}>—</span>;
}

function fmtDate(v: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' });
}

const btn = (variant: 'primary' | 'ghost'): React.CSSProperties => ({
  minHeight: 36,
  padding: '7px 12px',
  borderRadius: 8,
  fontFamily: 'Geist, sans-serif',
  fontSize: '0.74rem',
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  border: variant === 'primary' ? 'none' : '1px solid var(--border-md)',
  background: variant === 'primary' ? 'var(--cyan)' : 'var(--bg-card)',
  color: variant === 'primary' ? '#fff' : 'var(--text-2)',
});

// ── Page ─────────────────────────────────────────────────────────────────────

type SortKey = 'active' | 'signup';

export default function AdminAccountsPage() {
  const narrow = useMediaQuery('(max-width: 767px)');

  const [accounts, setAccounts] = useState<AccountOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null);

  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | Tier>('all');
  const [sort, setSort] = useState<SortKey>('active');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/admin/accounts');
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `Failed to load accounts (${r.status})`);
      setAccounts((j.accounts ?? []) as AccountOverview[]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const setTier = useCallback(
    async (acc: AccountOverview, tier: Tier) => {
      if (busyId) return;
      const source = tier === 'free' ? 'self' : 'admin_demo';
      setBusyId(acc.id);
      const prev = accounts;
      // Optimistic.
      setAccounts((list) => list.map((a) => (a.id === acc.id ? { ...a, tier, tier_source: source } : a)));
      try {
        const r = await fetch('/api/admin/set-tier', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetUserId: acc.id, tier, source }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Update failed');
        setToast({ msg: `${acc.business_name || acc.email || 'Account'} set to ${tier.toUpperCase()}.`, kind: 'ok' });
      } catch (e) {
        setAccounts(prev); // revert
        setToast({ msg: (e as Error).message || 'Could not update tier.', kind: 'err' });
      } finally {
        setBusyId(null);
      }
    },
    [accounts, busyId]
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = accounts;
    if (q) list = list.filter((a) => (a.business_name ?? '').toLowerCase().includes(q) || (a.email ?? '').toLowerCase().includes(q));
    if (tierFilter !== 'all') list = list.filter((a) => a.tier === tierFilter);
    const key = sort === 'active' ? 'last_event_at' : 'created_at';
    return [...list].sort((a, b) => {
      const av = a[key] ? new Date(a[key] as string).getTime() : 0;
      const bv = b[key] ? new Date(b[key] as string).getTime() : 0;
      return bv - av;
    });
  }, [accounts, search, tierFilter, sort]);

  // ── Per-row actions ────────────────────────────────────────────────────────
  function Actions({ acc }: { acc: AccountOverview }) {
    const busy = busyId === acc.id;
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => setTier(acc, 'growth')}
          disabled={busy || acc.tier === 'growth'}
          aria-label={`Grant full access (demo) to ${acc.business_name || acc.email}`}
          style={{ ...btn('primary'), opacity: busy || acc.tier === 'growth' ? 0.5 : 1, cursor: busy || acc.tier === 'growth' ? 'default' : 'pointer' }}
        >
          {busy ? 'Working…' : acc.tier === 'growth' ? 'Full access ✓' : 'Grant full access (demo)'}
        </button>
        <button type="button" onClick={() => setTier(acc, 'pro')} disabled={busy || acc.tier === 'pro'} style={{ ...btn('ghost'), opacity: busy || acc.tier === 'pro' ? 0.5 : 1 }}>
          Pro
        </button>
        <button type="button" onClick={() => setTier(acc, 'free')} disabled={busy || acc.tier === 'free'} style={{ ...btn('ghost'), opacity: busy || acc.tier === 'free' ? 0.5 : 1 }}>
          Revert to Free
        </button>
      </div>
    );
  }

  // ── States ─────────────────────────────────────────────────────────────────
  const header = (
    <header style={{ marginBottom: 18 }}>
      <h1 style={{ fontFamily: 'Geist, sans-serif', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-1)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
        Accounts
      </h1>
      <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.85rem', color: 'var(--text-3)', margin: 0 }}>
        {loading ? 'Loading accounts…' : `${accounts.length} account${accounts.length === 1 ? '' : 's'}. Grant full access instantly to demo the product live.`}
      </p>
    </header>
  );

  const controls = (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search name or email…"
        aria-label="Search accounts by name or email"
        style={{ flex: '1 1 220px', minHeight: 42, padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border-md)', background: 'var(--bg-input)', color: 'var(--text-1)', fontFamily: 'Geist, sans-serif', fontSize: '0.84rem', outline: 'none' }}
      />
      <select aria-label="Filter by tier" value={tierFilter} onChange={(e) => setTierFilter(e.target.value as 'all' | Tier)} style={{ minHeight: 42, padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border-md)', background: 'var(--bg-input)', color: 'var(--text-1)', fontFamily: 'Geist, sans-serif', fontSize: '0.82rem' }}>
        <option value="all">All tiers</option>
        <option value="free">Free</option>
        <option value="pro">Pro</option>
        <option value="growth">Growth</option>
      </select>
      <select aria-label="Sort accounts" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} style={{ minHeight: 42, padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border-md)', background: 'var(--bg-input)', color: 'var(--text-1)', fontFamily: 'Geist, sans-serif', fontSize: '0.82rem' }}>
        <option value="active">Sort: last active</option>
        <option value="signup">Sort: signup date</option>
      </select>
    </div>
  );

  const toastEl = (
    <div aria-live="polite" style={{ minHeight: 0 }}>
      {toast && (
        <div role="status" style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, fontFamily: 'Geist, sans-serif', fontSize: '0.8rem', background: toast.kind === 'ok' ? 'color-mix(in srgb, var(--good) 12%, transparent)' : 'color-mix(in srgb, var(--crit) 12%, transparent)', border: `1px solid ${toast.kind === 'ok' ? 'color-mix(in srgb, var(--good) 35%, transparent)' : 'color-mix(in srgb, var(--crit) 35%, transparent)'}`, color: toast.kind === 'ok' ? 'var(--good)' : 'var(--crit)' }}>
          {toast.msg}
        </div>
      )}
    </div>
  );

  let body: React.ReactNode;
  if (loading) {
    body = (
      <div className="section-card">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 44, marginBottom: 10 }} />
        ))}
      </div>
    );
  } else if (error) {
    body = (
      <div className="section-card" role="alert" style={{ textAlign: 'center' }}>
        <p style={{ fontFamily: 'Geist, sans-serif', color: 'var(--crit)', margin: '0 0 12px' }}>{error}</p>
        <button type="button" onClick={() => void load()} style={btn('ghost')}>Try again</button>
      </div>
    );
  } else if (accounts.length === 0) {
    body = (
      <div className="section-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.9rem', color: 'var(--text-2)', margin: '0 0 4px', fontWeight: 600 }}>No accounts yet</p>
        <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.82rem', color: 'var(--text-3)', margin: 0 }}>Accounts appear here after their first sign-in.</p>
      </div>
    );
  } else if (rows.length === 0) {
    body = (
      <div className="section-card" style={{ textAlign: 'center', padding: '32px 20px' }}>
        <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.84rem', color: 'var(--text-3)', margin: 0 }}>No accounts match your filters.</p>
      </div>
    );
  } else if (narrow) {
    // Stacked cards below md.
    body = (
      <div style={{ display: 'grid', gap: 12 }}>
        {rows.map((a) => (
          <div key={a.id} className="section-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
              <div style={{ minWidth: 0 }}>
                <Link href={`/admin/${a.id}`} style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-1)', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.business_name || '—'}
                </Link>
                <span style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.66rem', color: 'var(--text-3)' }}>{a.email}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                <TierBadge tier={a.tier} />
                <SourceTag source={a.tier_source} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontFamily: 'Geist, sans-serif', fontSize: '0.66rem', color: 'var(--text-3)', marginBottom: 12 }}>
              <span>Joined {fmtDate(a.created_at)}</span>
              <span>Active {fmtDate(a.last_event_at)}</span>
              <span>{a.uploads} uploads</span>
              <span>{a.chats} chats</span>
            </div>
            <Actions acc={a} />
          </div>
        ))}
      </div>
    );
  } else {
    // Desktop table.
    body = (
      <div className="section-card" style={{ overflowX: 'auto', padding: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Business</th>
              <th scope="col">Tier</th>
              <th scope="col">Source</th>
              <th scope="col">Signed up</th>
              <th scope="col">Last active</th>
              <th scope="col" style={{ textAlign: 'right' }}>Uploads</th>
              <th scope="col" style={{ textAlign: 'right' }}>Chats</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td style={{ maxWidth: 240 }}>
                  <Link href={`/admin/${a.id}`} style={{ color: 'var(--text-1)', fontWeight: 700, textDecoration: 'none', display: 'block', fontFamily: 'Geist, sans-serif', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.business_name || '—'}
                  </Link>
                  <span style={{ color: 'var(--text-3)', fontSize: '0.66rem' }}>{a.email}</span>
                </td>
                <td><TierBadge tier={a.tier} /></td>
                <td><SourceTag source={a.tier_source} /></td>
                <td>{fmtDate(a.created_at)}</td>
                <td>{fmtDate(a.last_event_at)}</td>
                <td style={{ textAlign: 'right' }}>{a.uploads}</td>
                <td style={{ textAlign: 'right' }}>{a.chats}</td>
                <td><Actions acc={a} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 0 48px' }}>
      {header}
      <nav aria-label="Admin sections" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Link href="/admin" aria-current="page" style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-1)', textDecoration: 'none', padding: '6px 12px', borderRadius: 8, background: 'var(--bg-badge)', border: '1px solid var(--border)' }}>Accounts</Link>
        <Link href="/admin/usage" style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-3)', textDecoration: 'none', padding: '6px 12px', borderRadius: 8 }}>Usage</Link>
        <Link href="/admin/proposals" style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-3)', textDecoration: 'none', padding: '6px 12px', borderRadius: 8 }}>Proposals</Link>
      </nav>
      {controls}
      {toastEl}
      {body}
    </div>
  );
}
