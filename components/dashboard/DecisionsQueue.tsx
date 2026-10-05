'use client';

// DecisionsQueue — the Overview opens on the answer, not the data (audit §12.01).
//
// "What needs you today": the 1–3 things that changed and the action for each,
// ranked by severity, each with a one-tap response. The metrics grid below
// becomes the evidence for these decisions, not the front page.
//
// Trust rules (SAFEGUARD §0.1): every decision is derived from recorded data —
// runway from the cashflow engine, reorders from real stock levels the owner
// set, follow-ups from the RFM engine, alerts from anomaly detection. If a
// signal has no data behind it, its decision is omitted; when nothing needs
// attention, the band says so honestly instead of inventing urgency.
// Propose → confirm, always: "Draft reorder" creates a PENDING receipt the
// owner confirms on arrival; check-ins are sent from the owner's own WhatsApp.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { useProfile } from '@/lib/profile';
import { canAccess } from '@/lib/tiers';
import { fmt } from '@/lib/utils';
import { listProducts, type Product } from '@/lib/api';
import {
  reorderProposals, draftReorder, followUpProposals, dismissedFollowUps, dismissFollowUp,
  type ReorderProposal,
} from '@/lib/automation';
import { AlertTriangle, Activity, MessageCircle, Package, Wallet } from 'lucide-react';
import BentoCard from '@/components/ui/BentoCard';

type Severity = 'crit' | 'warn';

interface Decision {
  id: string;
  severity: Severity;
  headline: string;
  reason: string;
  /** link → navigate; draft → create pending reorder; followup → WhatsApp + Done. */
  kind: 'link' | 'draft' | 'followup';
  actionLabel: string;
  href?: string;
  proposal?: ReorderProposal;
  waLink?: string;
  customerId?: string;
}



export default function DecisionsQueue() {
  const { alerts, cashflow, rfm, monthly, tier, currencySymbol } = useStore();
  const { profile } = useProfile();
  const sym = currencySymbol || 'K';
  const canAutomate = canAccess(tier, 'automation');

  // Live stock levels — the one signal the store doesn't carry. Same guarded
  // fetch as Simple home; a missing/unconfigured spine degrades to [].
  const [products, setProducts] = useState<Product[] | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try { const p = await listProducts(); if (alive) setProducts(p); }
      catch { if (alive) setProducts([]); }
    })();
    return () => { alive = false; };
  }, []);

  const [fuDismissed, setFuDismissed] = useState<Set<string>>(new Set());
  useEffect(() => { setFuDismissed(dismissedFollowUps()); }, []);
  const [draftState, setDraftState] = useState<Record<string, 'drafting' | 'done' | 'error'>>({});
  const [expanded, setExpanded] = useState(false);

  const decisions = useMemo<Decision[]>(() => {
    const out: Decision[] = [];
    const safeAlerts = Array.isArray(alerts) ? alerts : [];
    const safeMonthly = Array.isArray(monthly) ? monthly : [];

    // 1 · Cash runway — same bands the Cash page uses (crit <6mo, warn <12mo).
    const runway = Number(cashflow?.runway);
    if (Number.isFinite(runway) && runway > 0 && runway < 12) {
      out.push({
        id: 'runway',
        severity: runway < 6 ? 'crit' : 'warn',
        headline: `Cash runway is ${runway} month${runway === 1 ? '' : 's'}`,
        reason: runway < 6
          ? 'Below the 6-month line: decide what to cut or collect now.'
          : 'Under the 12-month comfort line: worth a plan this week.',
        kind: 'link', href: '/dashboard/cash', actionLabel: 'Review cash',
      });
    }

    // 2 · Critical anomaly/variance alerts.
    const crit = safeAlerts.filter(a => String(a.severity ?? '').toLowerCase() === 'critical');
    if (crit.length > 0) {
      out.push({
        id: 'alerts',
        severity: 'crit',
        headline: crit.length === 1 ? String(crit[0].title) : `${crit.length} critical alerts on your numbers`,
        reason: crit.length === 1
          ? String(crit[0].description || 'AIBOS spotted it breaking your usual pattern.')
          : crit.slice(0, 2).map(a => String(a.title)).join(' · '),
        kind: 'link', href: '/dashboard/anomaly', actionLabel: 'Review alerts',
      });
    }

    // 3 · Stock about to run out — one-tap draft (propose → confirm).
    for (const p of reorderProposals(products ?? []).slice(0, 2)) {
      out.push({
        id: `re-${p.productId}`,
        severity: 'warn',
        headline: `Stock low: ${p.item}`,
        reason: `${p.reason}${p.estimatedCost !== undefined ? ` · reorder ≈ ${fmt(p.estimatedCost, true, sym)}` : ''}`,
        kind: 'draft', proposal: p, href: '/dashboard/inventory',
        actionLabel: canAutomate ? 'Draft reorder' : 'Review stock',
      });
    }

    // 4 · Highest-value drifting customer (dismissals persist a week).
    const fu = followUpProposals(rfm, sym, profile?.business_name)
      .filter(f => !fuDismissed.has(f.customerId))[0];
    if (fu) {
      out.push({
        id: `fu-${fu.customerId}`,
        severity: 'warn',
        headline: fu.headline,
        reason: fu.reason,
        kind: 'followup', waLink: fu.waLink, customerId: fu.customerId,
        actionLabel: 'Send check-in',
      });
    }

    // 5 · Margin compression month-over-month (≥3 pts), only once three months
    // are recorded: a first tiny month made this swing by hundreds of points.
    if (safeMonthly.length >= 3) {
      const marginOf = (m: any) => {
        const rev = Number(m?.Revenue) || 0;
        return rev > 0 ? ((rev - (Number(m?.Costs) || 0)) / rev) * 100 : 0;
      };
      const delta = marginOf(safeMonthly[safeMonthly.length - 1]) - marginOf(safeMonthly[safeMonthly.length - 2]);
      if (delta <= -3) {
        out.push({
          id: 'margin',
          severity: 'warn',
          headline: `Your margin fell ${Math.abs(delta).toFixed(1)} points last month`,
          reason: 'Costs grew faster than sales. See which cost did it.',
          kind: 'link', href: '/dashboard/variance', actionLabel: 'See what changed',
        });
      }
    }

    // Critical first; order within a band already reflects each signal's own ranking.
    return out.sort((a, b) => (a.severity === 'crit' ? 0 : 1) - (b.severity === 'crit' ? 0 : 1));
  }, [alerts, cashflow, monthly, products, rfm, sym, profile?.business_name, fuDismissed, canAutomate]);

  const onDraft = useCallback(async (p: ReorderProposal) => {
    setDraftState(s => ({ ...s, [p.productId]: 'drafting' }));
    try {
      await draftReorder(p);
      setDraftState(s => ({ ...s, [p.productId]: 'done' }));
    } catch {
      setDraftState(s => ({ ...s, [p.productId]: 'error' }));
    }
  }, []);

  const onFollowUpDone = useCallback((customerId: string) => {
    dismissFollowUp(customerId);
    setFuDismissed(prev => new Set([...prev, customerId]));
  }, []);

  // First run with nothing loaded anywhere: stay silent rather than shout
  // "all clear" about a business AIBOS hasn't seen yet.
  const hasSignalSources =
    (Array.isArray(monthly) && monthly.length > 0) ||
    rfm.length > 0 ||
    (products?.length ?? 0) > 0 ||
    (Array.isArray(alerts) && alerts.length > 0) ||
    !!cashflow;
  if (!hasSignalSources) return null;

  const visible = expanded ? decisions : decisions.slice(0, 3);
  const hidden = decisions.length - visible.length;
  const critCount = decisions.filter(d => d.severity === 'crit').length;

  // Which part of the business a decision is about, for the card's tag.
  const areaOf = (d: (typeof decisions)[number]) =>
    d.kind === 'draft' ? 'Stock' : d.kind === 'followup' ? 'Customers'
      : d.href?.includes('/cash') ? 'Money' : d.href?.includes('/inventory') ? 'Stock'
      : d.href?.includes('/customers') || d.href?.includes('/churn') ? 'Customers' : 'Spending';
  const iconOf = (d: (typeof decisions)[number]) =>
    d.kind === 'draft' ? <Package /> : d.kind === 'followup' ? <MessageCircle />
      : d.href?.includes('/cash') ? <Wallet /> : d.severity === 'crit' ? <AlertTriangle /> : <Activity />;
  // Rows of three, then a pair or a single across the row, so no holes.
  const spanOf = (count: number, i: number) => {
    const full = count - (count % 3);
    if (i < full) return 'span-2';
    return count % 3 === 2 ? 'span-3' : 'span-6';
  };

  return (
    <section aria-labelledby="decide-title" className="bento-section" style={{ marginTop: 24, marginBottom: 24 }}>
      <header className="bento-section-head">
        <div>
          <p className="eyebrow">Today</p>
          <h2 id="decide-title" className="bento-section-title">
            {decisions.length === 0
              ? 'Nothing needs you right now'
              : `${decisions.length} thing${decisions.length === 1 ? '' : 's'} need${decisions.length === 1 ? 's' : ''} you`}
          </h2>
        </div>
        <p className="bento-section-sub">
          {decisions.length === 0
            ? 'Cash, stock, customers and spending are all inside their limits. The numbers below are the evidence.'
            : critCount > 0 ? `${critCount} of them cannot wait. Each has its answer one tap away.` : 'Each has its answer one tap away.'}
        </p>
      </header>

      {decisions.length > 0 && (
        <div className="bento-grid">
          {visible.map(d => {
            const st = d.proposal ? draftState[d.proposal.productId] : undefined;
            return (
              <BentoCard
                key={d.id}
                className={spanOf(visible.length, visible.indexOf(d))}
                icon={iconOf(d)}
                title={d.severity === 'crit' ? 'Cannot wait' : 'This week'}
                tag={areaOf(d)}
                motion={d.severity === 'crit' ? 'pulse' : 'float'}
                foot={
                  <>
                    {d.kind === 'link' && d.href && (
                      <Link href={d.href} className="pill">{d.actionLabel}</Link>
                    )}
                    {d.kind === 'draft' && d.proposal && (
                      canAutomate ? (
                        <button
                          type="button"
                          onClick={() => void onDraft(d.proposal!)}
                          disabled={st === 'drafting' || st === 'done'}
                          className={st === 'done' ? 'pill pill-quiet' : 'pill pill-primary'}
                        >
                          {st === 'drafting' ? 'Drafting…' : st === 'done' ? 'Drafted' : st === 'error' ? 'Try again' : d.actionLabel}
                        </button>
                      ) : (
                        <Link href={d.href!} className="pill">{d.actionLabel}</Link>
                      )
                    )}
                    {d.kind === 'followup' && d.waLink && d.customerId && (
                      <>
                        <a href={d.waLink} target="_blank" rel="noreferrer" className="pill">{d.actionLabel}</a>
                        <button
                          type="button"
                          onClick={() => onFollowUpDone(d.customerId!)}
                          aria-label={`Mark check-in with ${d.customerId} as done for this week`}
                          className="pill pill-quiet"
                        >
                          Done
                        </button>
                      </>
                    )}
                  </>
                }
              >
                <p style={{ margin: '8px 0 0', fontSize: 'var(--fs-body)', fontWeight: 600, lineHeight: 1.5, color: 'var(--text-1)' }}>{d.headline}</p>
                <p className="bento-text" style={{ marginTop: 4 }}>{d.reason}</p>
              </BentoCard>
            );
          })}
        </div>
      )}
      {hidden > 0 && (
        <button type="button" onClick={() => setExpanded(true)} className="pill pill-quiet" style={{ marginTop: 12 }}>
          Show {hidden} more
        </button>
      )}
    </section>
  );
}
