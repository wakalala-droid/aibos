// lib/automation.ts — the automation engine (Pro+ 'automation' gate).
//
// "Good software digitizes work. Great software automates work. Exceptional
// software anticipates work." This module is the anticipation layer: it looks
// at the live state AIBOS already holds and PREPARES the next piece of work as
// a proposal the owner approves with one tap.
//
// Design rules (Devil's-Advocate-approved):
// • Proposals are computed IN MEMORY — nothing touches the books until the
//   owner acts. No timeline spam, no auto-created drafts to clean up.
// • Propose → confirm, always (adaptive-function governance). Drafting creates
//   a PENDING InventoryReceipt; confirming it on arrival is the owner's call.
// • No fabricated figures: cost is quoted only when a real buy price exists.
// • Pure functions over shared types — any surface (Simple home, assistant,
//   future notifications) renders the same proposals. Shared service, not UI.

import type { Product } from './api';
import { createEvent, type BusinessEvent } from './api';
import { logUsage } from './usage';
import type { RfmRow } from './store';
import { fmt } from './utils';

export interface ReorderProposal {
  productId: string;
  /** What to order, in the owner's words: "Sugar — 16 kg from Kasama Traders". */
  headline: string;
  /** Why AIBOS is proposing it: "4 left, reorder level is 10". */
  reason: string;
  item: string;
  quantity: number;
  unit: string;
  supplier?: string;
  /** Estimated cost (quantity × buy price). Absent when no buy price is known. */
  estimatedCost?: number;
}

/**
 * Compute reorder proposals: every product at or below its reorder level,
 * with a suggested quantity that restores stock to 2× the reorder level —
 * enough to stop the alert re-firing the next morning, small enough that the
 * owner isn't committing serious capital on autopilot. The heuristic is shown
 * to the owner verbatim; nothing is hidden.
 */
export function reorderProposals(products: Product[]): ReorderProposal[] {
  const out: ReorderProposal[] = [];
  for (const p of products) {
    const reorderAt = Number(p.reorder_level) || 0;
    if (reorderAt <= 0) continue;                    // owner hasn't set a level — never guess one
    const onHand = Number(p.on_hand ?? 0);
    if (onHand > reorderAt) continue;
    const qty = Math.max(reorderAt * 2 - onHand, 1);
    const buy = Number(p.buy_price) || 0;
    out.push({
      productId: p.id,
      headline: `${p.name} — ${qty} ${p.unit || 'units'}${p.supplier ? ` from ${p.supplier}` : ''}`,
      reason: `${onHand} left, reorder level is ${reorderAt}`,
      item: p.name,
      quantity: qty,
      unit: p.unit || 'units',
      supplier: p.supplier || undefined,
      estimatedCost: buy > 0 ? qty * buy : undefined,
    });
  }
  // Most urgent first: smallest stock relative to its reorder level.
  return out.sort((a, b) => {
    const ra = Number(products.find((p) => p.id === a.productId)?.on_hand ?? 0);
    const rb = Number(products.find((p) => p.id === b.productId)?.on_hand ?? 0);
    return ra - rb;
  });
}

// ── Customer follow-ups (Engine 2 × automation) ──────────────────────────────
// The same anticipation pattern applied to people instead of stock: when a
// valuable customer is drifting (high churn risk from the RFM engine), AIBOS
// prepares the check-in — who, why, and a ready-to-send message. The owner
// sends it from their own WhatsApp in one tap; AIBOS never messages anyone
// itself (propose → confirm applies to relationships too).

export interface FollowUpProposal {
  customerId: string;
  /** "Mwansa — usually spends K1,200, quiet for 45 days". */
  headline: string;
  reason: string;
  /** Ready-to-edit message the owner sends from their own WhatsApp. */
  suggestedMessage: string;
  /** wa.me deep link with the message prefilled (no phone number required). */
  waLink: string;
  churnRisk: number;
}

/**
 * Top follow-ups: customers with high churn risk, ranked by what they're
 * worth. Capped at 3 — an owner can genuinely do three check-ins today;
 * a list of thirty is a report, not a plan (ux_intelligence.md decision
 * simplification).
 */
export function followUpProposals(
  rfm: RfmRow[],
  sym: string,
  businessName?: string | null,
): FollowUpProposal[] {
  const biz = businessName || 'us';
  return rfm
    .filter((r) => (Number(r.churn_risk) || 0) >= 70 && (Number(r.monetary) || 0) > 0)
    .sort((a, b) => (Number(b.monetary) || 0) - (Number(a.monetary) || 0))
    .slice(0, 3)
    .map((r) => {
      const name = String(r.customer_id);
      const spend = fmt(Number(r.monetary) || 0, true, sym);
      const days = Math.round(Number(r.recency_days) || 0);
      const msg = `Hi ${name}! It's been a while since your last visit to ${biz} — we'd love to see you again. Is there anything we could do better?`;
      return {
        customerId: name,
        headline: `${name} — usually spends ${spend}, quiet for ${days} day${days === 1 ? '' : 's'}`,
        reason: `${Math.round(Number(r.churn_risk) || 0)}% risk of not coming back${r.intervention ? ` · ${r.intervention}` : ''}`,
        suggestedMessage: msg,
        waLink: `https://wa.me/?text=${encodeURIComponent(msg)}`,
        churnRisk: Number(r.churn_risk) || 0,
      };
    });
}

// Local dismissals — "done" means done for a week, not forever: if the
// customer is still at risk next week, the proposal earns its place again.
const FU_KEY = 'aibos-fu-dismissed-v1';
const FU_TTL_DAYS = 7;

export function dismissedFollowUps(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const map = JSON.parse(window.localStorage.getItem(FU_KEY) || '{}') as Record<string, string>;
    const now = Date.now();
    const live = Object.entries(map).filter(
      ([, iso]) => now - new Date(iso).getTime() < FU_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
    if (live.length !== Object.keys(map).length) {
      window.localStorage.setItem(FU_KEY, JSON.stringify(Object.fromEntries(live)));
    }
    return new Set(live.map(([id]) => id));
  } catch {
    return new Set();
  }
}

export function dismissFollowUp(customerId: string): void {
  try {
    const map = JSON.parse(window.localStorage.getItem(FU_KEY) || '{}') as Record<string, string>;
    map[customerId] = new Date().toISOString();
    window.localStorage.setItem(FU_KEY, JSON.stringify(map));
  } catch { /* private mode — dismissal just won't persist */ }
}

/**
 * Turn an approved proposal into a PENDING InventoryReceipt — the same shape
 * an expected delivery has, so it immediately appears in "are my suppliers
 * delivering today?", the Morning Brief, and the Activity page, where the
 * owner confirms it when the stock physically arrives.
 */
export async function draftReorder(p: ReorderProposal): Promise<BusinessEvent> {
  const payload: Record<string, unknown> = {
    item: p.item,
    quantity: p.quantity,
    unit: p.unit,
  };
  if (p.supplier) payload.supplier = p.supplier;
  if (p.estimatedCost !== undefined) payload.amount = p.estimatedCost;
  const ev = await createEvent({
    event_type: 'InventoryReceipt',
    payload,
    source: 'manual',
    confidence: 0.9,
    status: 'pending',
    note: 'auto-proposed reorder — approved by owner, awaiting arrival',
  });
  logUsage('event_recorded', { meta: { event_type: 'InventoryReceipt', via: 'reorder_draft' } });
  return ev;
}
