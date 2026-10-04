'use client';

// SimpleHome: the Simple-mode front door (/dashboard when uiMode === 'simple').
//
// Since the redesign pilot (4 October 2026) it opens on HomeTop, the shared
// Mercury × AIBOS home: the money and its line, where it is, AIBOS's read of
// the day, today's sales, getting paid, stock, recent activity and what is
// coming up. Below it, what only Simple mode shows: the work AIBOS prepared,
// getting started and what AIBOS is handling.
//
// Trust rule (SAFEGUARD §0.1): every number here comes from the twin, the
// product catalog or recorded events. Missing data shows an honest empty
// state, never a fabricated figure.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useProfile } from '@/lib/profile';
import { useAiAssistant } from '@/lib/aiAssistant';
import { industryOf } from '@/lib/industries';
import { TOUR_RESTART_EVENT } from '@/components/onboarding/DashboardTour';
import { fmt } from '@/lib/utils';
import { MIN_MONTHS } from '@/lib/change';
import { canAccess } from '@/lib/tiers';
import {
  reorderProposals, draftReorder, followUpProposals, dismissedFollowUps, dismissFollowUp,
  type ReorderProposal,
} from '@/lib/automation';
import { useBriefExtras } from '@/hooks/useBriefExtras';
import MilestoneBanner from '@/components/dashboard/MilestoneBanner';
import ActivationProgress from '@/components/dashboard/ActivationProgress';
import HomeTop from '@/components/home/HomeTop';
import Panel from '@/components/home/Panel';
import type { BusinessEvent } from '@/lib/api';

const ASKED_KEY = 'aibos-simple-asked-v1';

const sub: React.CSSProperties = { fontSize: 'var(--fs-label)', color: 'var(--text-3)', lineHeight: 1.5 };

export default function SimpleHome() {
  const twin = useStore((s) => s.twin);
  const sym = useStore((s) => s.currencySymbol) || 'K';
  const monthsRecorded = useStore((s) => s.monthly.length);
  const setUiMode = useStore((s) => s.setUiMode);
  const tier = useStore((s) => s.tier);
  const rfm = useStore((s) => s.rfm);
  const { profile } = useProfile();
  const { sendMessage, setOpen } = useAiAssistant();
  const extras = useBriefExtras();

  const ind = industryOf(profile?.business_type, profile?.industry);
  const money = useCallback((n: number) => fmt(n, true, sym), [sym]);
  const canAutomate = canAccess(tier, 'automation');
  const products = extras?.products ?? null;
  const eventCount = Number(twin?.event_count) || 0;

  const [asked, setAsked] = useState(true); // assume done until localStorage says otherwise
  useEffect(() => { try { setAsked(window.localStorage.getItem(ASKED_KEY) === '1'); } catch { /* private mode */ } }, []);
  const askFirst = useCallback(() => {
    setOpen(true);
    sendMessage(ind.prompts[0]);
    try { window.localStorage.setItem(ASKED_KEY, '1'); } catch { /* private mode */ }
    setAsked(true);
  }, [ind.prompts, sendMessage, setOpen]);

  // Drifting customers worth a check-in. Dismissals live on-device and expire after a week.
  const [fuDismissed, setFuDismissed] = useState<Set<string>>(new Set());
  useEffect(() => { setFuDismissed(dismissedFollowUps()); }, []);
  const followUps = useMemo(
    () => followUpProposals(rfm, sym, profile?.business_name).filter((f) => !fuDismissed.has(f.customerId)),
    [rfm, sym, profile?.business_name, fuDismissed],
  );
  const onFollowUpDone = useCallback((customerId: string) => {
    dismissFollowUp(customerId);
    setFuDismissed((prev) => new Set([...prev, customerId]));
  }, []);

  // Reorders AIBOS has prepared. Computed in memory: nothing touches the books
  // until the owner taps Draft (propose, then confirm, always).
  const proposals = useMemo(() => reorderProposals(products ?? []), [products]);
  const [draftState, setDraftState] = useState<Record<string, 'drafting' | 'done' | 'error'>>({});
  const [, setDrafted] = useState<BusinessEvent[]>([]);
  const onDraft = useCallback(async (p: ReorderProposal) => {
    setDraftState((s) => ({ ...s, [p.productId]: 'drafting' }));
    try {
      const ev = await draftReorder(p);
      setDraftState((s) => ({ ...s, [p.productId]: 'done' }));
      setDrafted((d) => [...d, ev]);
    } catch {
      setDraftState((s) => ({ ...s, [p.productId]: 'error' }));
    }
  }, []);

  const lowStock = (products ?? []).filter((p) => Number(p.reorder_level) > 0 && Number(p.on_hand ?? 0) <= Number(p.reorder_level));

  // Getting started: real signals only, hidden once complete.
  const steps = [
    { done: eventCount > 0, label: 'Record your first activity', href: '/dashboard/record' },
    { done: (products?.length ?? 0) > 0, label: `Add your ${ind.stockWord}`, href: '/dashboard/inventory' },
    { done: asked, label: 'Ask AIBOS a question', href: null },
  ];
  const showChecklist = products !== null && steps.some((s) => !s.done);

  // "AIBOS is handling this": honest automation receipts from real data.
  const handled: string[] = [];
  if (eventCount > 0) handled.push(`Your books: ${eventCount} ${eventCount === 1 ? 'entry' : 'entries'} recorded. Cash, ${ind.stockWord} and money owed update themselves.`);
  if (products && products.length > 0) {
    handled.push(lowStock.length > 0
      ? `Watching your ${ind.stockWord}: ${lowStock.length} item${lowStock.length === 1 ? '' : 's'} at or below reorder level.`
      : `Watching your ${ind.stockWord}: all ${products.length} items above their reorder levels.`);
  }
  // The label waits for three months, as on Briefs (UI/UX audit A11).
  if (twin?.health_label && monthsRecorded >= MIN_MONTHS) handled.push(`Business health: ${twin.health_label}.`);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ActivationProgress />
      <MilestoneBanner />

      <HomeTop />

      {/* Work AIBOS prepared: reorders and check-ins, one tap each. */}
      {(proposals.length > 0 || followUps.length > 0) && (
        <Panel title="AIBOS prepared this" labelledBy="prepared-title"
          action={!canAutomate ? <Link href="/checkout?plan=proplus" className="pill pill-quiet">Pro+</Link> : undefined}>
          <div style={{ display: 'grid', gap: 4 }}>
            {proposals.slice(0, 4).map((p) => {
              const st = draftState[p.productId];
              return (
                <div key={p.productId} className="row-link" style={{ cursor: 'default', flexWrap: 'wrap' }}>
                  <span className="row-main" style={{ flex: '1 1 220px' }}>
                    <span className="row-title">Reorder {p.headline}</span>
                    <span className="row-sub" style={{ whiteSpace: 'normal' }}>
                      {p.reason}{p.estimatedCost !== undefined ? `, about ${money(p.estimatedCost)}` : ''}
                    </span>
                  </span>
                  {st === 'done' ? (
                    <span style={{ ...sub, color: 'var(--green)', fontWeight: 600 }}>Drafted. Confirm when it arrives</span>
                  ) : canAutomate ? (
                    <button type="button" className="pill pill-primary" onClick={() => void onDraft(p)} disabled={st === 'drafting'}>
                      {st === 'drafting' ? 'Drafting…' : st === 'error' ? 'Try again' : 'Draft reorder'}
                    </button>
                  ) : (
                    <Link href="/checkout?plan=proplus" className="pill pill-quiet">Unlock one-tap reorders</Link>
                  )}
                </div>
              );
            })}
            {/* AIBOS drafts the check-in; the owner sends it from their OWN WhatsApp. */}
            {followUps.map((f) => (
              <div key={f.customerId} className="row-link" style={{ cursor: 'default', flexWrap: 'wrap' }}>
                <span className="row-main" style={{ flex: '1 1 220px' }}>
                  <span className="row-title">Check in with {f.headline}</span>
                  <span className="row-sub" style={{ whiteSpace: 'normal' }}>{f.reason}</span>
                </span>
                {canAutomate ? (
                  <span style={{ display: 'flex', gap: 8 }}>
                    <a href={f.waLink} target="_blank" rel="noopener noreferrer" className="pill pill-primary">Send on WhatsApp</a>
                    <button type="button" className="pill pill-quiet" onClick={() => onFollowUpDone(f.customerId)}>Done</button>
                  </span>
                ) : (
                  <Link href="/checkout?plan=proplus" className="pill pill-quiet">Unlock check-in drafts</Link>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {(showChecklist || handled.length > 0) && (
        <div className="home-trio">
          {showChecklist && (
            <Panel title="Getting started" labelledBy="getting-started-title">
              <div style={{ display: 'grid', gap: 4 }}>
                {steps.map((s) => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 44 }}>
                    <span aria-hidden="true" className={`avatar ${s.done ? 'avatar-in' : ''}`} style={{ width: 28, height: 28 }}>
                      {s.done && <Check />}
                    </span>
                    {s.done ? (
                      <span style={{ ...sub, textDecoration: 'line-through' }}>{s.label}</span>
                    ) : s.href ? (
                      <Link href={s.href} className="tap-link" style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-1)', textDecoration: 'none' }}>{s.label}</Link>
                    ) : (
                      <button type="button" onClick={askFirst} className="btn-inline"
                        style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-1)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', minHeight: 44 }}>
                        {s.label}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </Panel>
          )}
          {handled.length > 0 && (
            <Panel title="AIBOS is handling this for you" labelledBy="handled-title">
              <div style={{ display: 'grid', gap: 10 }}>
                {handled.map((line) => (
                  <div key={line} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span aria-hidden="true" style={{ color: 'var(--green)', flexShrink: 0, display: 'flex', marginTop: 3 }}><Check size={18} /></span>
                    <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', lineHeight: 1.5 }}>{line}</span>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
        <button type="button" className="pill pill-quiet" onClick={() => setUiMode('technical')}>
          Want the full picture? Switch to Pro mode
        </button>
        <button type="button" className="pill pill-quiet" onClick={() => window.dispatchEvent(new Event(TOUR_RESTART_EVENT))}>
          Take the tour again
        </button>
      </div>
    </div>
  );
}
