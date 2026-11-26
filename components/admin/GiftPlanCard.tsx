'use client';

/**
 * Admin · Gift a plan (26 Nov 2026).
 *
 * A paid plan free for a set number of months (aibos-api gifts.py). It ends on
 * its own, nobody is asked to pay for it and the owner is welcomed by name the
 * next time they open AIBOS. A gift still running gets the months on its end.
 *
 * Built for referrals: when an owner brings another business, both get the
 * month (client plan, 26 Nov 2026). "Referred by" runs the same gift for the
 * owner who brought this one, with "Referral: brought <business>" in their
 * history. It starts on the account whose referral code this one signed up
 * with (profiles.referred_by, the first 8 characters of their id).
 *
 * Two steps, like Tell everyone: "Check the gift" lists each account, what it
 * gets and the day it ends, and only then can it be given. Any change after
 * the check takes the button away until it is checked again, so what is given
 * is always what was read. Left out, with the reason: an account that pays for
 * its plan (the API refuses it too), and a referrer whose plan has no end date
 * (a gift would give it one; their own page can still do that on purpose).
 *
 * Admin only: the page sits behind the admin guard (middleware.ts and the
 * admin layout), the account list behind requireAdmin, and the API checks the
 * caller itself (membership.is_admin). Built from the calendar's set
 * (components/hospitality/kit.tsx), like the other admin cards.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Gift, ListChecks, UserPlus, X } from 'lucide-react';
import { giftPlan, type PlanGiftResult } from '@/lib/api';
import type { AccountOverview } from '@/lib/admin';
import { TIERS, TIER_ORDER, isTier, type Tier } from '@/lib/tiers';
import { Chip, Note, Section, Segmented } from '@/components/hospitality/kit';

type Profile = Record<string, unknown>;
type PaidTier = Exclude<Tier, 'free'>;

const PAID: PaidTier[] = TIER_ORDER.filter((t): t is PaidTier => t !== 'free');
/** gifts.MAX_MONTHS and gifts.NOTE_MAX. */
const MAX_MONTHS = 12;
const NOTE_MAX = 200;

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const planName = (t: string): string => (isTier(t) ? TIERS[t].name : t);
const accountLabel = (a: { business_name?: unknown; email?: unknown } | null | undefined): string =>
  text(a?.business_name) || text(a?.email) || 'Unnamed account';
const span = (months: number, more: boolean): string =>
  more ? (months === 1 ? 'one more month' : `${months} more months`) : (months === 1 ? 'one month' : `${months} months`);

/** A gift's last day as the bell and the welcome say it (gifts.py writes it in Lusaka). */
function longDay(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lusaka' });
}

/** `months` calendar months on from `start`, on its day of the month; a month
 *  without that day ends on its last day. Keep in step with gifts.gift_end. */
function giftEnd(start: Date, months: number): Date {
  const day = start.getUTCDate();
  let end = start;
  for (let i = 0; i < months; i += 1) {
    const next = end.getUTCMonth() + 1;
    const year = end.getUTCFullYear() + Math.floor(next / 12);
    const month = next % 12;
    const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    end = new Date(Date.UTC(year, month, Math.min(day, last), start.getUTCHours(), start.getUTCMinutes(), start.getUTCSeconds()));
  }
  return end;
}

type Standing =
  | { kind: 'open' }
  | { kind: 'pays'; tier: PaidTier; until: Date | null }
  | { kind: 'gift'; tier: PaidTier; until: Date }
  | { kind: 'endless'; tier: PaidTier };

/** Where an account's plan stands, by the rules gifts.grant applies. */
function standing(p: Profile | null | undefined, now: number): Standing {
  const tier = text(p?.tier);
  if (!p || !isTier(tier) || tier === 'free') return { kind: 'open' };
  const source = text(p.tier_source);
  const raw = text(p.paid_until);
  const parsed = raw ? new Date(raw) : null;
  const until = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
  if (source === 'payment') return until && until.getTime() <= now ? { kind: 'open' } : { kind: 'pays', tier, until };
  if (source === 'gift') return until && until.getTime() > now ? { kind: 'gift', tier, until } : { kind: 'open' };
  // A demo grant, or a plan set by hand: on with no end date.
  return until ? { kind: 'open' } : { kind: 'endless', tier };
}

/** One gift as the check reads it out. */
interface Planned {
  userId: string;
  label: string;
  referrer: boolean;
  /** Who the welcome greets, and the business it names. */
  name: string;
  business: string;
  note: string;
  until: Date;
  /** On the end of a gift still running. */
  more: boolean;
  /** Why nothing goes to this account. */
  leftOut: string | null;
  /** What giving it changes that the admin should know. */
  warn: string | null;
}

interface Outcome { planned: Planned; result?: PlanGiftResult; error?: string }

export default function GiftPlanCard({ userId, profile, onGiven }: {
  userId: string;
  profile: Profile;
  onGiven: () => void;
}) {
  const label = accountLabel(profile);

  const [plan, setPlan] = useState<PaidTier>('growth');
  const [months, setMonths] = useState('1');
  const [name, setName] = useState(() => text(profile.full_name));
  const [business, setBusiness] = useState(() => text(profile.business_name));
  const [note, setNote] = useState('');

  // Referred by: every account, read once, only when it is needed.
  const [accounts, setAccounts] = useState<AccountOverview[] | null>(null);
  const [accountsError, setAccountsError] = useState('');
  const [query, setQuery] = useState('');
  const [referrer, setReferrer] = useState<AccountOverview | null>(null);
  const [byCode, setByCode] = useState(false);
  const [refProfile, setRefProfile] = useState<Profile | null>(null);
  const [refName, setRefName] = useState('');
  const [refError, setRefError] = useState('');

  const [checked, setChecked] = useState<Planned[] | null>(null);
  const [giving, setGiving] = useState(false);
  const [done, setDone] = useState<Outcome[] | null>(null);

  const code = text(profile.referred_by).toLowerCase();
  const wantAccounts = query.trim().length >= 2 || (code.length > 0 && !referrer);

  useEffect(() => {
    if (!wantAccounts || accounts !== null || accountsError) return;
    let live = true;
    (async () => {
      try {
        const r = await fetch('/api/admin/accounts');
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `Could not read the accounts (${r.status})`);
        if (live) setAccounts((j.accounts ?? []) as AccountOverview[]);
      } catch (e) {
        if (live) setAccountsError((e as Error).message);
      }
    })();
    return () => { live = false; };
  }, [wantAccounts, accounts, accountsError]);

  // The referrer being read, so an answer for one picked before it never
  // lands on the one picked after.
  const picked = useRef('');
  const readReferrer = useCallback(async (id: string): Promise<Profile | null> => {
    setRefError('');
    try {
      const r = await fetch(`/api/admin/accounts/${encodeURIComponent(id)}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.profile) throw new Error(j.error || `Could not read their account (${r.status})`);
      if (picked.current !== id) return null;
      setRefProfile(j.profile as Profile);
      return j.profile as Profile;
    } catch (e) {
      if (picked.current === id) setRefError((e as Error).message);
      return null;
    }
  }, []);

  const choose = useCallback(async (acc: AccountOverview, fromCode = false) => {
    picked.current = acc.id;
    setReferrer(acc);
    setByCode(fromCode);
    setQuery('');
    setRefProfile(null);
    setRefName('');
    setChecked(null);
    const p = await readReferrer(acc.id);
    if (p) setRefName(text(p.full_name));
  }, [readReferrer]);

  const forget = () => {
    picked.current = '';
    setReferrer(null);
    setRefProfile(null);
    setRefName('');
    setRefError('');
    setChecked(null);
  };

  // The account whose referral code this one signed up with comes in chosen.
  const [codeTried, setCodeTried] = useState(false);
  const [codeMiss, setCodeMiss] = useState(false);
  useEffect(() => {
    if (codeTried || !code || !accounts) return;
    setCodeTried(true);
    const hit = accounts.find((a) => a.id !== userId && a.id.toLowerCase().startsWith(code));
    if (hit) void choose(hit, true);
    else setCodeMiss(true);
  }, [codeTried, code, accounts, userId, choose]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2 || !accounts) return [];
    return accounts.filter((a) => a.id !== userId && (
      (a.business_name ?? '').toLowerCase().includes(q)
      || (a.email ?? '').toLowerCase().includes(q)
      || a.id.toLowerCase().startsWith(q)
    )).slice(0, 6);
  }, [accounts, query, userId]);

  const now = Date.now();
  const own = standing(profile, now);
  const theirs = referrer ? standing(refProfile, now) : null;
  const ownGetsOne = own.kind !== 'pays';
  const referrerGetsOne = referrer !== null && refProfile !== null && theirs !== null
    && theirs.kind !== 'pays' && theirs.kind !== 'endless';
  const monthCount = Number(months);
  const monthsOk = Number.isInteger(monthCount) && monthCount >= 1 && monthCount <= MAX_MONTHS;
  // A name is needed only for a welcome that will be shown.
  const ready = monthsOk && (!ownGetsOne || name.trim().length > 0)
    && (!referrer || (refProfile !== null && (!referrerGetsOne || refName.trim().length > 0)));

  /** Any change after a check takes "Give it" away until it is checked again. */
  const edit = <T,>(set: (v: T) => void) => (v: T) => { set(v); setChecked(null); };

  function check() {
    const at = Date.now();
    const list: Planned[] = [];
    const mine = standing(profile, at);
    const start = mine.kind === 'gift' ? mine.until : new Date(at);
    const refLabel = referrer ? accountLabel(refProfile ?? referrer) : '';
    list.push({
      userId, label, referrer: false, name: name.trim(), business: business.trim(),
      note: note.trim() || (referrer ? `Referral: referred by ${refLabel}` : ''),
      until: giftEnd(start, monthCount), more: mine.kind === 'gift',
      leftOut: mine.kind === 'pays'
        ? `pays for ${planName(mine.tier)}${mine.until ? ` until ${longDay(mine.until)}` : ''}. A gift would replace what it paid for, so none goes to it.`
        : null,
      warn: mine.kind === 'endless'
        ? `${label} has ${planName(mine.tier)} with no end date now. This gift gives it one: after ${longDay(giftEnd(start, monthCount))} it is on Free unless it pays.`
        : null,
    });
    if (referrer && refProfile) {
      const s = standing(refProfile, at);
      const from = s.kind === 'gift' ? s.until : new Date(at);
      list.push({
        userId: referrer.id, label: refLabel, referrer: true, name: refName.trim(),
        business: text(refProfile.business_name) || text(referrer.business_name),
        note: `Referral: brought ${label}`,
        until: giftEnd(from, monthCount), more: s.kind === 'gift',
        leftOut: s.kind === 'pays'
          ? `pays for ${planName(s.tier)}${s.until ? ` until ${longDay(s.until)}` : ''}. A gift would replace what it paid for, so none goes to it.`
          : s.kind === 'endless'
            ? `has ${planName(s.tier)} with no end date, so it keeps that and no gift goes to it. To change it to a gift that ends, give it on their own page.`
            : null,
        warn: null,
      });
    }
    setChecked(list);
    setDone(null);
  }

  async function give() {
    if (!checked) return;
    setGiving(true);
    const outcomes: Outcome[] = [];
    for (const g of checked) {
      if (g.leftOut) continue;
      try {
        const result = await giftPlan({
          target_user_id: g.userId, plan, months: monthCount, name: g.name, business: g.business, note: g.note,
        });
        outcomes.push({ planned: g, result });
      } catch (e) {
        outcomes.push({ planned: g, error: (e as Error).message });
      }
    }
    setDone(outcomes);
    setChecked(null);
    setGiving(false);
    if (outcomes.some((o) => o.result)) {
      onGiven();
      // Their plan changed too: a second check must read it as it is now.
      if (referrer) void readReferrer(referrer.id);
    }
  }

  const going = checked?.filter((g) => !g.leftOut) ?? [];
  const refStandingNote = referrer && refProfile && theirs && !referrerGetsOne
    ? (theirs.kind === 'pays'
      ? `${accountLabel(refProfile)} pays for its plan, so no gift goes to it.`
      : `${accountLabel(refProfile)} has its plan with no end date, so no gift goes to it.`)
    : '';

  return (
    <section className="section-card" style={{ marginBottom: 16 }} aria-labelledby="gift-plan-title">
      <div className="rs-sec-head" style={{ marginBottom: 6 }}>
        <h2 id="gift-plan-title" className="rs-sec-title">Gift a plan</h2>
        <Chip><Gift aria-hidden="true" /> Ends on its own</Chip>
      </div>
      <p className="rs-text is-quiet">
        Free for a set number of months. It ends on its own, nobody is asked to pay for it and the owner is
        welcomed by name the next time they open AIBOS.
      </p>
      {own.kind === 'gift' && (
        <Note tone="info">
          {planName(own.tier)} is a gift here until {longDay(own.until)}. A new gift adds its months on the end.
        </Note>
      )}
      {own.kind === 'pays' && (
        <Note tone="info">
          This account pays for {planName(own.tier)}{own.until ? ` until ${longDay(own.until)}` : ''}, so it cannot take a
          gift. The owner who referred it still can.
        </Note>
      )}
      {own.kind === 'endless' && (
        <Note tone="warn">This account has {planName(own.tier)} with no end date. A gift would give it one.</Note>
      )}

      <div style={{ display: 'grid', gap: 16, marginTop: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <span className="field-label">Plan</span>
            <Segmented label="Plan" value={plan} disabled={giving}
              options={PAID.map((t) => ({ value: t, label: TIERS[t].name }))}
              onChange={edit(setPlan)} />
          </div>
          <div style={{ width: 150 }}>
            <label className="field-label" htmlFor="gift-months">Months (1 to {MAX_MONTHS})</label>
            <input id="gift-months" className="field" type="number" inputMode="numeric" min={1} max={MAX_MONTHS} step={1}
              value={months} onChange={(e) => edit(setMonths)(e.target.value)} disabled={giving}
              aria-invalid={!monthsOk} />
          </div>
        </div>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))' }}>
          <div>
            <label className="field-label" htmlFor="gift-name">Who the welcome greets</label>
            <input id="gift-name" className="field" value={name} placeholder="Mr Ryan Banda" disabled={giving}
              onChange={(e) => edit(setName)(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="gift-business">Business on the welcome</label>
            <input id="gift-business" className="field" value={business} placeholder="Cookies & Coffee" disabled={giving}
              onChange={(e) => edit(setBusiness)(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="field-label" htmlFor="gift-note">Note for the history (optional)</label>
          <input id="gift-note" className="field" value={note} maxLength={NOTE_MAX} disabled={giving}
            placeholder="Referral: brought Cookies & Coffee" onChange={(e) => edit(setNote)(e.target.value)} />
          <p className="rs-text is-quiet" style={{ marginTop: 6, fontSize: 'var(--fs-label)' }}>
            Kept in the admin actions below. The owner never sees it.
          </p>
        </div>
      </div>

      <Section title="Referred by" action={<Chip><UserPlus aria-hidden="true" /> Gets the same gift</Chip>}>
        <p className="rs-text is-quiet">
          The owner who brought this business gets the same plan for the same time, with
          &quot;Referral: brought {label}&quot; in their history.
        </p>
        {referrer ? (
          <div style={{ display: 'grid', gap: 14, marginTop: 14 }}>
            <div className="rs-row">
              <div className="rs-row-main">
                <span className="rs-row-title">{accountLabel(referrer)}</span>
                <span className="rs-row-line">
                  {referrer.email ?? 'No email'} · {planName(referrer.tier)}
                  {byCode ? ' · signed this account up with their referral code' : ''}
                </span>
              </div>
              <button type="button" className="rs-btn is-quiet is-sm" disabled={giving} onClick={forget}>
                <X aria-hidden="true" /> Not them
              </button>
            </div>
            {refError && <Note tone="bad">{refError}</Note>}
            {!refProfile && !refError && <p className="rs-text is-quiet">Reading their account…</p>}
            {refStandingNote && <Note tone="info">{refStandingNote}</Note>}
            {referrerGetsOne && (
              <div>
                <label className="field-label" htmlFor="gift-referrer-name">Who their welcome greets</label>
                <input id="gift-referrer-name" className="field" value={refName} placeholder="Ms Mwila Banda" disabled={giving}
                  onChange={(e) => edit(setRefName)(e.target.value)} />
              </div>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 14 }}>
            <label className="field-label" htmlFor="gift-referrer">Find the owner who brought them</label>
            <input id="gift-referrer" className="field" value={query} autoComplete="off" disabled={giving}
              placeholder="Business, email or referral code" onChange={(e) => setQuery(e.target.value)} />
            {codeMiss && (
              <p className="rs-text is-quiet" style={{ marginTop: 6, fontSize: 'var(--fs-label)' }}>
                Signed up with referral code {code}, which matches no other account.
              </p>
            )}
            {accountsError && <Note tone="bad">{accountsError}</Note>}
            {matches.length > 0 && (
              <ul className="rs-list" aria-label="Matching accounts" style={{ listStyle: 'none', margin: '10px 0 0', padding: 0 }}>
                {matches.map((a) => (
                  <li key={a.id}>
                    <button type="button" className="rs-row" onClick={() => void choose(a)}
                      style={{ width: '100%', textAlign: 'left', font: 'inherit', cursor: 'pointer' }}>
                      <span className="rs-row-main">
                        <span className="rs-row-title">{accountLabel(a)}</span>
                        <span className="rs-row-line">{a.email ?? 'No email'} · {planName(a.tier)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {query.trim().length >= 2 && accounts && matches.length === 0 && (
              <p className="rs-text is-quiet" style={{ marginTop: 10 }}>No other account matches.</p>
            )}
          </div>
        )}
      </Section>

      <div className="rs-btns" style={{ marginTop: 24 }}>
        <button type="button" className="rs-btn is-quiet" onClick={check} disabled={!ready || giving}>
          <ListChecks aria-hidden="true" /> Check the gift
        </button>
        <button type="button" className="rs-btn is-navy" onClick={() => void give()} disabled={going.length === 0 || giving}>
          <Gift aria-hidden="true" /> {giving ? 'Giving…' : going.length > 1 ? 'Give both' : 'Give it'}
        </button>
      </div>

      {checked && (
        <div role="status" style={{ marginTop: 20 }}>
          <span className="rs-quote-label">{going.length > 0 ? 'What will be given' : 'Nothing will be given'}</span>
          {going.length > 0 && (
            <ul className="rs-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {going.map((g) => (
                <li key={g.userId} className="rs-row">
                  <div className="rs-row-main">
                    <span className="rs-row-title">{g.label}</span>
                    <span className="rs-row-line">
                      {planName(plan)} free for {span(monthCount, g.more)}, until {longDay(g.until)}
                      {g.more ? ', on the end of the gift it has' : ''}. The welcome greets {g.name}.
                    </span>
                    {g.note && <span className="rs-row-line">Note: {g.note}</span>}
                  </div>
                  <Chip>{g.referrer ? 'Brought them' : 'This account'}</Chip>
                </li>
              ))}
            </ul>
          )}
          {checked.filter((g) => g.leftOut).map((g) => (
            <Note key={`out-${g.userId}`} tone="warn">{g.label} {g.leftOut}</Note>
          ))}
          {checked.filter((g) => g.warn && !g.leftOut).map((g) => (
            <Note key={`warn-${g.userId}`} tone="warn">{g.warn}</Note>
          ))}
        </div>
      )}

      {done && (
        <div role="status" style={{ marginTop: 20 }}>
          {done.map((o) => (o.result ? (
            <Note key={`done-${o.planned.userId}`} tone="good">
              Given. {o.planned.label} has {planName(o.result.plan)} free until {longDay(o.result.until)}
              {o.result.extended_from ? `, ${span(o.result.months, true)} on the end of the gift that was to end on ${longDay(o.result.extended_from)}` : ''}.
              The welcome waits for {o.planned.name} the next time they open AIBOS.
            </Note>
          ) : (
            <Note key={`done-${o.planned.userId}`} tone="bad">{o.planned.label}: {o.error}</Note>
          )))}
        </div>
      )}
    </section>
  );
}
