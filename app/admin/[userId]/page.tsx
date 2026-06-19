'use client';

// Admin · Account detail — one account's profile, tier-change history and a
// recent usage-event timeline.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { AdminAuditRow, UsageEventRow } from '@/lib/admin';

interface DetailPayload {
  profile: Record<string, unknown> | null;
  events: UsageEventRow[];
  audit: AdminAuditRow[];
}

function fmtDateTime(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.7rem', color: 'var(--text-3)', margin: '0 0 4px' }}>{label}</p>
      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-1)', margin: 0, wordBreak: 'break-word' }}>{value || '—'}</p>
    </div>
  );
}

export default function AdminAccountDetailPage() {
  const params = useParams<{ userId: string }>();
  const userId = params?.userId;

  const [data, setData] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`/api/admin/accounts/${userId}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `Failed to load account (${r.status})`);
      setData(j as DetailPayload);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const back = (
    <Link href="/admin" style={{ display: 'inline-block', marginBottom: 14, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: 'var(--text-3)', textDecoration: 'none' }}>
      ← Back to accounts
    </Link>
  );

  if (loading) {
    return (
      <div style={{ padding: '8px 0 48px' }}>
        {back}
        <div className="section-card" aria-busy="true">
          <div className="skeleton" style={{ height: 24, width: 220, marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 80 }} />
        </div>
      </div>
    );
  }

  if (error || !data?.profile) {
    return (
      <div style={{ padding: '8px 0 48px' }}>
        {back}
        <div className="section-card" role="alert" style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: 'Inter, sans-serif', color: 'var(--crit)', margin: '0 0 12px' }}>{error || 'Account not found.'}</p>
          <button type="button" onClick={() => void load()} style={{ minHeight: 40, padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border-md)', background: 'var(--bg-card)', color: 'var(--text-2)', fontFamily: 'Inter, sans-serif', fontWeight: 600, cursor: 'pointer' }}>Try again</button>
        </div>
      </div>
    );
  }

  const p = data.profile as Record<string, string | null>;
  const tier = (p.tier as string) || 'free';

  return (
    <div style={{ padding: '8px 0 48px', maxWidth: 920 }}>
      {back}
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-1)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
          {p.business_name || '—'}
        </h1>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: 'var(--text-3)', margin: 0 }}>{p.email}</p>
      </header>

      <div className="section-card" style={{ marginBottom: 16 }}>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px' }}>Profile</p>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          <Fact label="Plan" value={<span style={{ textTransform: 'uppercase' }}>{tier}</span>} />
          <Fact label="Tier source" value={p.tier_source} />
          <Fact label="Granted by" value={p.tier_granted_by} />
          <Fact label="Business type" value={p.business_type} />
          <Fact label="Industry" value={p.industry} />
          <Fact label="Location" value={p.location} />
          <Fact label="Currency" value={p.currency} />
          <Fact label="Phone" value={p.phone} />
          <Fact label="WhatsApp" value={p.whatsapp} />
          <Fact label="Contact email" value={p.contact_email} />
          <Fact label="Member since" value={fmtDateTime(p.created_at)} />
          <Fact label="Last active" value={fmtDateTime(p.last_active_at)} />
        </div>
      </div>

      <div className="section-card" style={{ marginBottom: 16 }}>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px' }}>Tier history</p>
        {data.audit.length === 0 ? (
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', color: 'var(--text-3)', margin: 0 }}>No admin tier changes recorded.</p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {data.audit.map((a) => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: 'var(--text-2)' }}>
                  {a.action === 'set_tier' ? `Set to ${String((a.detail as { tier?: string }).tier ?? '').toUpperCase()}` : a.action}
                  <span style={{ color: 'var(--text-4)' }}> · by {a.admin_email}</span>
                </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: 'var(--text-4)', flexShrink: 0 }}>{fmtDateTime(a.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section-card">
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px' }}>Recent activity</p>
        {data.events.length === 0 ? (
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', color: 'var(--text-3)', margin: 0 }}>No usage events yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {data.events.map((ev) => (
              <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: 'var(--text-2)' }}>
                  {ev.event}
                  {ev.engine && <span style={{ color: 'var(--text-4)' }}> · {ev.engine}</span>}
                </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: 'var(--text-4)', flexShrink: 0 }}>{fmtDateTime(ev.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
