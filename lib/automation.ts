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
  return createEvent({
    event_type: 'InventoryReceipt',
    payload,
    source: 'manual',
    confidence: 0.9,
    status: 'pending',
    note: 'auto-proposed reorder — approved by owner, awaiting arrival',
  });
}
