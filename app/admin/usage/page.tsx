'use client';

// Admin · Usage — aggregate activity across all accounts. KPIs + a 30-day
// activity time series + top accounts. Reuses KPICard / SectionCard.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import KPICard from '@/components/ui/KPICard';
import SectionCard from '@/components/ui/SectionCard';
import type { UsageAggregate } from '@/lib/admin';

export default function AdminUsagePage() {
  const [data, setData] = useState<UsageAggregate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/admin/usage');
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `Failed to load usage (${r.status})`);
      setData(j as UsageAggregate);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const nav = (
    <nav aria-label="Admin sections" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      <Link href="/admin" style={{ fontSize: 'var(--fs-data)', fontWeight: 600, color: 'var(--text-3)', textDecoration: 'none', padding: '6px 12px', borderRadius: 8 }}>Accounts</Link>
      <Link href="/admin/usage" aria-current="page" style={{ fontSize: 'var(--fs-data)', fontWeight: 700, color: 'var(--text-1)', textDecoration: 'none', padding: '6px 12px', borderRadius: 8, background: 'var(--bg-badge)', border: '1px solid var(--border)' }}>Usage</Link>
      <Link href="/admin/proposals" style={{ fontSize: 'var(--fs-data)', fontWeight: 600, color: 'var(--text-3)', textDecoration: 'none', padding: '6px 12px', borderRadius: 8 }}>Proposals</Link>
    </nav>
  );

  const header = (
    <header style={{ marginBottom: 18 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-1)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
        Usage
      </h1>
      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: 0 }}>
        Activity across every account over the last 30 days.
      </p>
    </header>
  );

  let body: React.ReactNode;
  if (loading) {
    body = (
      <div className="grid-kpi" style={{ display: 'grid', gap: 14 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 120 }} />
        ))}
      </div>
    );
  } else if (error) {
    body = (
      <div className="section-card" role="alert" style={{ textAlign: 'center' }}>
        <p style={{ color: 'var(--crit)', margin: '0 0 12px' }}>{error}</p>
        <button type="button" onClick={() => void load()} style={{ minHeight: 40, padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border-md)', background: 'var(--bg-card)', color: 'var(--text-2)', fontWeight: 600, cursor: 'pointer' }}>Try again</button>
      </div>
    );
  } else if (data) {
    const hasActivity = data.series.some((d) => d.total > 0);
    body = (
      <>
        <div className="grid-kpi" style={{ display: 'grid', gap: 14, marginBottom: 16 }}>
          <KPICard label="Active accounts" sublabel="last 30 days" value={String(data.activeAccounts30)} sub={`of ${data.totalAccounts} total`} />
          <KPICard label="Total accounts" value={String(data.totalAccounts)} sub="all time" />
          <KPICard label="Uploads" sublabel="last 30 days" value={String(data.uploads30)} sub={`${data.uploads7} in last 7d`} sparkColor="var(--cyan)" />
          <KPICard label="AI chats" sublabel="last 30 days" value={String(data.chats30)} sub={`${data.chats7} in last 7d`} sparkColor="#f97316" />
        </div>

        <SectionCard
          title="Activation funnel"
          subtitle={`Signup → onboarded → recorded data → saw an insight, all time. Recording tracked since ${data.funnel.trackedSince}.`}
          style={{ marginBottom: 16 }}
        >
          <div style={{ display: 'grid', gap: 10 }}>
            {([
              ['Signed up', data.funnel.signups],
              ['Completed onboarding', data.funnel.onboarded],
              ['Recorded data', data.funnel.recordedData],
              ['Saw an insight', data.funnel.sawInsight],
            ] as [string, number][]).map(([label, count]) => {
              const pct = data.funnel.signups > 0 ? Math.round((count / data.funnel.signups) * 100) : 0;
              return (
                <div key={label} style={{ display: 'grid', gridTemplateColumns: '170px 1fr 72px', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', fontWeight: 600 }}>{label}</span>
                  <div style={{ height: 10, borderRadius: 5, background: 'var(--bg-badge)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: 5, background: 'var(--cyan)', transition: 'width .4s ease' }} />
                  </div>
                  <span style={{ fontSize: 'var(--fs-data)', color: 'var(--text-1)', fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {count} · {pct}%
                  </span>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: '14px 0 0' }}>
            Recording habit (≥3 days in first week):{' '}
            <strong style={{ color: 'var(--text-1)' }}>
              {data.funnel.habitEligible > 0
                ? `${data.funnel.habitFormed} of ${data.funnel.habitEligible} eligible accounts`
                : 'no accounts eligible yet'}
            </strong>
            {' '}— the audit’s 90-day exit metric is 40%.
          </p>
        </SectionCard>

        <SectionCard title="Activity — last 30 days" subtitle="Uploads and AI chats per day" style={{ marginBottom: 16 }}>
          {hasActivity ? (
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.series} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'var(--text-4)' }} tickFormatter={(d: string) => d.slice(5)} minTickGap={24} stroke="var(--border)" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--text-4)' }} stroke="var(--border)" width={36} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-md)', borderRadius: 10, fontSize: 'var(--fs-data)' }} labelStyle={{ color: 'var(--text-2)' }} />
                  <Line type="monotone" dataKey="uploads" name="Uploads" stroke="var(--cyan)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="chats" name="Chats" stroke="#f97316" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: 0, padding: '24px 0', textAlign: 'center' }}>
              No activity recorded in the last 30 days yet.
            </p>
          )}
        </SectionCard>

        <SectionCard title="Most active accounts" subtitle="By total events in the last 30 days">
          {data.topAccounts.length === 0 ? (
            <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: 0 }}>No activity yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {data.topAccounts.map((t) => (
                <Link key={t.user_id} href={`/admin/${t.user_id}`} className="dash-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 8, textDecoration: 'none', border: '1px solid var(--border)' }}>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-1)' }}>{t.business_name || '—'}</span>
                    <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', marginLeft: 8 }}>{t.email}</span>
                  </span>
                  <span style={{ fontSize: 'var(--fs-label)', color: 'var(--cyan)', fontWeight: 700, flexShrink: 0 }}>{t.events} events</span>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
      </>
    );
  }

  return (
    <div style={{ padding: '8px 0 48px' }}>
      {header}
      {nav}
      {body}
    </div>
  );
}
