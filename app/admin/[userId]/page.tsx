'use client';

// Admin · Account detail — one account's profile, tier-change history and a
// recent usage-event timeline.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { AdminAuditRow, UsageEventRow } from '@/lib/admin';
import { TIERS, TIER_ORDER, isTier, type Tier } from '@/lib/tiers';
import HospitalitySetup from '@/components/admin/HospitalitySetup';

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

/** Plain English for an audit row. Without this the new hospitality actions
 *  render as raw ids next to a sentence, which reads as a bug in the log. */
function describeAudit(action: string, detail: unknown): string {
  const d = (detail ?? {}) as { tier?: string; source?: string; billing?: string; paid_until?: string | null; schedule?: string; property?: string; units?: string[]; result?: string };
  if (action === 'set_tier' && d.schedule === 'join_date') {
    const name = isTier(d.tier) ? TIERS[d.tier].name : String(d.tier ?? '');
    return `Put on ${name}, billed ${d.billing === 'annual' ? 'yearly' : 'monthly'} from the day they joined${d.paid_until ? `. First renewal ${fmtDate(d.paid_until)}` : ''}`;
  }
  if (action === 'set_tier' && d.source === 'payment') {
    const name = isTier(d.tier) ? TIERS[d.tier].name : String(d.tier ?? '');
    return `Recorded a ${d.billing === 'annual' ? 'yearly' : 'monthly'} ${name} payment${d.paid_until ? `, paid until ${fmtDate(d.paid_until)}` : ''}`;
  }
  if (action === 'set_tier') return `Set to ${String(d.tier ?? '').toUpperCase()}`;
  if (action === 'hospitality_setup') {
    const count = d.units?.length ?? 0;
    return `Set up "${d.property}" with ${count} unit${count === 1 ? '' : 's'}`;
  }
  if (action === 'hospitality_site_token') {
    return d.result === 'cleared' ? 'Took their website offline'
      : d.result === 'rotated' ? 'Issued a new website key'
      : 'Minted their website key';
  }
  return action;
}

function fmtDate(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Record a payment taken by hand (a customer who paid AIBOS directly instead
 * of by card). It sets a real end date, so the customer is asked to set up
 * card payment before it ends and the plan ends if they do not. Plans are
 * priced in US dollars (lib/tiers.ts) and the amount is recorded with it.
 */
function ManualPayment({ userId, currentTier, onSaved }: { userId: string; currentTier: string; onSaved: () => void }) {
  const paid = TIER_ORDER.filter((t): t is Exclude<Tier, 'free'> => t !== 'free');
  const [plan, setPlan] = useState<Tier>(isTier(currentTier) && currentTier !== 'free' ? currentTier : 'pro');
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/admin/set-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId, tier: plan, source: 'payment', billing }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `Could not record the payment (${r.status})`);
      const until = j.profile?.paid_until as string | null | undefined;
      setMsg({ ok: true, text: j.note || `${TIERS[plan].name} is on${until ? ` until ${fmtDate(until)}` : ''}.` });
      onSaved();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const field: React.CSSProperties = { minHeight: 40, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-md)', background: 'var(--bg-input)', color: 'var(--text-1)', fontSize: 'var(--fs-body)' };
  return (
    <div className="section-card" style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>Record a manual payment</p>
      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: '0 0 14px', lineHeight: 1.55 }}>
        For money received by hand. The plan runs for the period paid. Paying again for the same plan before it ends adds the new period on the end.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
          Plan
          <select value={plan} onChange={(e) => setPlan(e.target.value as Tier)} style={field}>
            {paid.map((t) => <option key={t} value={t}>{TIERS[t].name}: ${TIERS[t].priceMonthly.toLocaleString()} a month</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
          Period
          <select value={billing} onChange={(e) => setBilling(e.target.value === 'annual' ? 'annual' : 'monthly')} style={field}>
            <option value="monthly">One month (${TIERS[plan].priceMonthly.toLocaleString()})</option>
            <option value="annual">One year (${TIERS[plan].priceAnnual.toLocaleString()})</option>
          </select>
        </label>
        <button type="button" onClick={() => void save()} disabled={busy}
          style={{ alignSelf: 'flex-end', minHeight: 40, padding: '9px 16px', borderRadius: 8, border: 'none', background: 'var(--cyan)', color: '#fff', fontWeight: 700, fontSize: 'var(--fs-body)', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Saving…' : 'Record payment'}
        </button>
      </div>
      {msg && (
        <p role={msg.ok ? 'status' : 'alert'} style={{ margin: '12px 0 0', fontSize: 'var(--fs-body)', color: msg.ok ? 'var(--good)' : 'var(--crit)' }}>{msg.text}</p>
      )}
    </div>
  );
}

/** The next date on the day of the month they joined. Mirrors set-tier. */
function nextOnJoinDay(joined: Date, billing: 'monthly' | 'annual'): Date {
  const day = joined.getUTCDate();
  let next = joined;
  while (next.getTime() <= Date.now()) {
    const year = billing === 'annual' ? next.getUTCFullYear() + 1 : next.getUTCFullYear() + Math.floor((next.getUTCMonth() + 1) / 12);
    const month = billing === 'annual' ? next.getUTCMonth() : (next.getUTCMonth() + 1) % 12;
    const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    next = new Date(Date.UTC(year, month, Math.min(day, last), next.getUTCHours(), next.getUTCMinutes(), next.getUTCSeconds()));
  }
  return next;
}

function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${s}`;
}

/**
 * Put an account on billing from the day they joined. Nothing is charged
 * here: the plan runs to that date, and the renewal run asks the customer (in
 * the app and by email) to set up card payment, which then renews
 * automatically on its own.
 */
function BillingFromJoin({ userId, currentTier, joinedAt, scheduledUntil, onSaved }: {
  userId: string; currentTier: string; joinedAt: string | null; scheduledUntil: string | null; onSaved: () => void;
}) {
  const paid = TIER_ORDER.filter((t): t is Exclude<Tier, 'free'> => t !== 'free');
  const [plan, setPlan] = useState<Tier>(isTier(currentTier) && currentTier !== 'free' ? currentTier : 'growth');
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const joined = joinedAt ? new Date(joinedAt) : null;
  if (!joined || Number.isNaN(joined.getTime())) return null;
  const next = nextOnJoinDay(joined, billing);
  const price = billing === 'annual' ? TIERS[plan].priceAnnual : TIERS[plan].priceMonthly;
  const every = billing === 'annual'
    ? `every year on ${joined.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}`
    : `on the ${ordinal(joined.getUTCDate())} of every month`;

  async function start() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/admin/set-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId, tier: plan, source: 'payment', billing, schedule: 'join_date' }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `Could not start billing (${r.status})`);
      const until = j.profile?.paid_until as string | null | undefined;
      setMsg({ ok: true, text: j.note || `Billing started. ${TIERS[plan].name} renews on ${fmtDate(until)}, then ${every}.` });
      onSaved();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const field: React.CSSProperties = { minHeight: 40, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-md)', background: 'var(--bg-input)', color: 'var(--text-1)', fontSize: 'var(--fs-body)' };
  return (
    <div className="section-card" style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>Bill from the day they joined</p>
      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: '0 0 14px', lineHeight: 1.55 }}>
        They joined on {fmtDate(joinedAt)}. The plan runs until {fmtDate(next.toISOString())}. AIBOS asks them to set up card payment
        three days before, on the day and before it switches off; the card then renews {every} for ${price.toLocaleString()}. Nothing is charged now.
        {scheduledUntil ? ` Right now it renews on ${fmtDate(scheduledUntil)}.` : ''}
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
          Plan
          <select value={plan} onChange={(e) => setPlan(e.target.value as Tier)} style={field}>
            {paid.map((t) => <option key={t} value={t}>{TIERS[t].name}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
          Every
          <select value={billing} onChange={(e) => setBilling(e.target.value === 'annual' ? 'annual' : 'monthly')} style={field}>
            <option value="monthly">Month (${TIERS[plan].priceMonthly.toLocaleString()})</option>
            <option value="annual">Year (${TIERS[plan].priceAnnual.toLocaleString()})</option>
          </select>
        </label>
        <button type="button" onClick={() => void start()} disabled={busy}
          style={{ alignSelf: 'flex-end', minHeight: 40, padding: '9px 16px', borderRadius: 8, border: 'none', background: 'var(--cyan)', color: '#fff', fontWeight: 700, fontSize: 'var(--fs-body)', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Saving…' : 'Start billing'}
        </button>
      </div>
      {msg && (
        <p role={msg.ok ? 'status' : 'alert'} style={{ margin: '12px 0 0', fontSize: 'var(--fs-body)', color: msg.ok ? 'var(--good)' : 'var(--crit)' }}>{msg.text}</p>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: '0 0 4px' }}>{label}</p>
      <p style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-1)', margin: 0, wordBreak: 'break-word' }}>{value || '—'}</p>
    </div>
  );
}

export default function AdminAccountDetailPage() {
  const params = useParams<{ userId: string }>();
  const userId = params?.userId;

  const [data, setData] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // quiet: refresh in place, so a card that just saved keeps its message
  // instead of being swapped for the loading skeleton.
  const load = useCallback(async (quiet = false) => {
    if (!userId) return;
    if (!quiet) setLoading(true);
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
    <Link href="/admin" style={{ display: 'inline-block', marginBottom: 14, fontSize: 'var(--fs-label)', color: 'var(--text-3)', textDecoration: 'none' }}>
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
          <p style={{ color: 'var(--crit)', margin: '0 0 12px' }}>{error || 'Account not found.'}</p>
          <button type="button" onClick={() => void load()} style={{ minHeight: 40, padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border-md)', background: 'var(--bg-card)', color: 'var(--text-2)', fontWeight: 600, cursor: 'pointer' }}>Try again</button>
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
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-1)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
          {p.business_name || '—'}
        </h1>
        <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: 0 }}>{p.email}</p>
      </header>

      <div className="section-card" style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px' }}>Profile</p>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          {/* Display name from the ladder — hand-writing the Pro+ special case
              here is how a new tier ends up shown as a raw id. */}
          <Fact label="Plan" value={<span style={{ textTransform: 'uppercase' }}>{isTier(tier) ? TIERS[tier].name : tier}</span>} />
          <Fact label="Tier source" value={p.tier_source} />
          <Fact label="Paid until" value={p.tier_source === 'payment' ? fmtDate(p.paid_until) : null} />
          <Fact label="Referred by" value={p.referred_by} />
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

      {userId && (
        <BillingFromJoin
          userId={userId}
          currentTier={tier}
          joinedAt={p.created_at}
          scheduledUntil={p.tier_source === 'payment' ? p.paid_until : null}
          onSaved={() => void load(true)}
        />
      )}

      {userId && <ManualPayment userId={userId} currentTier={tier} onSaved={() => void load(true)} />}

      {/* Set the customer's booking website up without holding their login. */}
      {userId && <HospitalitySetup userId={userId} />}

      <div className="section-card" style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px' }}>Admin actions</p>
        {data.audit.length === 0 ? (
          <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: 0 }}>Nothing an admin has done to this account.</p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {data.audit.map((a) => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 'var(--fs-data)', color: 'var(--text-2)' }}>
                  {describeAudit(a.action, a.detail)}
                  <span style={{ color: 'var(--text-4)' }}> · by {a.admin_email}</span>
                </span>
                <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', flexShrink: 0 }}>{fmtDateTime(a.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section-card">
        <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px' }}>Recent activity</p>
        {data.events.length === 0 ? (
          <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: 0 }}>No usage events yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {data.events.map((ev) => (
              <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 'var(--fs-data)', color: 'var(--text-2)' }}>
                  {ev.event}
                  {ev.engine && <span style={{ color: 'var(--text-4)' }}> · {ev.engine}</span>}
                </span>
                <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', flexShrink: 0 }}>{fmtDateTime(ev.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
