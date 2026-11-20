'use client';

/**
 * Admin · Reviews: the review centre (20 Nov 2026).
 *
 * Every review owners wrote about AIBOS, newest first: what the website shows,
 * what went to the team only, and the ask that invites the rest. An
 * administrator can take a shared review off the website, and only for abuse,
 * spam or someone's private details; never because it is unhappy. Its writer
 * is told on their own Review AIBOS page. Nothing here writes or changes what
 * anyone said. The API is the gate (aibos-api reviews.py, admin only).
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { listAllReviews, setReviewStatus, type AdminReviews } from '@/lib/api';
import { Chip, Fact, Facts, Note } from '@/components/hospitality/kit';
import ReviewAskCard from '@/components/admin/ReviewAskCard';
import { Stars } from '@/components/marketing/ReviewCard';
import { whoSaid, whereWhen } from '@/lib/reviews';

const NAV_LINK: React.CSSProperties = { fontSize: 'var(--fs-data)', fontWeight: 600, color: 'var(--text-3)', textDecoration: 'none', padding: '6px 12px', borderRadius: 'var(--radius-md)' };
const NAV_HERE: React.CSSProperties = { ...NAV_LINK, fontWeight: 700, color: 'var(--text-1)', background: 'var(--bg-badge)', border: '1px solid var(--border)' };

function when(at?: string | null): string {
  const d = at ? new Date(at) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

export default function AdminReviewsPage() {
  const [data, setData] = useState<AdminReviews | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [said, setSaid] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await listAllReviews());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const flip = async (id: string, to: 'shown' | 'hidden') => {
    setBusyId(id);
    setSaid('');
    try {
      await setReviewStatus(id, to);
      setData((d) => {
        if (!d) return d;
        const reviews = d.reviews.map((r) => (r.id === id ? { ...r, status: to, hidden: to === 'hidden' } : r));
        return { ...d, reviews, on_site: reviews.filter((r) => r.show_on_site && r.status === 'shown').length };
      });
      setSaid(to === 'hidden' ? 'Taken off the website. Its writer is told on their Review AIBOS page.' : 'Back on the website within a minute.');
    } catch (e) {
      setSaid((e as Error).message);
    } finally {
      setBusyId('');
    }
  };

  const reviews = data?.reviews ?? [];

  return (
    <div style={{ padding: '8px 0 48px' }}>
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 'var(--fs-h2)', fontWeight: 800, color: 'var(--text-1)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
          Reviews
        </h1>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: 0 }}>
          What owners said about AIBOS. The website shows every review its writer shared, newest first, low stars too.
        </p>
      </header>
      <nav aria-label="Admin sections" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <Link href="/admin" style={NAV_LINK}>Accounts</Link>
        <Link href="/admin/usage" style={NAV_LINK}>Usage</Link>
        <Link href="/admin/proposals" style={NAV_LINK}>Proposals</Link>
        <Link href="/admin/reviews" aria-current="page" style={NAV_HERE}>Reviews</Link>
      </nav>

      {data && !data.ready && (
        <div className="section-card" style={{ marginBottom: 16 }}>
          <Note tone="warn">{data.detail || 'Reviews are not set up yet. Run migration 0048 in the Supabase SQL editor.'}</Note>
        </div>
      )}

      <section className="section-card" style={{ marginBottom: 16 }} aria-labelledby="reviews-count-title" aria-busy={loading}>
        <h2 id="reviews-count-title" className="sr-only">The count</h2>
        <Facts>
          <Fact label="Reviews" value={loading ? '…' : String(data?.count ?? 0)} />
          <Fact label="On the website" value={loading ? '…' : String(data?.on_site ?? 0)} />
          <Fact label="Average" value={loading ? '…' : data?.average != null ? `${data.average} of 5` : 'None yet'}
            hint={data?.average != null ? 'Every review, shared or not' : undefined} />
        </Facts>
      </section>

      <ReviewAskCard ready={Boolean(data?.ready)} />

      <section className="section-card" aria-labelledby="reviews-list-title">
        <div className="rs-sec-head" style={{ marginBottom: 6 }}>
          <h2 id="reviews-list-title" className="rs-sec-title">Every review</h2>
          {reviews.length > 0 && <Chip>Newest first</Chip>}
        </div>
        <p className="rs-text is-quiet">
          Take a review off the website only for abuse, spam or someone&apos;s private details, never because it is
          unhappy. Its writer is told, and the team still reads it here.
        </p>
        {said && <Note tone="info">{said}</Note>}
        {error && <Note tone="bad">{error}</Note>}
        {!loading && !error && reviews.length === 0 && (
          <p className="rs-text" style={{ marginTop: 18 }}>No reviews yet. Ask above, and they arrive here as owners write them.</p>
        )}

        <ul style={{ listStyle: 'none', margin: '18px 0 0', padding: 0, display: 'grid', gap: 12 }}>
          {reviews.map((r) => {
            const who = whoSaid(r) || 'No name given';
            const where = whereWhen({ town: r.town, month: when(r.updated_at || r.created_at) });
            const place = !r.show_on_site ? 'AIBOS team only' : r.status === 'hidden' ? 'Taken off the website' : 'On the website';
            return (
              <li key={r.id} style={{ padding: 18, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-md)', background: r.status === 'hidden' ? 'var(--pill-bg)' : 'var(--bg-card)' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <Stars rating={r.rating} />
                  <Chip>{place}{r.show_on_site && r.show_logo ? ', with logo' : ''}</Chip>
                </div>
                <p className="rs-text" style={{ marginTop: 12, color: 'var(--text-1)', overflowWrap: 'anywhere' }}>&ldquo;{r.body}&rdquo;</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14 }}>
                  <div style={{ minWidth: 0 }}>
                    <p className="rs-text is-strong" style={{ overflowWrap: 'anywhere' }}>{who}</p>
                    {where && <p className="rs-text is-quiet" style={{ fontSize: 'var(--fs-label)' }}>{where}</p>}
                  </div>
                  <div className="rs-btns">
                    {r.user_id && <Link href={`/admin/${r.user_id}`} className="rs-btn is-sm is-quiet">Open account</Link>}
                    {r.show_on_site && (
                      r.status === 'hidden' ? (
                        <button type="button" className="rs-btn is-sm is-quiet" disabled={busyId === r.id}
                          onClick={() => void flip(r.id, 'shown')} aria-label={`Show it again: the review by ${who}`}>
                          <Eye aria-hidden="true" /> {busyId === r.id ? 'Saving…' : 'Show it again'}
                        </button>
                      ) : (
                        <button type="button" className="rs-btn is-sm is-quiet" disabled={busyId === r.id}
                          onClick={() => void flip(r.id, 'hidden')} aria-label={`Take off the website: the review by ${who}`}>
                          <EyeOff aria-hidden="true" /> {busyId === r.id ? 'Saving…' : 'Take off the website'}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
