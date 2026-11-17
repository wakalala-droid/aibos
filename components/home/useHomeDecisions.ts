'use client';

// The home's own signals, worked out in the browser from what the store and
// the catalog already hold (they used to be the "Decisions" band and the
// "AIBOS prepared this" panel, 17 Nov 2026 cleanup): cash running short,
// critical alerts, stock to reorder, a regular gone quiet, a margin that fell,
// and the top piece of advice. They now feed the one "Needs you" list beside
// the workers' questions, so the owner has one place to look.
//
// Trust rules (SAFEGUARD §0.1): each signal comes from recorded data. With no
// data behind it, it is left out. Propose, then confirm: "Draft reorder"
// makes a PENDING receipt, a check-in is sent from the owner's own WhatsApp.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { useProfile } from '@/lib/profile';
import { canAccess } from '@/lib/tiers';
import { fmt } from '@/lib/utils';
import {
  getRecommendations, listProducts, setRecommendationStatus, type Product, type Recommendation,
} from '@/lib/api';
import {
  reorderProposals, draftReorder, followUpProposals, dismissedFollowUps, dismissFollowUp,
  type ReorderProposal,
} from '@/lib/automation';

export interface HomeDecision {
  id: string;
  /** 'crit' goes to the top of the list, before the workers' questions. */
  severity: 'crit' | 'warn';
  /** The small label over it, like a worker's name on a job. */
  area: string;
  headline: string;
  reason: string;
  kind: 'link' | 'draft' | 'followup' | 'advice';
  actionLabel: string;
  href?: string;
  proposal?: ReorderProposal;
  waLink?: string;
  customerId?: string;
  advice?: Recommendation;
}

export function useHomeDecisions() {
  const { alerts, cashflow, rfm, monthly, tier, currencySymbol } = useStore();
  const { profile } = useProfile();
  const sym = currencySymbol || 'K';
  const canAutomate = canAccess(tier, 'automation');
  // With the workers on, the Sales scout asks about regulars gone quiet.
  const workersOn = canAccess(tier, 'chat_actions');

  const [products, setProducts] = useState<Product[] | null>(null);
  const [advice, setAdvice] = useState<Recommendation[]>([]);
  useEffect(() => {
    let alive = true;
    listProducts().then((p) => { if (alive) setProducts(p); }).catch(() => { if (alive) setProducts([]); });
    getRecommendations().then((r) => { if (alive) setAdvice(r); }).catch(() => { /* home stands without it */ });
    return () => { alive = false; };
  }, []);

  const [fuDismissed, setFuDismissed] = useState<Set<string>>(new Set());
  useEffect(() => { setFuDismissed(dismissedFollowUps()); }, []);
  const [draftState, setDraftState] = useState<Record<string, 'drafting' | 'done' | 'error'>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const decisions = useMemo<HomeDecision[]>(() => {
    const out: HomeDecision[] = [];
    const safeAlerts = Array.isArray(alerts) ? alerts : [];
    const safeMonthly = Array.isArray(monthly) ? monthly : [];

    const runway = Number(cashflow?.runway);
    if (Number.isFinite(runway) && runway > 0 && runway < 12) {
      out.push({
        id: 'runway', severity: runway < 6 ? 'crit' : 'warn', area: 'Money',
        headline: `Your cash lasts about ${runway} month${runway === 1 ? '' : 's'}`,
        reason: runway < 6
          ? 'Below six months. Decide what to cut or collect now.'
          : 'Under a year. Worth a plan this week.',
        kind: 'link', href: '/dashboard/cash', actionLabel: 'Look at cash',
      });
    }

    const crit = safeAlerts.filter((a) => String(a.severity ?? '').toLowerCase() === 'critical');
    if (crit.length > 0) {
      out.push({
        id: 'alerts', severity: 'crit', area: 'Spending',
        headline: crit.length === 1 ? String(crit[0].title) : `${crit.length} things broke your usual pattern`,
        reason: crit.length === 1
          ? String(crit[0].description || 'AIBOS spotted it breaking your usual pattern.')
          : crit.slice(0, 2).map((a) => String(a.title)).join(', '),
        kind: 'link', href: '/dashboard/anomaly', actionLabel: 'See what happened',
      });
    }

    for (const p of reorderProposals(products ?? []).slice(0, 2)) {
      out.push({
        id: `re-${p.productId}`, severity: 'warn', area: 'Stock',
        headline: `Running low: ${p.item}`,
        reason: `${p.reason}${p.estimatedCost !== undefined ? `. Reordering costs about ${fmt(p.estimatedCost, true, sym)}` : ''}`,
        kind: 'draft', proposal: p, href: '/dashboard/inventory',
        actionLabel: canAutomate ? 'Draft the reorder' : 'Look at stock',
      });
    }

    if (!workersOn) {
      const fu = followUpProposals(rfm, sym, profile?.business_name).filter((f) => !fuDismissed.has(f.customerId))[0];
      if (fu) {
        out.push({
          id: `fu-${fu.customerId}`, severity: 'warn', area: 'Customers',
          headline: fu.headline, reason: fu.reason,
          kind: 'followup', waLink: fu.waLink, customerId: fu.customerId, actionLabel: 'Send a check-in',
        });
      }
    }

    // Only once three months are recorded: a first tiny month swung this by hundreds of points.
    if (safeMonthly.length >= 3) {
      const marginOf = (m: any) => {
        const rev = Number(m?.Revenue) || 0;
        return rev > 0 ? ((rev - (Number(m?.Costs) || 0)) / rev) * 100 : 0;
      };
      const delta = marginOf(safeMonthly[safeMonthly.length - 1]) - marginOf(safeMonthly[safeMonthly.length - 2]);
      if (delta <= -3) {
        out.push({
          id: 'margin', severity: 'warn', area: 'Spending',
          headline: `Your margin fell ${Math.abs(delta).toFixed(1)} points last month`,
          reason: 'Costs grew faster than sales. See which cost did it.',
          kind: 'link', href: '/dashboard/variance', actionLabel: 'See what changed',
        });
      }
    }

    // The one piece of advice that matters most, never one already answered.
    const top = advice.find((r) => r.status !== 'dismissed' && r.status !== 'accepted' && r.priority !== 'low');
    if (top) {
      out.push({
        id: `ad-${top.rec_id ?? top.title}`, severity: 'warn', area: 'AIBOS suggests',
        headline: top.title, reason: top.rationale,
        kind: 'advice', advice: top, href: '/dashboard/brief?tab=advisor', actionLabel: 'I will try it',
      });
    }

    return out.sort((a, b) => (a.severity === 'crit' ? 0 : 1) - (b.severity === 'crit' ? 0 : 1));
  }, [alerts, cashflow, monthly, products, rfm, sym, profile?.business_name, fuDismissed, canAutomate, workersOn, advice]);

  const draft = useCallback(async (p: ReorderProposal) => {
    setDraftState((s) => ({ ...s, [p.productId]: 'drafting' }));
    try {
      await draftReorder(p);
      setDraftState((s) => ({ ...s, [p.productId]: 'done' }));
    } catch {
      setDraftState((s) => ({ ...s, [p.productId]: 'error' }));
    }
  }, []);

  const followUpDone = useCallback((customerId: string) => {
    dismissFollowUp(customerId);
    setFuDismissed((prev) => new Set([...prev, customerId]));
  }, []);

  const answerAdvice = useCallback(async (r: Recommendation, status: 'accepted' | 'dismissed') => {
    if (!r.rec_id) {
      setAdvice((prev) => prev.filter((x) => x !== r));
      return;
    }
    setBusy(r.rec_id);
    try {
      await setRecommendationStatus(r.rec_id, status);
      setAdvice((prev) => prev.map((x) => (x.rec_id === r.rec_id ? { ...x, status } : x)));
    } catch { /* it stays on the list to answer again */ }
    finally { setBusy(null); }
  }, []);

  return { decisions, draftState, draft, followUpDone, answerAdvice, busy, canAutomate };
}
