'use client';

// lib/aiAssistant.tsx — shared context for the AI CFO assistant.
//
// This provider owns ONE conversation that is shared between every surface that
// renders it: the floating launcher (glowing-ai-chat-assistant) and the embedded
// AI CFO panel on the dashboard (chat/AICFOChat) are the same assistant — ask in
// one, the history shows in the other.
//
// It also runs a GLOBAL long-press detector. Any element with a
// `data-ai-explain="<id>"` attribute becomes "explainable": press and hold it
// (~480ms) and the assistant opens and explains exactly that component from the
// pre-recorded knowledge base — no API call.

import React, {
  createContext, useContext, useState, useRef, useEffect, useCallback,
} from 'react';
import { useStore } from '@/lib/store';
import { useProfile } from '@/lib/profile';
import { fmt } from '@/lib/utils';
import { logUsage } from '@/lib/usage';
import { createClient } from '@/lib/supabase';
import {
  listProducts, listEvents, classifyActivity, createEvent, confirmEvent, voidEvent,
  type Product,
} from '@/lib/api';
import { canAccess } from '@/lib/tiers';
import { composeMorningBrief, bucketSales, expectedOf } from '@/lib/brief';
import { reorderProposals, followUpProposals } from '@/lib/automation';
import { industryOf } from '@/lib/industries';
import { matchBenchmark, referenceContext } from '@/lib/industryIntel';
import { isNetworkError } from '@/lib/outbox';
import { parseScenario, runScenario } from '@/lib/scenario';
import {
  localAnswer, getComponentDoc, renderExplanation, type LiveMetrics,
} from '@/lib/aiKnowledge';

export const MAX_CHARS = 2000;

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ExplainTarget {
  id: string;
  label?: string;
  value?: string;
  ts: number;
}

interface AiAssistantCtx {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
  // Shared conversation
  messages: ChatMessage[];
  loading: boolean;
  online: boolean;
  suggestions: string[];
  setSuggestions: (s: string[]) => void;
  sendMessage: (text: string) => void;
  pushAssistant: (content: string) => void;
  clearConversation: () => void;
}

const Ctx = createContext<AiAssistantCtx | null>(null);

export function useAiAssistant(): AiAssistantCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAiAssistant must be used within <AiAssistantProvider>');
  return ctx;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const API =
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : '/api/proxy';

/** Attach the Supabase JWT so the backend can verify the user (/chat is auth'd). */
async function authHeaders(): Promise<Record<string, string>> {
  try {
    const { data } = await createClient().auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

const nowTime = () =>
  new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

type StoreState = ReturnType<typeof useStore.getState>;

// Snapshot live metrics for the local answer engine (read non-reactively at
// send/explain time so the provider never re-renders on store changes).
function buildLiveMetrics(s: StoreState): LiveMetrics {
  const sym = s.currencySymbol || 'K';
  const hasFinancial = Array.isArray(s.monthly) && s.monthly.length > 0;
  const safeRfm = Array.isArray(s.rfm) ? s.rfm : [];
  const hasCustomer = s.hasEngine2Data || safeRfm.length > 0;
  const hasOps = s.hasEngine3Data || !!s.posGrandTotals;
  const money = (raw: number) => ({ raw, fmt: fmt(raw, true, sym) });
  const twin = s.twin;
  const twinActive = !!twin && (Number(twin.event_count) > 0 || Number(twin.cash) !== 0);
  return {
    currency: sym,
    hasFinancial, hasCustomer, hasOps,
    hasTwin: twinActive,
    eventCount: twin ? Number(twin.event_count) || 0 : undefined,
    cash: twinActive ? money(Number(twin!.cash) || 0) : undefined,
    inventoryValue: twinActive && Number(twin!.inventory_value) > 0 ? money(Number(twin!.inventory_value)) : undefined,
    receivables: twinActive && Number(twin!.receivables) > 0 ? money(Number(twin!.receivables)) : undefined,
    payables: twinActive && Number(twin!.payables) > 0 ? money(Number(twin!.payables)) : undefined,
    suppliersCount: twinActive ? Number(twin!.suppliers) || 0 : undefined,
    employeesCount: twinActive ? Number(twin!.employees) || 0 : undefined,
    revenue: hasFinancial ? money(s.kpi?.totalRevenue ?? 0) : undefined,
    costs: hasFinancial ? money(s.kpi?.totalCosts ?? 0) : undefined,
    profit: hasFinancial ? money(s.kpi?.totalProfit ?? 0) : undefined,
    margin: hasFinancial ? s.kpi?.avgMargin ?? 0 : undefined,
    healthScore: s.health?.score,
    healthLabel: s.health?.label,
    monthsCount: hasFinancial ? s.monthly.length : undefined,
    overallScore: s.intelligenceScores?.overall_score,
    overallLabel: s.intelligenceScores?.overall_label,
    e1Score: s.intelligenceScores?.e1_score,
    e2Score: s.intelligenceScores?.e2_score,
    e3Score: s.intelligenceScores?.e3_score,
    champions: hasCustomer ? safeRfm.filter((r) => r.segment === 'Champion').length : undefined,
    highChurn: hasCustomer ? safeRfm.filter((r) => (r.churn_risk ?? 0) >= 70).length : undefined,
    retentionRate: s.retention?.retention_rate,
    customersCount: hasCustomer ? (s.retention?.total_customers ?? safeRfm.length) : undefined,
    netRevenue: hasOps ? money(s.posGrandTotals?.net_revenue ?? s.posGrandTotals?.gross_revenue ?? 0) : undefined,
    drinkAttach: hasOps ? s.attachRates?.drink_attach_pct ?? 0 : undefined,
    benchmarksWarn: hasOps ? (Array.isArray(s.benchmarks) ? s.benchmarks.filter((b) => b.status !== 'good').length : 0) : undefined,
    productsCount: Array.isArray(s.breakdown) ? s.breakdown.length : undefined,
  };
}

// Full master context sent to the Grok backend on API fall-through.
function buildContext(
  s: StoreState, lv: LiveMetrics,
  biz?: { name?: string | null; type?: string | null; industry?: string | null; location?: string | null },
): Record<string, unknown> {
  const sym = s.currencySymbol || 'K';
  const ctx: Record<string, unknown> = {
    currency_symbol: sym,
    cabinet_id: s.cabinetId ?? undefined,
    has_data: lv.hasFinancial || lv.hasCustomer || lv.hasOps || lv.hasTwin,
    // Anti-fabrication contract for the model (trust is the product).
    guardrails: 'Only state numbers that appear in this context. If a figure is not provided, say you do not have it and that no data has been uploaded for it. Never estimate, assume, round-trip, or invent figures.',
  };
  // Who this business is — lets the model answer in the vertical's language
  // (a lodge's guests, a mine's offtakers) without inventing any numbers.
  if (biz && (biz.name || biz.type || biz.industry)) {
    ctx.business_profile = {
      name: biz.name || undefined,
      business_type: biz.type || undefined,
      industry: biz.industry || undefined,
      location: biz.location || undefined,
    };
    // Published reference ranges for this vertical (industryIntel.ts) — the
    // model may cite these as INDUSTRY REFERENCES, never as the user's data.
    const ind = industryOf(biz.type, biz.industry);
    const refs = referenceContext(ind.key);
    if (refs) {
      ctx.industry_reference = {
        industry: ind.label,
        note: 'Published industry reference ranges (mostly US/global studies; hotels: Southern Africa 2025). Cite as references only — never as the user\'s own figures.',
        ranges: refs,
      };
    }
  }
  // Digital Twin — live business state folded from recorded events.
  if (lv.hasTwin && s.twin) {
    ctx.business_state = {
      source: 'digital_twin — folded from events the user recorded',
      cash: s.twin.cash,
      receivables: s.twin.receivables,
      payables: s.twin.payables,
      inventory_value: s.twin.inventory_value,
      suppliers: s.twin.suppliers,
      employees: s.twin.employees,
      customers: s.twin.customers,
      event_count: s.twin.event_count,
      health: s.twin.health_label,
    };
  }
  if (lv.hasFinancial) {
    ctx.pnl = {
      total_revenue: s.kpi?.totalRevenue ?? 0, total_costs: s.kpi?.totalCosts ?? 0,
      total_profit: s.kpi?.totalProfit ?? 0, avg_margin: s.kpi?.avgMargin ?? 0,
    };
    ctx.health_score = s.health?.score ?? 0;
    ctx.health_label = s.health?.label ?? '';
    ctx.monthly = (Array.isArray(s.monthly) ? s.monthly : []).slice(0, 24);
  }
  if (Array.isArray(s.alerts) && s.alerts.length) ctx.alerts = s.alerts;
  if (lv.hasCustomer) {
    const safeRfm = Array.isArray(s.rfm) ? s.rfm : [];
    ctx.customer = {
      total_customers: s.retention?.total_customers ?? safeRfm.length,
      champions: lv.champions, high_churn: lv.highChurn,
      retention_rate: s.retention?.retention_rate ?? 0,
      segments: Array.isArray(s.segments) ? s.segments : [],
      clv_tiers: Array.isArray(s.clvTiers) ? s.clvTiers : [],
    };
  }
  if (lv.hasOps) {
    ctx.operations = {
      business_name: s.posBusinessName || undefined, period: s.posPeriod || undefined,
      grand_totals: s.posGrandTotals ?? undefined,
      categories: (Array.isArray(s.categories) ? s.categories : []).slice(0, 12),
      top_items: (Array.isArray(s.topItems) ? s.topItems : []).slice(0, 10),
      benchmarks: Array.isArray(s.benchmarks) ? s.benchmarks : [],
      attach_rates: s.attachRates ?? undefined,
    };
  }
  if (Array.isArray(s.breakdown) && s.breakdown.length) ctx.item_breakdown = s.breakdown.slice(0, 30);
  if (s.intelligenceScores || (Array.isArray(s.crossInsights) && s.crossInsights.length) || s.unifiedBrief) {
    ctx.intelligence = {
      scores: s.intelligenceScores ?? undefined,
      cross_insights: (Array.isArray(s.crossInsights) ? s.crossInsights : []).slice(0, 5),
      unified_brief: s.unifiedBrief || undefined,
    };
  }
  return ctx;
}

// ── Spine intents ─────────────────────────────────────────────────────────────
// Live business-state questions ("what's my current inventory?", "are my
// suppliers delivering today?", "how much did I make today?") are answered from
// the event spine with a real fetch. Every figure comes from recorded events —
// never from the model (SAFEGUARD §0.1: no fabricated numbers).

type SpineIntent = 'inventory' | 'deliveries' | 'today' | 'owed' | 'brief' | 'reorder' | 'followup';

function matchSpineIntent(raw: string): SpineIntent | null {
  const q = raw.toLowerCase();
  const selfRef = /\b(my|our|i|we)\b/.test(q);
  // The Morning Brief — the owner's whole day in one answer (Pro+).
  if (/\b(morning|daily|today'?s)\s+brief\b|\bmy brief\b|\bhow('?s| is) (my |the )?business( doing| looking)?( today)?\b/.test(q)) return 'brief';
  // Anticipated work: what needs reordering (checked before the generic
  // inventory intent so "should I restock?" lands here).
  if (/\b(reorder|restock)\b|\bwhat should (i|we) (order|buy)\b|\bneed(s)? (to be )?order(ed|ing)?\b/.test(q)) return 'reorder';
  // Drifting customers worth a check-in.
  if (/\bfollow.?up\b|\bcheck in with\b|\bwin back\b|\bat.?risk customers?\b|\bwho('?s| is| are)? (drifting|leaving|at risk)\b|\bcustomers? (i|we) (might|could) lose\b/.test(q)) return 'followup';
  // Pure definitions ("what is inventory?") carry no self-reference and stay
  // with the glossary; anything anchored to *their* stock comes here.
  if (/\b(inventory|stock)\b/.test(q) && (selfRef || /\b(how much|how many|current|left|low|running)\b/.test(q))) return 'inventory';
  if (/\bdeliver(y|ies|ing|ed)?\b/.test(q) || (/\bsuppliers?\b/.test(q) && selfRef)) return 'deliveries';
  if (/\b(today|this morning|tonight|so far)\b/.test(q) && /\b(sale|sales|sold|sell|made|make|revenue|earn|earned|takings?|business|doing)\b/.test(q)) return 'today';
  if (/\bowes? (me|us)\b|\bowing (me|us)\b|\bwho (do i|do we) owe\b|\bwhat (do i|do we) owe\b/.test(q)) return 'owed';
  return null;
}

// ── Chat actions (Pro+) ───────────────────────────────────────────────────────
// "sold 3 bags of mealie meal for K450" typed in the chat becomes a PENDING
// spine event the owner confirms with one word. Propose → confirm, always —
// the assistant never posts to the books without an explicit yes.

const CHAT_CONFIRM = /^(confirm|yes|yebo|yep|ok(ay)?|post it|do it)\b/i;
const CHAT_CANCEL = /^(cancel|no|discard|void|scrap|don'?t)\b/i;

function looksLikeTransaction(raw: string): boolean {
  const q = raw.trim().toLowerCase();
  if (/^(record|log)\b/.test(q)) return true;
  // Transaction verbs need a number to be actionable ("sold out" is not a sale).
  return /^(sold|paid|bought|spent|received|expecting|banked|invoiced|collected)\b/.test(q) && /\d/.test(q);
}

async function answerSpineIntent(intent: SpineIntent, s: StoreState, lv: LiveMetrics): Promise<string | null> {
  const sym = s.currencySymbol || 'K';
  const money = (n: number) => fmt(n, true, sym);

  if (intent === 'brief') {
    if (!canAccess(s.tier, 'morning_brief')) {
      return 'The **Morning Brief** — your cash, sales, stock and expected deliveries summarised every morning, with one clear thing to do next — is a **Pro+** feature.\n\n[Upgrade to Pro+](/checkout?plan=proplus) and your day starts ready before you ask.';
    }
    const [p, sales, receipts] = await Promise.allSettled([
      listProducts(),
      listEvents({ event_type: 'Sale', limit: 300 }),
      listEvents({ event_type: 'InventoryReceipt', status: 'pending', limit: 50 }),
    ]);
    const { today, yesterday } = bucketSales(sales.status === 'fulfilled' ? sales.value : []);
    return composeMorningBrief({
      sym,
      twin: s.twin,
      products: p.status === 'fulfilled' ? p.value : [],
      salesToday: today,
      salesYesterday: yesterday,
      expectedDeliveries: expectedOf(receipts.status === 'fulfilled' ? receipts.value : []),
      topFollowUp: followUpProposals(s.rfm, sym, null)[0]?.headline ?? null,
    });
  }

  if (intent === 'owed') {
    if (!lv.hasTwin) return null; // no recorded events → let the honest no-data path handle it
    const r = Number(s.twin?.receivables) || 0;
    const p = Number(s.twin?.payables) || 0;
    return [
      r > 0 ? `Customers owe you **${money(r)}**.` : 'No customer currently owes you anything on record.',
      p > 0 ? `You owe suppliers **${money(p)}**.` : 'You have no recorded supplier debts.',
      '\nThis comes from the events you\'ve recorded — log credit sales and supplier invoices as they happen and this stays exact.',
    ].join(' ');
  }

  if (intent === 'followup') {
    if (!s.rfm.length) {
      return "I can't see your customers yet — upload a customer or sales file on the **Customers** page and I'll spot who's drifting and draft the check-ins for you.";
    }
    const fus = followUpProposals(s.rfm, sym, null);
    if (!fus.length) {
      return '✅ Nobody valuable is drifting right now. I watch churn risk as your customer data updates — when someone worth keeping goes quiet, you\'ll see them here.';
    }
    const lines = [`**${fus.length} customer${fus.length === 1 ? '' : 's'} worth a check-in:**`];
    for (const f of fus) lines.push(`• ${f.headline} — ${f.reason}`);
    lines.push(canAccess(s.tier, 'automation')
      ? '\nI\'ve drafted the check-in messages on your **Home** page — one tap opens WhatsApp with the text ready to send.'
      : '\nOn **Pro+** I draft the WhatsApp check-in for each of them. [Upgrade to Pro+](/checkout?plan=proplus)');
    return lines.join('\n');
  }

  if (intent === 'reorder') {
    let products: Product[] = [];
    try { products = await listProducts(); } catch { products = []; }
    const props = reorderProposals(products);
    if (!props.length) {
      return products.length
        ? '✅ Nothing needs reordering — every tracked item is above its reorder level.'
        : "I can't suggest reorders yet — add your products (with reorder levels) on the **Stock** page and I'll watch them for you.";
    }
    const lines = [`**${props.length} item${props.length === 1 ? ' needs' : 's need'} reordering:**`];
    for (const p of props.slice(0, 5)) {
      lines.push(`• ${p.headline} — ${p.reason}${p.estimatedCost !== undefined ? ` (about ${money(p.estimatedCost)})` : ''}`);
    }
    lines.push(canAccess(s.tier, 'automation')
      ? '\nI\'ve prepared these as one-tap drafts on your **Home** page — tap Draft and confirm when the stock arrives.'
      : '\nOn **Pro+** I prepare these as one-tap drafts on your Home page. [Upgrade to Pro+](/checkout?plan=proplus)');
    return lines.join('\n');
  }

  if (intent === 'inventory') {
    let products: Product[] = [];
    try { products = await listProducts(); } catch { products = []; }
    const invValue = Number(s.twin?.inventory_value) || 0;
    if (!products.length) {
      if (invValue > 0) {
        return `Your stock on hand is worth **${money(invValue)}**, based on your recorded events.\n\nAdd your products on the **Stock** page and I'll track item-by-item levels — what's running low, what's overstocked, what to reorder.`;
      }
      return "You haven't added any stock yet, so there's nothing to count — and I won't guess.\n\nOpen **Stock** to add your products, or record a delivery on **Record** (e.g. “received 50 bags of sugar at K85 each”). From then on I can tell you exactly what's on hand and what's running low.";
    }
    const low = products.filter((p) => Number(p.reorder_level) > 0 && Number(p.on_hand ?? 0) <= Number(p.reorder_level));
    const lines: string[] = [];
    lines.push(`You have **${products.length} product${products.length === 1 ? '' : 's'}** in your catalog${invValue > 0 ? `, and your stock on hand is worth **${money(invValue)}**` : ''}.`);
    if (low.length) {
      lines.push(`\n⚠️ **${low.length} ${low.length === 1 ? 'item is' : 'items are'} at or below reorder level:**`);
      for (const p of low.slice(0, 6)) {
        lines.push(`• ${p.name} — ${Number(p.on_hand ?? 0)} ${p.unit || 'units'} left (reorder at ${Number(p.reorder_level)})`);
      }
      if (low.length > 6) lines.push(`…and ${low.length - 6} more on the **Stock** page.`);
    } else {
      lines.push('\n✅ Nothing is below its reorder level right now.');
    }
    return lines.join('\n');
  }

  if (intent === 'deliveries') {
    const [pending, recent] = await Promise.allSettled([
      listEvents({ event_type: 'InventoryReceipt', status: 'pending', limit: 50 }),
      listEvents({ event_type: 'InventoryReceipt', limit: 5 }),
    ]);
    const expected = expectedOf(pending.status === 'fulfilled' ? pending.value : []);
    const suppliers = Number(s.twin?.suppliers) || 0;
    const lines: string[] = [];

    if (expected.length > 0) {
      const startTomorrow = new Date(); startTomorrow.setHours(24, 0, 0, 0);
      const dueToday = expected.filter((e) => new Date(e.occurred_at) < startTomorrow);
      if (dueToday.length > 0) {
        lines.push(`🚚 **Yes — ${dueToday.length === 1 ? 'one delivery is' : `${dueToday.length} deliveries are`} expected today:**`);
        for (const e of dueToday.slice(0, 5)) {
          const from = e.payload?.supplier ? ` from ${String(e.payload.supplier)}` : '';
          const amt = Number(e.payload?.amount) || 0;
          lines.push(`• ${String(e.payload?.item ?? 'Stock')}${from}${amt > 0 ? ` — ${money(amt)}` : ''}`);
        }
        lines.push('\nWhen it arrives, confirm it on **Activity** (or just tell me) and your stock and payables update instantly.');
      } else {
        const next = expected[0];
        const when = new Date(next.occurred_at).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
        lines.push(`Nothing due today. Your next expected delivery is **${when}**${next.payload?.supplier ? ` from ${String(next.payload.supplier)}` : ''}.`);
      }
      return lines.join('\n');
    }

    lines.push('No deliveries are expected today — nothing is tracked as on the way.');
    const last = (recent.status === 'fulfilled' ? recent.value : []).find((e) => e.status === 'confirmed');
    if (last) {
      const when = new Date(last.occurred_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
      const from = last.payload?.supplier ? ` from ${String(last.payload.supplier)}` : '';
      lines.push(`Your last stock delivery arrived **${when}**${from}.`);
    }
    if (suppliers > 0) lines.push(`You have **${suppliers} supplier${suppliers === 1 ? '' : 's'}** on file.`);
    lines.push('\nExpecting stock? Tell me — “expecting 50kg sugar from Kasama Traders, K900” — and I\'ll track it until it arrives.');
    return lines.join('\n');
  }

  // intent === 'today' — sum today's confirmed sales from the spine.
  let sales: Awaited<ReturnType<typeof listEvents>> = [];
  try { sales = await listEvents({ event_type: 'Sale', limit: 200 }); } catch { return null; }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todays = sales.filter((e) => e.status !== 'void' && new Date(e.occurred_at) >= today);
  if (!todays.length) {
    return "No sales recorded yet today. If you've made sales, tell me on **Record** — “sold 3 crates of drinks for K360” — and I'll keep today's total live for you.";
  }
  const total = todays.reduce((sum, e) => sum + (Number(e.payload?.amount) || 0), 0);
  return `So far today you've recorded **${todays.length} sale${todays.length === 1 ? '' : 's'}** totalling **${money(total)}**.${lv.cash ? `\n\nYour cash right now is **${lv.cash.fmt}**.` : ''}`;
}

const HOLD_MS = 480;
const MOVE_CANCEL = 12;

export function AiAssistantProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpenState] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState(true);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [explainTarget, setExplainTarget] = useState<ExplainTarget | null>(null);

  const loadingRef = useRef(false);
  useEffect(() => { loadingRef.current = loading; }, [loading]);

  // Business identity for the model context — read through a ref so sendMessage
  // stays referentially stable (this provider never re-renders per keystroke).
  const { profile } = useProfile();
  const profileRef = useRef(profile);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  // A chat-drafted spine event awaiting the owner's "confirm"/"cancel".
  const pendingChatEventRef = useRef<{ id: string; summary: string } | null>(null);

  const setOpen = useCallback((v: boolean) => setOpenState(v), []);
  const toggle = useCallback(() => setOpenState((v) => !v), []);
  const clearConversation = useCallback(() => { setMessages([]); setSuggestions([]); }, []);

  const pushAssistant = useCallback((content: string) => {
    setMessages((p) => [...p, { id: `a-${Date.now()}-${p.length}`, role: 'assistant', content, timestamp: nowTime() }]);
  }, []);

  /**
   * Streamed answer (audit #21). POSTs to /chat/stream and appends each token
   * to a live assistant bubble as it arrives. Returns true when it handled the
   * turn (streamed an answer, or showed the upgrade gate); false/throws to let
   * the caller fall back to the buffered /chat.
   */
  const streamChat = useCallback(async (payload: string): Promise<boolean> => {
    const res = await fetch(`${API}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: payload,
    });

    // 402 = tier gate. Raised before the stream opens, so it's plain JSON.
    if (res.status === 402) {
      const d = await res.json().catch(() => ({} as Record<string, unknown>));
      setOnline(true);
      pushAssistant(`${typeof d.detail === 'string' ? d.detail : 'The AI CFO chat is a Pro feature.'}\n\n[Upgrade to Pro](/checkout?plan=pro) to chat with your AI CFO.`);
      return true;
    }
    const ct = res.headers.get('content-type') ?? '';
    if (!res.ok || !ct.includes('text/event-stream') || !res.body) return false;

    const id = `a-${Date.now()}-stream`;
    setMessages((p) => [...p, { id, role: 'assistant', content: '', timestamp: nowTime() }]);
    const append = (chunk: string) =>
      setMessages((p) => p.map((m) => (m.id === id ? { ...m, content: m.content + chunk } : m)));

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let got = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      // SSE frames are separated by a blank line; keep any partial tail.
      const frames = buf.split('\n\n');
      buf = frames.pop() ?? '';
      for (const frame of frames) {
        const line = frame.trim();
        if (!line.startsWith('data:')) continue;
        try {
          const msg = JSON.parse(line.slice(5).trim()) as { t?: string; tool?: string; error?: string; done?: boolean };
          if (msg.t) { append(msg.t); got = true; setLoading(false); }
          else if (msg.error) { append(`\n\n${msg.error}`); got = true; }
        } catch { /* ignore a malformed frame rather than kill the answer */ }
      }
    }
    if (!got) {
      // Nothing came through — drop the empty bubble and let the caller retry
      // on the buffered path rather than leaving a blank message.
      setMessages((p) => p.filter((m) => m.id !== id));
      return false;
    }
    setOnline(true);
    return true;
  }, [pushAssistant]);

  const sendMessage = useCallback(async (raw: string) => {
    const text = raw.trim().slice(0, MAX_CHARS);
    if (!text || loadingRef.current) return;

    setMessages((p) => [...p, { id: `u-${Date.now()}`, role: 'user', content: text, timestamp: nowTime() }]);
    setSuggestions([]);

    const s = useStore.getState();
    const lv = buildLiveMetrics(s);
    const sym = s.currencySymbol || 'K';

    // 0) A drafted event is waiting on the owner's word — one word settles it.
    const draft = pendingChatEventRef.current;
    if (draft && CHAT_CONFIRM.test(text)) {
      pendingChatEventRef.current = null;
      setLoading(true);
      try {
        await confirmEvent(draft.id);
        await useStore.getState().refreshTwin();
        const cashNow = useStore.getState().twin?.cash;
        pushAssistant(`✅ Recorded — ${draft.summary}.${typeof cashNow === 'number' ? ` Cash is now **${fmt(Number(cashNow), true, sym)}**.` : ''}`);
      } catch (err) {
        pushAssistant(`I couldn't post it: ${(err as Error).message}. It's saved as pending — you can confirm it on the **Activity** page.`);
      } finally {
        setLoading(false);
      }
      return;
    }
    if (draft && CHAT_CANCEL.test(text)) {
      pendingChatEventRef.current = null;
      setLoading(true);
      try {
        await voidEvent(draft.id);
        pushAssistant('Discarded — nothing was recorded.');
      } catch {
        pushAssistant("I couldn't discard it here — you can void it on the **Activity** page.");
      } finally {
        setLoading(false);
      }
      return;
    }
    if (draft) pendingChatEventRef.current = null; // moved on — draft stays pending on Activity

    // 0b) A transaction typed straight into the chat (Pro+): draft it as a
    //     PENDING event and wait for the owner's confirm. Never auto-post.
    if (looksLikeTransaction(text)) {
      if (!canAccess(s.tier, 'chat_actions')) {
        pushAssistant('Recording straight from the chat is a **Pro+** feature — type it once, say “confirm”, done.\n\nFor now the **Record** page does the same job, or [upgrade to Pro+](/checkout?plan=proplus) and never leave this window.');
        setSuggestions(['How do I record a sale?']);
        return;
      }
      setLoading(true);
      try {
        const cleaned = text.replace(/^(record|log)\b[:,]?\s*/i, '');
        const proposal = await classifyActivity(cleaned);
        if (!proposal?.event_type) {
          pushAssistant("I couldn't work out what kind of activity that is. Try phrasing it like “sold 3 bags of mealie meal for K450” — or use the **Record** page, which previews everything first.");
          return;
        }
        const ev = await createEvent({
          event_type: proposal.event_type,
          payload: proposal.payload,
          source: 'manual',
          confidence: proposal.confidence,
          status: 'pending',
          note: 'drafted via chat',
        });
        logUsage('event_recorded', { meta: { event_type: proposal.event_type, via: 'chat' } });
        const amt = Number(proposal.payload?.amount) || 0;
        const who = proposal.payload?.customer ?? proposal.payload?.supplier ?? proposal.payload?.item ?? proposal.payload?.category;
        const summary = `**${proposal.event_type}**${who ? ` · ${String(who)}` : ''}${amt > 0 ? ` — ${fmt(amt, true, sym)}` : ''}`;
        pendingChatEventRef.current = { id: ev.id, summary };
        pushAssistant(`Here's what I'll record:\n\n${summary}\n\nSay **confirm** to post it to your books, or **cancel** to discard it.`);
        setSuggestions(['Confirm', 'Cancel']);
      } catch (err) {
        if (isNetworkError(err)) {
          pushAssistant("You're offline right now, so I can't classify that from here. The **Record** page still works — anything you save there is kept on your device and posts automatically when signal returns.");
        } else {
          pushAssistant(`I couldn't draft that (${(err as Error).message}). The **Record** page will walk you through it instead.`);
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    // 1) Spine intents — live business-state questions answered from recorded
    //    events with a real fetch (stock levels, deliveries, today's takings).
    const intent = matchSpineIntent(text);
    if (intent) {
      setLoading(true);
      try {
        const answer = await answerSpineIntent(intent, s, lv);
        if (answer) { pushAssistant(answer); return; }
      } catch { /* fall through to the normal flow */ } finally {
        setLoading(false);
      }
    }

    // 1b) Benchmark questions — "is my margin good?", "what's a good food
    //     cost?" — answered from the industry intelligence pack, with the
    //     owner's REAL figure alongside the published reference range. Runs
    //     before the glossary so "what's a good food cost" doesn't get a
    //     generic "costs" definition instead.
    {
      const p = profileRef.current;
      const ind = industryOf(p?.business_type, p?.industry);
      const bm = matchBenchmark(text, ind.key);
      if (bm) {
        const lines = [`**${bm.label} — ${ind.label} reference:** ${bm.range}.`, '', bm.explain];
        if (bm.metric === 'margin' && lv.margin !== undefined) {
          let verdict = '';
          if (bm.loPct !== undefined && bm.hiPct !== undefined) {
            verdict = lv.margin > bm.hiPct
              ? ' — above the reference range. Strong.'
              : lv.margin < bm.loPct
                ? ' — below the reference range; your biggest cost lines are the place to look.'
                : ' — inside the reference range.';
          }
          lines.push('', `Your own net margin is **${lv.margin.toFixed(1)}%** (from your recorded data)${verdict}`);
        }
        lines.push('', '_Reference ranges come from published industry studies — orientation, not targets. Your own three-month trend beats any industry average._');
        pushAssistant(lines.join('\n'));
        return;
      }
    }

    // 1c) Scenario questions — "what if costs go up 20%?" — deterministic
    //     arithmetic on the owner's real monthly averages, assumptions stated
    //     out loud, ranged where the truth depends on cost behaviour.
    {
      const sc = parseScenario(text);
      if (sc) {
        pushAssistant(runScenario(sc, s.monthly, sym));
        return;
      }
    }

    // 2) Local answer — definitions, explanations, direct metric lookups.
    const local = localAnswer(text, lv);
    if (local) { pushAssistant(local); return; }

    // 3) No data yet (no upload AND no recorded events) → DO NOT call the
    //    model. With an empty context it will happily invent the user's
    //    figures, which is exactly the trust failure we must never ship.
    if (!lv.hasFinancial && !lv.hasCustomer && !lv.hasOps && !lv.hasTwin) {
      pushAssistant("I don't have any of your business data yet, so I can't give you real figures — and I won't make them up.\n\nThe quickest start: open **Record** and tell me what happened today (“sold 3 crates of drinks for K360”). Or upload a CSV/Excel file on the **Overview** page. Until then I can still explain any metric or term — try \"Explain net margin\".");
      setSuggestions(['How do I record a sale?', 'Explain net margin', 'How do I upload data?']);
      return;
    }

    // 3) Open-ended reasoning → the AI CFO backend with full master context.
    //    Streamed (audit #21): the answer types out as the model writes it.
    //    Any streaming failure falls back to the buffered /chat below, so the
    //    chat can never be worse than it was before streaming existed.
    setLoading(true);
    logUsage('chat');
    const payload = JSON.stringify({
      message: text,
      context: buildContext(s, lv, {
        name: profileRef.current?.business_name,
        type: profileRef.current?.business_type,
        industry: profileRef.current?.industry,
        location: profileRef.current?.location,
      }),
    });

    try {
      const streamed = await streamChat(payload);
      if (streamed) { setLoading(false); return; }   // handled (answer or gate)
    } catch {
      /* fall through to the buffered path */
    }

    try {
      const res = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: payload,
      });
      const body = await res.text();
      let data: Record<string, unknown> = {};
      try { data = body ? JSON.parse(body) : {}; } catch {
        const snippet = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
        throw new Error(res.ok ? `Non-JSON response. ${snippet}` : `Server error ${res.status}. ${snippet || 'The AI service may be offline.'}`);
      }
      // 402 = tier gate. The AI CFO chat is Pro+ — show a clean upgrade nudge,
      // not an error, and stop (this isn't a service failure).
      if (res.status === 402) {
        setOnline(true);
        const msg = typeof data.detail === 'string'
          ? data.detail
          : 'The AI CFO chat is a Pro feature.';
        pushAssistant(`${msg}\n\n[Upgrade to Pro](/checkout?plan=pro) to chat with your AI CFO.`);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : `HTTP ${res.status}`);
      setOnline(true);
      pushAssistant((data.reply as string) ?? (data.response as string) ?? 'No response received.');
    } catch (err) {
      setOnline(false);
      pushAssistant(`Sorry, I hit an error reaching the AI service: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [pushAssistant, streamChat]);

  // ── Long-press explanation → answer instantly from the knowledge base ──────
  useEffect(() => {
    if (!explainTarget) return;
    const s = useStore.getState();
    const lv = buildLiveMetrics(s);
    const doc = getComponentDoc(explainTarget.id);
    if (doc) {
      pushAssistant(renderExplanation(doc, lv));
      setSuggestions(doc.followups ?? []);
    } else {
      const label = explainTarget.label || 'this component';
      const valueLine = explainTarget.value ? `\n\n📊 It currently shows ${explainTarget.value}.` : '';
      pushAssistant(`**${label}**\n\nThis is part of your AIBOS dashboard. Ask me what you'd like to know about it and I'll pull the detail from your data.${valueLine}`);
      setSuggestions([]);
    }
    setOpenState(true);
    setExplainTarget(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [explainTarget]);

  // ── Global long-press detection ────────────────────────────────────────────
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const elRef = useRef<HTMLElement | null>(null);
  const firedRef = useRef(false);
  const restoreRef = useRef<{ boxShadow: string; transition: string; transform: string } | null>(null);

  useEffect(() => {
    const cancelHold = (didFire: boolean) => {
      if (timerRef.current !== null) { window.clearTimeout(timerRef.current); timerRef.current = null; }
      const el = elRef.current;
      if (el && restoreRef.current) {
        el.style.boxShadow = restoreRef.current.boxShadow;
        el.style.transform = restoreRef.current.transform;
        window.setTimeout(() => { if (el) el.style.transition = restoreRef.current?.transition ?? ''; }, 180);
      }
      elRef.current = null;
      startRef.current = null;
      restoreRef.current = null;
      if (!didFire) firedRef.current = false;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const target = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-ai-explain]');
      if (!target) return;

      firedRef.current = false;
      elRef.current = target;
      startRef.current = { x: e.clientX, y: e.clientY };
      restoreRef.current = {
        boxShadow: target.style.boxShadow,
        transition: target.style.transition,
        transform: target.style.transform,
      };
      target.style.transition = `box-shadow ${HOLD_MS}ms ease-out, transform ${HOLD_MS}ms ease-out`;
      target.style.boxShadow = '0 0 0 2px var(--cyan), 0 0 28px color-mix(in srgb, var(--cyan) 45%, transparent)';
      target.style.transform = 'scale(0.985)';

      timerRef.current = window.setTimeout(() => {
        firedRef.current = true;
        const id = target.getAttribute('data-ai-explain') || '';
        const label = target.getAttribute('data-ai-label') || undefined;
        const value = target.getAttribute('data-ai-value') || undefined;
        if (id) {
          setExplainTarget({ id, label, value, ts: Date.now() });
          try { navigator.vibrate?.(18); } catch { /* noop */ }
        }
        cancelHold(true);
      }, HOLD_MS);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!startRef.current) return;
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      if (dx * dx + dy * dy > MOVE_CANCEL * MOVE_CANCEL) cancelHold(false);
    };
    const onPointerUp = () => { if (timerRef.current !== null) cancelHold(false); };
    const onClickCapture = (e: MouseEvent) => {
      if (firedRef.current) { e.preventDefault(); e.stopPropagation(); firedRef.current = false; }
    };
    const onContextMenu = (e: MouseEvent) => { if (elRef.current) e.preventDefault(); };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('pointercancel', onPointerUp, true);
    window.addEventListener('scroll', onPointerUp, true);
    document.addEventListener('click', onClickCapture, true);
    document.addEventListener('contextmenu', onContextMenu, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointermove', onPointerMove, true);
      document.removeEventListener('pointerup', onPointerUp, true);
      document.removeEventListener('pointercancel', onPointerUp, true);
      window.removeEventListener('scroll', onPointerUp, true);
      document.removeEventListener('click', onClickCapture, true);
      document.removeEventListener('contextmenu', onContextMenu, true);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <Ctx.Provider value={{
      open, setOpen, toggle,
      messages, loading, online, suggestions, setSuggestions,
      sendMessage, pushAssistant, clearConversation,
    }}>
      {children}
    </Ctx.Provider>
  );
}
