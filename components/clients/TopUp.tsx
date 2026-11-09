'use client';
/**
 * Find clients top-ups (9 Nov 2026): businesses bought once by card on any
 * plan, the way Explee sells its work. They never run out and are used after
 * the free day and the month's. The API makes the Paddle transaction for the
 * business's account (POST /payments/paddle/topup) and Paddle's webhook adds
 * the credits, so after paying this looks again until they arrive. Owner
 * only: the route refuses staff, and the pages tell staff to ask the owner.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Note, Segmented } from '@/components/hospitality/kit';
import { startTopupCheckout, type ClientsTopup } from '@/lib/api';
import { closeCardCheckout, mountInlineCheckout, type PaddleEvent } from '@/lib/paddle';
import { FIND_CLIENTS_TOPUPS } from '@/lib/tiers';
import { plural, said } from './shared';

const FRAME_CLASS = 'aibos-topup-frame';
/** A card form that never arrives must not leave the placeholder up forever. */
const LOAD_FOR_MS = 45_000;
/** After paying: look for the credits every few seconds, for two minutes. */
const CONFIRM_POLL_MS = 3_000;
const CONFIRM_FOR_MS = 120_000;

type State = 'choosing' | 'opening' | 'open' | 'failed' | 'confirming' | 'slow' | 'done';

/** The packs the server sells, or the ones this build knows. */
export function packsOf(given?: ClientsTopup[] | null): ClientsTopup[] {
  if (given?.length) return given;
  return Object.entries(FIND_CLIENTS_TOPUPS).map(([credits, usd]) => ({ credits: Number(credits), usd }));
}

/** "100 businesses for $5, 300 for $12 or 1,000 for $35" */
export function topupWords(given?: ClientsTopup[] | null): string {
  const parts = packsOf(given).map((p, i) =>
    `${i === 0 ? plural(p.credits, 'business', 'businesses') : p.credits.toLocaleString('en-GB')} for $${p.usd}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} or ${parts[parts.length - 1]}` : parts[0] ?? '';
}

export default function TopUp({ packs, bought, reload, onCancel }: {
  packs?: ClientsTopup[] | null;
  /** Credits bought so far: when it grows, the payment has landed. */
  bought: number;
  reload: () => Promise<void>;
  onCancel?: () => void;
}) {
  const list = packsOf(packs);
  const [pick, setPick] = useState<string>(String((list[1] ?? list[0])?.credits ?? 100));
  const [paying, setPaying] = useState<ClientsTopup | null>(null);
  const [state, setState] = useState<State>('choosing');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const boughtAt = useRef(bought);

  const after = state === 'confirming' || state === 'slow' || state === 'done';
  // The card form is wanted from the press until the money has gone; then it
  // closes and the page waits for the credits. It never offers to pay again.
  const frameWanted = paying !== null && !after;
  const credits = paying?.credits ?? null;

  const onPaddle = useCallback((e: PaddleEvent) => {
    if (e.name === 'checkout.loaded') {
      setState((s) => (s === 'opening' || s === 'failed' ? 'open' : s));
      setError('');
    } else if (e.name === 'checkout.completed') {
      setState('confirming');
    } else if (e.name === 'checkout.error') {
      setError('The card form ran into a problem. No money was taken. Please try again.');
      setState('failed');
    }
  }, []);

  useEffect(() => {
    if (!frameWanted || credits === null) return;
    let alive = true;
    setError('');
    setState('opening');
    void (async () => {
      try {
        const t = await startTopupCheckout(credits);
        if (!alive) return;
        await mountInlineCheckout({
          transactionId: t.transaction_id,
          token: t.client_token,
          environment: t.environment,
          frameClass: FRAME_CLASS,
          onEvent: onPaddle,
          alive: () => alive,
        });
      } catch (e) {
        if (!alive) return;
        setError(said(e, 'The card form could not load. Please try again in a minute. No money was taken.'));
        setState('failed');
      }
    })();
    return () => {
      alive = false;
      closeCardCheckout();
    };
  }, [frameWanted, credits, attempt, onPaddle]);

  useEffect(() => {
    if (state !== 'opening') return;
    const t = setTimeout(() => {
      setError('The card form is taking too long to load. Check your connection and try again. No money was taken.');
      setState('failed');
    }, LOAD_FOR_MS);
    return () => clearTimeout(t);
  }, [state, attempt]);

  // Paid: Paddle tells the API, which adds the credits. Look until they show.
  useEffect(() => {
    if (state !== 'confirming') return;
    const began = Date.now();
    let alive = true;
    let t: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try { await reload(); } catch { /* look again */ }
      if (!alive) return;
      if (Date.now() - began > CONFIRM_FOR_MS) {
        setState('slow');
        return;
      }
      t = setTimeout(() => { void tick(); }, CONFIRM_POLL_MS);
    };
    t = setTimeout(() => { void tick(); }, CONFIRM_POLL_MS);
    return () => { alive = false; if (t) clearTimeout(t); };
  }, [state, reload]);

  useEffect(() => {
    if ((state === 'confirming' || state === 'slow') && bought > boughtAt.current) setState('done');
  }, [bought, state]);

  const chosen = list.find((p) => String(p.credits) === pick) ?? list[0];

  if (state === 'done' && paying) {
    return (
      <Note tone="good">
        {plural(paying.credits, 'business', 'businesses')} added. They never run out: research them whenever you like.
      </Note>
    );
  }

  if (!paying) {
    return (
      <div style={{ display: 'grid', gap: 12, justifyItems: 'start' }}>
        <Segmented<string> label="How many businesses" value={pick} onChange={setPick}
          options={list.map((p) => ({ value: String(p.credits), label: `${p.credits.toLocaleString('en-GB')} for $${p.usd}` }))} />
        <p className="rs-text is-quiet">
          Paid once by card, in US dollars. They never run out and are used after your free or monthly ones.
        </p>
        <div className="rs-btns">
          <button type="button" className="rs-btn is-navy" disabled={!chosen}
            onClick={() => { if (chosen) { boughtAt.current = bought; setPaying(chosen); } }}>
            {chosen ? `Pay $${chosen.usd} by card` : 'Pay by card'}
          </button>
          {onCancel && <button type="button" className="rs-btn is-quiet" onClick={onCancel}>Not now</button>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <p className="rs-text is-strong">
        {plural(paying.credits, 'business', 'businesses')} for ${paying.usd}, paid once by card.
      </p>
      {!after && (
        <div style={{ position: 'relative', minHeight: state === 'opening' ? 450 : undefined }}>
          {state === 'opening' && (
            <div className="skeleton" aria-label="Opening the card form"
              style={{ position: 'absolute', inset: 0, borderRadius: 'var(--radius-md)' }} />
          )}
          <div className={FRAME_CLASS} style={{ width: '100%', display: state === 'failed' ? 'none' : undefined }} />
        </div>
      )}
      {state === 'failed' && error && <Note tone="bad">{error}</Note>}
      {state === 'confirming' && (
        <Note tone="info">Paid. AIBOS is adding the businesses to your account; this takes a few seconds.</Note>
      )}
      {state === 'slow' && (
        <Note tone="info">
          Paddle has taken the payment and the businesses are on their way. They show here within a few minutes and
          you will get a notification when they do.
        </Note>
      )}
      {!after && (
        <div className="rs-btns">
          {state === 'failed' && (
            <button type="button" className="rs-btn is-navy" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
          )}
          <button type="button" className="rs-btn is-quiet"
            onClick={() => { setPaying(null); setState('choosing'); setError(''); }}>
            Choose another
          </button>
        </div>
      )}
    </div>
  );
}
