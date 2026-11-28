'use client';

/**
 * Review AI-BOS (20 Nov 2026): an owner gives AI-BOS one to five stars, says why
 * and chooses who sees it: the AI-BOS team only, or the AI-BOS website too with
 * the name, business and town they type, and their logo only if they tick that
 * as well. One review each, which they can change or take back at any time.
 *
 * Reached from the account menu, the search box and the ask in the bell
 * (aibos-api reviews.py ASK_LINK). Nothing here is written for the owner: the
 * words are theirs, and nothing reaches the website without their yes. The
 * API checks everything again (reviews.save); these checks only answer sooner.
 */

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Pencil, Send, Star, Trash2 } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Chip, Note, Segmented } from '@/components/hospitality/kit';
import ReviewCard, { Stars } from '@/components/marketing/ReviewCard';
import { getMyReview, removeMyReview, saveMyReview, type AibosReview, type ReviewSuggest } from '@/lib/api';
import { useProfile } from '@/lib/profile';
import { STAR_WORDS } from '@/lib/reviews';

type Where = 'site' | 'team';
type Field = 'stars' | 'body' | 'where' | 'who';

const BODY_MIN = 10;
const BODY_MAX = 600;
const FIELD_MAX = 60;
const NO_SUGGEST: ReviewSuggest = { name: '', business: '', town: '', has_logo: false };

/** The words as the website will keep them: spaces tidied, as reviews.save does. */
function tidy(text: string): string {
  return text.split(/\s+/).filter(Boolean).join(' ');
}

function monthOf(at?: string | null): string {
  const d = at ? new Date(at) : new Date();
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

export default function ReviewAibosPage() {
  const { profile } = useProfile();
  const [phase, setPhase] = useState<'loading' | 'ready' | 'not-ready' | 'failed'>('loading');
  const [saved, setSaved] = useState<AibosReview | null>(null);
  const [suggest, setSuggest] = useState<ReviewSuggest>(NO_SUGGEST);
  const [editing, setEditing] = useState(true);

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState('');
  const [where, setWhere] = useState<Where | null>(null);
  const [name, setName] = useState('');
  const [business, setBusiness] = useState('');
  const [town, setTown] = useState('');
  const [logo, setLogo] = useState(false);

  const [busy, setBusy] = useState<'' | 'saving' | 'removing'>('');
  const [problem, setProblem] = useState<{ field: Field | null; text: string } | null>(null);
  const [thanks, setThanks] = useState<'' | 'site' | 'team' | 'removed'>('');
  const [asking, setAsking] = useState(false);

  const formTitle = useRef<HTMLHeadingElement>(null);
  const doneTitle = useRef<HTMLHeadingElement>(null);
  const keepBtn = useRef<HTMLButtonElement>(null);
  const focusNext = useRef<'form' | 'done' | 'keep' | null>(null);

  const fill = useCallback((from: AibosReview | null, s: ReviewSuggest) => {
    setRating(from?.rating ?? 0);
    setBody(from?.body ?? '');
    setWhere(from ? (from.show_on_site ? 'site' : 'team') : null);
    setName(from?.name || s.name);
    setBusiness(from?.business || s.business);
    setTown(from?.town || s.town);
    setLogo(Boolean(from?.show_logo));
    setProblem(null);
  }, []);

  const load = useCallback(async () => {
    setPhase('loading');
    try {
      const mine = await getMyReview();
      const s = mine.suggest ?? NO_SUGGEST;
      setSuggest(s);
      if (!mine.ready) { setPhase('not-ready'); return; }
      setSaved(mine.review);
      setEditing(!mine.review);
      fill(mine.review, s);
      setPhase('ready');
    } catch {
      setPhase('failed');
    }
  }, [fill]);

  useEffect(() => { void load(); }, [load]);

  // Focus follows the change of view, after it has drawn.
  useEffect(() => {
    const to = focusNext.current;
    focusNext.current = null;
    if (to === 'form') formTitle.current?.focus();
    else if (to === 'done') doneTitle.current?.focus();
    else if (to === 'keep') keepBtn.current?.focus();
  });

  const words = tidy(body);
  const count = [...words].length;
  const shown = hover || rating;
  const logoUrl = profile?.logo_url && profile.logo_url.startsWith('https://') ? profile.logo_url : null;
  // The API says whether there is a logo to offer; the profile has its address for the preview.
  const canLogo = suggest.has_logo;

  function fail(field: Field | null, text: string) {
    setProblem({ field, text });
    const id = field === 'stars' ? 'review-star-1' : field === 'body' ? 'review-body'
      : field === 'where' ? 'review-where' : field === 'who' ? 'review-name' : null;
    const el = id ? document.getElementById(id) : null;
    // The where choice is a group: its first button takes the focus.
    const target = el && field === 'where' ? el.querySelector('button') : el;
    (target as HTMLElement | null)?.focus();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setThanks('');
    if (rating < 1) return fail('stars', 'Choose from one to five stars.');
    if (count < BODY_MIN) return fail('body', 'Say a little more: a sentence about what AI-BOS does for you.');
    if (count > BODY_MAX) return fail('body', `Keep it to ${BODY_MAX} characters, about a short paragraph.`);
    if (!where) return fail('where', 'Choose who sees your review.');
    if (where === 'site' && !name.trim() && !business.trim()) {
      return fail('who', 'Add your name or your business, so people know who said it.');
    }
    setBusy('saving');
    setProblem(null);
    try {
      const review = await saveMyReview({
        rating, body: words, name: name.trim(), business: business.trim(), town: town.trim(),
        show_on_site: where === 'site', show_logo: where === 'site' && canLogo && logo,
      });
      setSaved(review);
      setEditing(false);
      setThanks(review.show_on_site ? 'site' : 'team');
      focusNext.current = 'done';
    } catch (err) {
      setProblem({ field: null, text: (err as Error).message || 'Your review did not send. Try again.' });
    } finally {
      setBusy('');
    }
  }

  async function takeBack() {
    if (busy) return;
    setBusy('removing');
    setProblem(null);
    try {
      await removeMyReview();
      setSaved(null);
      setAsking(false);
      setEditing(true);
      fill(null, suggest);
      setThanks('removed');
      focusNext.current = 'form';
    } catch (err) {
      setProblem({ field: null, text: (err as Error).message || 'Your review was not taken back. Try again.' });
    } finally {
      setBusy('');
    }
  }

  function change() {
    fill(saved, suggest);
    setThanks('');
    setAsking(false);
    setEditing(true);
    focusNext.current = 'form';
  }

  function cancel() {
    fill(saved, suggest);
    setEditing(false);
    focusNext.current = 'done';
  }

  const errorFor = (field: Field) => (problem?.field === field ? problem.text : '');
  const said = (field: Field) => (problem?.field === field
    ? <p id={`review-${field}-error`} className="rs-text" role="alert" style={{ marginTop: 8, color: 'var(--crit)' }}>{problem.text}</p>
    : null);

  const header = (
    <PageHeader
      title="Review AI-BOS"
      subtitle="Tell us how AI-BOS is working for you. You choose who sees it."
    />
  );

  if (phase === 'loading') {
    return (
      <>
        {header}
        <section className="section-card" aria-busy="true">
          <p className="rs-text is-quiet">Opening your review…</p>
        </section>
      </>
    );
  }

  if (phase === 'not-ready' || phase === 'failed') {
    return (
      <>
        {header}
        <section className="section-card">
          {phase === 'not-ready'
            ? <Note tone="info">Reviews open soon. Come back in a little while.</Note>
            : <Note tone="bad">Your review did not open. Check your connection and try again.</Note>}
          {phase === 'failed' && (
            <div className="rs-btns" style={{ marginTop: 18 }}>
              <button type="button" className="rs-btn is-quiet" onClick={() => void load()}>Try again</button>
            </div>
          )}
        </section>
      </>
    );
  }

  const preview = where === 'site' && rating > 0 && words.length > 0;

  return (
    <>
      {header}

      {!editing && saved && (
        <section className="section-card" aria-labelledby="review-done-title">
          <div className="rs-sec-head" style={{ marginBottom: 12 }}>
            <h2 id="review-done-title" ref={doneTitle} tabIndex={-1} className="rs-sec-title">Your review</h2>
            <Chip>{saved.show_on_site ? (saved.hidden ? 'Off the website' : 'On the AI-BOS website') : 'AI-BOS team only'}</Chip>
          </div>

          {thanks === 'site' && !saved.hidden && (
            <Note tone="good">Thank you. Your review shows on the AI-BOS website within a few minutes.</Note>
          )}
          {thanks === 'team' && <Note tone="good">Thank you. The AI-BOS team reads every review.</Note>}
          {saved.hidden && (
            <Note tone="warn">
              The AI-BOS team took this review off the website. That happens only for abuse, spam or private
              details such as a phone number. The team still reads it.
            </Note>
          )}

          <div style={{ marginTop: 20, maxWidth: 640 }}>
            {saved.show_on_site ? (
              <ReviewCard review={{ ...saved, month: monthOf(saved.created_at), logo: saved.show_logo ? logoUrl : null }} />
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                <Stars rating={saved.rating} />
                <p className="rs-text" style={{ color: 'var(--text-1)' }}>&ldquo;{saved.body}&rdquo;</p>
              </div>
            )}
          </div>

          <div className="rs-btns" style={{ marginTop: 22 }}>
            <button type="button" className="rs-btn is-navy" onClick={change} disabled={busy !== ''}>
              <Pencil aria-hidden="true" /> Change it
            </button>
            <button type="button" className="rs-btn is-quiet" aria-expanded={asking} aria-controls="review-take-back"
              onClick={() => { setAsking(true); focusNext.current = 'keep'; }} disabled={busy !== ''}>
              <Trash2 aria-hidden="true" /> Take it back
            </button>
          </div>

          {asking && (
            <div id="review-take-back" role="group" aria-labelledby="review-take-back-q" style={{ marginTop: 18 }}>
              <p id="review-take-back-q" className="rs-text is-strong">
                Take your review back?{saved.show_on_site ? ' It comes off the website too.' : ''}
              </p>
              <div className="rs-btns" style={{ marginTop: 12 }}>
                <button type="button" className="rs-btn is-danger" onClick={() => void takeBack()} disabled={busy !== ''}>
                  {busy === 'removing' ? 'Taking it back…' : 'Yes, take it back'}
                </button>
                <button type="button" ref={keepBtn} className="rs-btn is-quiet" onClick={() => setAsking(false)} disabled={busy !== ''}>
                  Keep it
                </button>
              </div>
            </div>
          )}
          {problem && !problem.field && <Note tone="bad">{problem.text}</Note>}
        </section>
      )}

      {editing && (
        <section className="section-card" aria-labelledby="review-form-title">
          <h2 id="review-form-title" ref={formTitle} tabIndex={-1} className="rs-sec-title">
            {saved ? 'Change your review' : 'How is AI-BOS working for you?'}
          </h2>
          <p className="rs-text is-quiet" style={{ marginTop: 6 }}>
            It takes a minute. Your words go as you write them, and you can change them later.
          </p>
          {thanks === 'removed' && <Note tone="good">Your review is taken back. Write a new one any time.</Note>}

          <form onSubmit={(e) => void submit(e)} noValidate style={{ display: 'grid', gap: 26, marginTop: 22 }}>
            <fieldset className="review-pick" aria-describedby={errorFor('stars') ? 'review-stars-error' : undefined}>
              <legend className="field-label">How many stars</legend>
              <div className="review-pick-row" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n} className={`review-pick-star${n <= shown ? ' is-on' : ''}`} onMouseEnter={() => setHover(n)}>
                    <input id={`review-star-${n}`} type="radio" name="review-stars" value={n} className="sr-only"
                      checked={rating === n} onChange={() => { setRating(n); if (problem?.field === 'stars') setProblem(null); }} />
                    <span className="review-pick-face"><Star aria-hidden="true" strokeWidth={1.75} /></span>
                    <span className="sr-only">{n} {n === 1 ? 'star' : 'stars'}, {STAR_WORDS[n].toLowerCase()}</span>
                  </label>
                ))}
                <span className={`review-pick-word${shown ? '' : ' is-quiet'}`} aria-hidden="true">
                  {shown ? STAR_WORDS[shown] : 'Choose'}
                </span>
              </div>
              {said('stars')}
            </fieldset>

            <div>
              <label className="field-label" htmlFor="review-body">What would you tell another business owner about AI-BOS?</label>
              <textarea id="review-body" className="field" rows={5} value={body}
                onChange={(e) => { setBody(e.target.value); if (problem?.field === 'body') setProblem(null); }}
                aria-invalid={errorFor('body') ? true : undefined}
                aria-describedby={`review-body-hint review-body-count${errorFor('body') ? ' review-body-error' : ''}`}
                placeholder="What it does for you, what changed since you started, what could be better."
                style={{ minHeight: 132, resize: 'vertical', lineHeight: 1.6 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px 16px', marginTop: 6 }}>
                <span id="review-body-hint" style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
                  A sentence or two. Good and bad both help.
                </span>
                <span id="review-body-count" style={{ fontSize: 'var(--fs-label)', fontVariantNumeric: 'tabular-nums',
                  color: count > BODY_MAX ? 'var(--crit)' : 'var(--text-3)' }}>
                  {count > BODY_MAX ? `${count - BODY_MAX} over the ${BODY_MAX}` : `${count} of ${BODY_MAX}`}
                </span>
              </div>
              {said('body')}
            </div>

            <div>
              <p className="field-label" id="review-where-label">Who sees it</p>
              <div id="review-where">
                <Segmented<Where>
                  label="Who sees it"
                  value={where}
                  onChange={(v) => { setWhere(v); if (problem?.field === 'where') setProblem(null); }}
                  options={[
                    { value: 'site', label: 'The AI-BOS website too' },
                    { value: 'team', label: 'The AI-BOS team only' },
                  ]}
                />
              </div>
              <p className="rs-text is-quiet" style={{ marginTop: 10, fontSize: 'var(--fs-label)' }}>
                {where === 'site'
                  ? 'Your stars, your words and the name below go on the AI-BOS website for other owners to read. Leave out web addresses, emails and phone numbers.'
                  : where === 'team'
                    ? 'Only the AI-BOS team reads it. Nothing goes on the website.'
                    : 'Nothing goes on the website unless you choose it here.'}
              </p>
              {said('where')}
            </div>

            {where === 'site' && (
              <div style={{ display: 'grid', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 14 }}>
                  <div>
                    <label className="field-label" htmlFor="review-name">Your name</label>
                    <input id="review-name" className="field" value={name} maxLength={FIELD_MAX} autoComplete="given-name"
                      onChange={(e) => { setName(e.target.value); if (problem?.field === 'who') setProblem(null); }}
                      aria-invalid={errorFor('who') ? true : undefined}
                      aria-describedby={`review-who-hint${errorFor('who') ? ' review-who-error' : ''}`} />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="review-business">Business</label>
                    <input id="review-business" className="field" value={business} maxLength={FIELD_MAX} autoComplete="organization"
                      onChange={(e) => { setBusiness(e.target.value); if (problem?.field === 'who') setProblem(null); }}
                      aria-describedby="review-who-hint" />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="review-town">Town</label>
                    <input id="review-town" className="field" value={town} maxLength={FIELD_MAX} autoComplete="address-level2"
                      onChange={(e) => setTown(e.target.value)} aria-describedby="review-who-hint" />
                  </div>
                </div>
                <p id="review-who-hint" className="rs-text is-quiet" style={{ fontSize: 'var(--fs-label)' }}>
                  Your name or your business is needed. The town is up to you.
                </p>
                {said('who')}

                {canLogo ? (
                  <label className="check-row" htmlFor="review-logo">
                    <input id="review-logo" type="checkbox" checked={logo} onChange={(e) => setLogo(e.target.checked)} />
                    <span>Show my business logo with it</span>
                  </label>
                ) : (
                  <p className="rs-text is-quiet" style={{ fontSize: 'var(--fs-label)' }}>
                    No logo yet. Add one in <Link href="/dashboard/profile" style={{ color: 'var(--text-1)' }}>Settings</Link> and
                    it can go with your review.
                  </p>
                )}

                {preview && (
                  <div style={{ maxWidth: 640 }}>
                    <p className="field-label" id="review-preview-label">How it will look on the website</p>
                    <div role="group" aria-labelledby="review-preview-label">
                      <ReviewCard review={{
                        rating, body: words, name: name.trim(), business: business.trim(), town: town.trim(),
                        month: monthOf(saved?.created_at), logo: canLogo && logo ? logoUrl : null,
                      }} />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <div className="rs-btns">
                <button type="submit" className="rs-btn is-navy" disabled={busy !== ''}>
                  <Send aria-hidden="true" /> {busy === 'saving' ? 'Sending…' : saved ? 'Save changes' : 'Send my review'}
                </button>
                {saved && (
                  <button type="button" className="rs-btn is-quiet" onClick={cancel} disabled={busy !== ''}>Cancel</button>
                )}
              </div>
              {problem && !problem.field && <Note tone="bad">{problem.text}</Note>}
            </div>
          </form>
        </section>
      )}
    </>
  );
}
