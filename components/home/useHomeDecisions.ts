'use client';

// The home's own signals, worked out in the browser from what the store and
// the catalog already hold (they used to be the "Decisions" band and the
// "AIBOS prepared this" panel, 17 Nov 2026 cleanup): cash running short,
// critical alerts, stock to reorder, a regular gone quiet, a margin that fell,
// and the top piece of advice. They now feed the one "Needs you" list beside
// the workers' questions, so the owner has one place to look.
//
// Second pass the same day (the UX audit): entries waiting to be confirmed,
// overdue invoices and a cash watch risk joined the list. Before, Home showed
// each of them somewhere else while "Needs you" said nothing needed the
// owner. When a worker already asks about the same thing (the Bookkeeper's
// confirm_entry, the Collector's chase_payment) the worker's job stands for
// it and this signal stays out (`coveredBy`).
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
import { useMoney } from '@/hooks/useMoney';
import { useBriefExtras } from '@/hooks/useBriefExtras';
import { useCashWatch } from '@/hooks/useCashWatch';
import { dayWords, floorWords } from '@/components/cashplan/PlanChart';
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
  /** A worker job of this kind, waiting, already asks about the same thing. */
  coveredBy?: string;
}

export function useHomeDecisions() {
  const { alerts, cashflow, rfm, monthly, tier, currencySymbol, twin } = useStore();
  const { profile } = useProfile();
  const sym = currencySymbol || 'K';
  const canAutomate = canAccess(tier, 'automation');
  // With the workers on, the Sales scout asks about regulars gone quiet.
  const workersOn = canAccess(tier, 'chat_actions');

  const money = useMoney(30);
  const extras = useBriefExtras();
  const watch = useCashWatch();

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

    // The 13-week watch: a real chance of running short.
    if (watch?.ok) {
      const short = Number(watch.chance_short_pct ?? 0);
      const atRisk = watch.preview ? !!watch.at_risk : short >= 20;
      if (atRisk) {
        const line = floorWords(watch.floor, watch.floor_from === 'cushion', watch.sym || sym);
        const when = watch.first_risk_date ? `First in the week of ${dayWords(watch.first_risk_date)}.` : 'In the next 13 weeks.';
        out.push({
          id: 'cash-watch', severity: short >= 50 ? 'crit' : 'warn', area: 'Money',
          headline: short >= 99.5 ? `Your money is heading below ${line}`
            : `A ${watch.chance_words ?? `${Math.round(short)}%`} chance your money goes below ${line}`,
          reason: `${when} See what fixes it before it happens.`,
          kind: 'link', href: '/dashboard/cash-plan', actionLabel: 'See why',
        });
      }
    }

    // Recorded but not confirmed: in no figure until the owner says so.
    const waiting = money?.waiting.count ?? 0;
    if (waiting > 0) {
      out.push({
        id: 'waiting', severity: 'warn', area: 'Books', coveredBy: 'confirm_entry',
        headline: `${waiting} ${waiting === 1 ? 'entry is' : 'entries are'} waiting for you`,
        reason: 'Recorded but not counted in your money yet. Confirm or fix each one.',
        kind: 'link', href: '/dashboard/timeline?status=pending', actionLabel: 'Check them',
      });
    }

    // Invoices past their due date (the Invoices page's own rule).
    const overdue = extras?.overdueInvoices;
    if (overdue && overdue.count > 0) {
      // More overdue than the books say is owed: a sale missing from the books.
      const unbooked = overdue.total > (Number(twin?.receivables) || 0) + 0.005;
      out.push({
        id: 'overdue', severity: 'warn', area: 'Get paid', coveredBy: unbooked ? undefined : 'chase_payment',
        headline: `${overdue.count} invoice${overdue.count === 1 ? '' : 's'} overdue, ${fmt(overdue.total, false, sym)}`,
        reason: unbooked
          ? 'Its sale is not in your books, so Owed to you does not count it. The books check shows what to put right.'
          : 'Past the day you asked to be paid. A reminder now is the easiest way to get it in.',
        kind: 'link', href: unbooked ? '/dashboard/cash?check=1' : '/dashboard/invoices',
        actionLabel: unbooked ? 'Check the books' : 'See who owes',
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
  }, [alerts, cashflow, monthly, products, rfm, sym, profile?.business_name, fuDismissed, canAutomate, workersOn, advice, watch, money, extras, twin]);

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
