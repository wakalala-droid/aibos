'use client';
/**
 * AIBOS — "Is this you?" — the Setup Wizard's identity match.
 *
 * The owner types their business name. If AIBOS can find their existing public
 * listing, it offers it back as ONE TAP that fills industry, location, hours,
 * phone, website and logo. Eight fields for one tap, on a phone, on mobile data.
 *
 * Three rules this component exists to keep:
 *   1. CONFIRM, NEVER ASSUME. Nothing is applied until the owner taps yes. A
 *      wrong match applied silently is worse than no match at all.
 *   2. SAY WHERE IT CAME FROM. Every applied field is labelled as imported and
 *      is still editable in the fields above — this is a head start, not a lock.
 *   3. NEVER BE IN THE WAY. Searching is silent and cancellable; a failed
 *      lookup renders nothing. Someone typing their way through setup must
 *      never notice this feature exists when it has nothing to offer.
 *
 * The empty result is a feature, not an apology: most Zambian SMEs are not on
 * Google at all, and telling them so — with an offer to fix it — is worth more
 * than the pre-fill.
 */
import { AnimatePresence, motion } from 'framer-motion';
import BorderGlow from '@/components/ui/BorderGlow';
import type { BusinessMatch } from '@/lib/api';

interface Props {
  /** Candidates for the name currently in the field. */
  matches: BusinessMatch[];
  /** A lookup is in flight (shown as one quiet line, never a blocking spinner). */
  searching: boolean;
  /** We looked and found nothing — distinct from "we haven't looked yet". */
  searched: boolean;
  /** The name that produced these results, for the not-found copy. */
  query: string;
  /** The match the owner confirmed, if any — drives the applied state.
   *  Passed WHOLE rather than by id: the wizard clears `matches` the moment one
   *  is applied, so looking it up in that list would find nothing. */
  applied: BusinessMatch | null;
  onApply: (match: BusinessMatch) => void;
  onUndo: () => void;
  onDismiss: () => void;
}

const CURSOR_GLOW = '190 95 62';
const MESH = ['#22d3ee', '#60a5fa', '#a78bfa'];

const metaText: React.CSSProperties = {
  fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: 0,
};
const titleText: React.CSSProperties = {
  fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text-1)', margin: 0,
};

/** The shared surface: cursor-reactive border + bento dot texture, per the
 *  core chrome rule. Every card this component draws goes through here. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <BorderGlow
      glowColor={CURSOR_GLOW} backgroundColor="var(--bg-card)" borderRadius={14}
      glowRadius={48} glowIntensity={1.2} coneSpread={12} colors={MESH}
    >
      <div className="section-card glow-inner" style={{ padding: 16 }}>
        <span className="bento-tex" aria-hidden="true" />
        {children}
      </div>
    </BorderGlow>
  );
}

function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '').join('') || '?';
}

/** What we can tell them about this listing, in the order it helps them decide:
 *  where it is, then what it is, then how busy it looks. */
function detailsOf(m: BusinessMatch): string {
  const bits = [m.address || m.location, m.industry].filter(Boolean);
  if (m.reviews) bits.push(`${m.rating ?? '—'} ★ (${m.reviews})`);
  return bits.join(' · ');
}

/** Exactly one of these is on screen at a time. Deriving it up front — rather
 *  than letting four conditional blocks each decide for themselves — is what
 *  makes the state machine legible and the transitions predictable. */
type View = 'applied' | 'searching' | 'matches' | 'none' | null;

export default function BusinessMatchCard({
  matches, searching, searched, query, applied, onApply, onUndo, onDismiss,
}: Props) {
  const view: View =
      applied              ? 'applied'
    : searching            ? 'searching'
    : matches.length > 0   ? 'matches'
    : searched             ? 'none'
    : null;

  if (!view) return null;

  return (
    <div data-bento aria-live="polite" style={{ marginTop: -8, marginBottom: 18 }}>
      {/* Same crossfade idiom as the wizard's own step transitions, one file up. */}
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
        >
          {/* ── Looking. One line, no spinner card — they should keep typing. ── */}
          {view === 'searching' && (
            <p style={{ ...metaText, color: 'var(--text-4)' }}>
              Looking for your business online…
            </p>
          )}

          {/* ── Applied. Says what happened and offers the way back. ────────── */}
          {view === 'applied' && (
            <Shell>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span aria-hidden="true" style={{ fontSize: '1.25rem' }}>✅</span>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <p style={titleText}>Filled in from your online listing</p>
                  <p style={{ ...metaText, marginTop: 4 }}>
                    Everything is editable — check the fields above and change anything
                    that&apos;s out of date.
                  </p>
                </div>
                <button
                  type="button" onClick={onUndo} className="touch-target"
                  style={{
                    minHeight: 48, padding: '0 16px', borderRadius: 10,
                    border: '1px solid var(--border-md)', background: 'transparent',
                    color: 'var(--text-2)', fontSize: 'var(--fs-label)', fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Undo
                </button>
              </div>
            </Shell>
          )}

          {/* ── Candidates. At most three; the owner decides. ───────────────── */}
          {view === 'matches' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ ...metaText, fontWeight: 600 }}>
                {matches.length === 1 ? 'We found this online. Is this you?' : 'Is one of these you?'}
              </p>

              {matches.map(m => (
                <Shell key={m.place_id}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    {m.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.logo_url} alt="" width={40} height={40}
                        style={{ borderRadius: 10, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }}
                      />
                    ) : (
                      <span aria-hidden="true" style={{
                        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                        background: 'linear-gradient(135deg, var(--e1), var(--cyan))', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 'var(--fs-label)', fontWeight: 800,
                      }}>
                        {initialsOf(m.business_name)}
                      </span>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={titleText}>{m.business_name}</p>
                      {detailsOf(m) && <p style={{ ...metaText, marginTop: 4 }}>{detailsOf(m)}</p>}
                      {m.operating_hours && <p style={{ ...metaText, marginTop: 2 }}>{m.operating_hours}</p>}
                      {/* Said plainly rather than colour-coded: a listing Google
                          thinks is shut is usually stale, and the owner is the
                          only one who can say so. */}
                      {m.closed && (
                        <p style={{ ...metaText, marginTop: 4, color: 'var(--warn)' }}>
                          This listing is marked closed — if that&apos;s wrong, it&apos;s worth fixing on Google.
                        </p>
                      )}

                      <button
                        type="button" onClick={() => onApply(m)} className="touch-target"
                        style={{
                          marginTop: 12, minHeight: 48, padding: '0 20px', borderRadius: 10,
                          border: 'none', background: 'var(--cyan)', color: '#04121a',
                          fontSize: 'var(--fs-label)', fontWeight: 700, cursor: 'pointer',
                        }}
                      >
                        Yes, that&apos;s my business
                      </button>
                    </div>
                  </div>
                </Shell>
              ))}

              <button
                type="button" onClick={onDismiss}
                style={{
                  alignSelf: 'flex-start', background: 'none', border: 'none', padding: '8px 0',
                  color: 'var(--text-4)', fontSize: 'var(--fs-label)', textDecoration: 'underline',
                  cursor: 'pointer',
                }}
              >
                {matches.length === 1 ? 'Not my business' : 'None of these'}
              </button>
            </div>
          )}

          {/* ── Nothing found. An offer, not an apology. ────────────────────── */}
          {view === 'none' && (
            <Shell>
              <p style={titleText}>
                We couldn&apos;t find {query.trim() || 'your business'} online
              </p>
              <p style={{ ...metaText, marginTop: 4 }}>
                That&apos;s normal — most small businesses aren&apos;t listed yet. Carry on
                filling this in, and once you&apos;re set up AIBOS can help you get on
                Google Maps so customers can find you.
              </p>
            </Shell>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
