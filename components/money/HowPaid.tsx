'use client';
/**
 * The entries behind one "Where it is" figure: Cash, Mobile money, Bank and
 * card, or Not said how (GET /books/how-paid). Newest first, each with what it
 * adds to that figure, and they add up to the figure exactly: the same
 * entries and the same rule as the money figure itself.
 *
 * An entry that does not say how its money moved is put right here with one
 * tap (POST /books/how-paid/{id}, the owner's), and every figure on every page
 * follows (lib/booksSignal.ts). "Not said how" used to be a row that opened the
 * page it was already on, with nothing behind it to see or fix.
 *
 * Opened by ?how= on the Money page (the "Where it is" rows link here).
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowUpRight, X } from 'lucide-react';
import { SectionCard, BigMoney } from '@/components/kit';
import { getHowPaid, sayHowPaid, type HowPaid, type HowPaidEntry, type HowPaidList, type SayHow } from '@/lib/api';
import { whoOf, kindOf, fmtDate } from '@/components/spine/eventMeta';
import { useStore } from '@/lib/store';
import { useProfile } from '@/lib/profile';
import { fmt } from '@/lib/utils';

const PLACES: { how: HowPaid; label: string }[] = [
  { how: 'cash', label: 'Cash' },
  { how: 'mobile_money', label: 'Mobile money' },
  { how: 'bank', label: 'Bank and card' },
  { how: 'unsaid', label: 'Not said how' },
];

const SAY: { how: SayHow; label: string }[] = [
  { how: 'cash', label: 'Cash' },
  { how: 'mobile_money', label: 'Mobile money' },
  { how: 'bank', label: 'Bank' },
  { how: 'card', label: 'Card' },
];
/** Money moves between these three; a card is not a place money sits. */
const PLACES_TO_MOVE = SAY.filter((s) => s.how !== 'card');

const FIRST = 50;

const isPlace = (v: string | null | undefined): v is HowPaid => PLACES.some((p) => p.how === v);

export default function HowPaidPanel() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const asked = params?.get('how');
  const how = isPlace(asked) ? asked : null;
  const sym = useStore((s) => s.currencySymbol) || 'K';
  const version = useStore((s) => s.booksVersion);
  const { teamRole } = useProfile();
  const canFix = teamRole === 'owner';

  const [list, setList] = useState<HowPaidList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [sides, setSides] = useState<Record<string, { from?: SayHow; to?: SayHow }>>({});
  const fromChip = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!how) return;
    let alive = true;
    setError(null);
    getHowPaid(how)
      .then((l) => { if (alive) setList(l); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Could not open these entries just now.'); });
    return () => { alive = false; };
  }, [how, version]);

  // Opened from "Where it is": bring the list into view. Not when the owner
  // only switched places with the chips inside it.
  useEffect(() => {
    if (!how) return;
    if (fromChip.current) { fromChip.current = false; return; }
    setAll(false); setSaid(null);
    cardRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [how]);

  if (!how) return null;

  const go = (next: HowPaid | null) => {
    const q = new URLSearchParams(params?.toString() ?? '');
    if (next) q.set('how', next); else q.delete('how');
    const qs = q.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  const place = PLACES.find((p) => p.how === how)!;
  const current = list && list.how === how ? list : null;
  const rows = current ? (all ? current.entries : current.entries.slice(0, FIRST)) : [];

  async function say(entry: HowPaidEntry, body: { how: SayHow } | { from: SayHow; to: SayHow }) {
    const id = entry.event.id;
    setBusy(id); setError(null); setSaid(null);
    try {
      const out = await sayHowPaid(id, body);
      // Out of "Not said how" at once; the books are counted again everywhere
      // (lib/booksSignal.ts) and this list is read again with them.
      setList((l) => l && l.how === 'unsaid'
        ? { ...l, entries: l.entries.filter((r) => r.event.id !== id), count: l.count - 1, figure: out.split.unsaid,
            total: Math.round((l.total - entry.amount) * 100) / 100 }
        : l);
      const label = 'how' in body ? SAY.find((s) => s.how === body.how)?.label : null;
      setSaid(label
        ? `${whoOf(entry.event)}: saved as ${label.toLowerCase()}.`
        : `${whoOf(entry.event)}: saved as moved from ${place.label.toLowerCase()}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that. Try again in a moment.');
    } finally {
      setBusy(null);
    }
  }

  const words = (n: number) => `${n} ${n === 1 ? 'entry' : 'entries'}`;
  const subtitle = !current ? 'Opening the entries behind this figure.'
    : how === 'unsaid'
      ? current.count === 0
        ? 'Every entry says how its money moved.'
        : `${words(current.count)} do not say how the money moved. Say how for each and it moves to the cash, the wallet or the bank.`
      : current.count === 0
        ? 'Nothing recorded here yet.'
        : `${words(current.count)}, newest first. Money in adds to this figure and money out takes from it.`;

  return (
    <div id="how-paid" ref={cardRef} style={{ scrollMarginTop: 80 }}>
      <SectionCard
        title={current ? `${place.label}: ${fmt(current.figure, false, sym)}` : place.label}
        subtitle={subtitle}
        style={{ marginBottom: 20 }}
        action={
          <button type="button" className="icon-pill" aria-label="Close this list" onClick={() => go(null)}>
            <X aria-hidden="true" />
          </button>
        }
      >
        <div className="chips" role="group" aria-label="Which place" style={{ marginBottom: 12 }}>
          {PLACES.map((p) => (
            <button key={p.how} type="button" className="chip" aria-pressed={p.how === how}
              onClick={() => { if (p.how !== how) { fromChip.current = true; setAll(false); setSaid(null); go(p.how); } }}>
              {p.label}
            </button>
          ))}
        </div>

        {error && <p role="alert" style={{ margin: '0 0 12px', fontSize: 'var(--fs-body)', color: 'var(--red)' }}>{error}</p>}
        {said && <p role="status" style={{ margin: '0 0 12px', fontSize: 'var(--fs-body)', color: 'var(--green)' }}>{said}</p>}
        {!current && !error && <div className="skeleton" style={{ height: 120 }} />}

        {how === 'unsaid' && current && current.count > 0 && !canFix && (
          <p style={{ margin: '0 0 12px', fontSize: 'var(--fs-body)', color: 'var(--text-3)' }}>
            The owner can say how each of these was paid.
          </p>
        )}

        {rows.map((r) => {
          const ev = r.event;
          const id = ev.id;
          const method = String(ev.payload?.payment_method ?? '').trim();
          const side = sides[id] ?? {};
          const out = r.amount < 0;
          return (
            <div key={id} style={{ borderBottom: '1px solid var(--border)', padding: '4px 0 8px' }}>
              <div className="row" style={{ borderBottom: 'none' }}>
                <span className="row-main">
                  <span className="row-title">{whoOf(ev)}</span>
                  <span className="row-sub" style={{ whiteSpace: 'normal' }}>
                    {kindOf(ev)} · {fmtDate(ev.occurred_at)}
                    {ev.event_type === 'Transfer'
                      ? ` · from ${String(ev.payload?.from ?? 'nowhere said')} to ${String(ev.payload?.to ?? 'nowhere said')}`
                      : method && how === 'unsaid' ? ` · said "${method}"` : ''}
                  </span>
                </span>
                {r.amount !== 0
                  ? <BigMoney value={Math.abs(r.amount)} sym={sym} size="md" tone={out ? 'out' : 'in'} />
                  : <span className="row-sub">no change here</span>}
                <span className="row-actions">
                  <Link href={`/dashboard/timeline?status=all&ids=${id}`} className="icon-pill" aria-label={`Open ${whoOf(ev)} in Activity`}>
                    <ArrowUpRight aria-hidden="true" />
                  </Link>
                </span>
              </div>

              {how === 'unsaid' && canFix && r.fix === 'method' && (
                <div role="group" aria-label={`How ${whoOf(ev)} was paid`}
                  style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', marginRight: 4 }}>
                    {out ? 'How was it paid?' : 'How did it come in?'}
                  </span>
                  {SAY.map((s) => (
                    <button key={s.how} type="button" className="pill pill-quiet" disabled={busy === id}
                      onClick={() => void say(r, { how: s.how })}>
                      {s.label}
                    </button>
                  ))}
                </div>
              )}

              {how === 'unsaid' && canFix && r.fix === 'transfer' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 8 }}>
                  {(['from', 'to'] as const).map((k) => (
                    <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
                      {k === 'from' ? 'Moved from' : 'Moved to'}
                      <select className="field" style={{ width: 'auto' }} value={side[k] ?? ''}
                        onChange={(e) => setSides((all) => ({ ...all, [id]: { ...all[id], [k]: e.target.value as SayHow } }))}>
                        <option value="" disabled>Choose</option>
                        {PLACES_TO_MOVE.map((s) => <option key={s.how} value={s.how}>{s.label}</option>)}
                      </select>
                    </label>
                  ))}
                  <button type="button" className="pill pill-primary"
                    disabled={busy === id || !side.from || !side.to || side.from === side.to}
                    onClick={() => side.from && side.to && void say(r, { from: side.from, to: side.to })}>
                    {busy === id ? 'Saving…' : 'Save'}
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {current && current.count > rows.length && (
          <button type="button" className="pill pill-quiet" style={{ marginTop: 12 }} onClick={() => setAll(true)}>
            Show all {current.count}
          </button>
        )}

        {current && current.count > 0 && (
          <p style={{ margin: '12px 0 0', fontSize: 'var(--fs-label)', color: 'var(--text-3)', lineHeight: 1.5 }}>
            {Math.abs(current.total - current.figure) < 0.005
              ? `These ${words(current.count)} add up to ${fmt(current.total, false, sym)}, the ${place.label.toLowerCase()} figure in Where it is.`
              : `These add up to ${fmt(current.total, false, sym)} but the figure shows ${fmt(current.figure, false, sym)}. Run the books check below.`}
          </p>
        )}
      </SectionCard>
    </div>
  );
}
