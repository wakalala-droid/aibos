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
  authHeaders, ACTIVE_BUSINESS_KEY, ACTING_AS_KEY,
  type Product,
} from '@/lib/api';
import { canAccess } from '@/lib/tiers';
import { composeMorningBrief, bucketSales, expectedOf, deliveryName } from '@/lib/brief';
import { reorderProposals, followUpProposals } from '@/lib/automation';
import { industryOf } from '@/lib/industries';
import { matchBenchmark, referenceContext } from '@/lib/industryIntel';
import { isNetworkError } from '@/lib/outbox';
import { parseScenario, runScenario } from '@/lib/scenario';
import {
  localAnswer, asksForOwnFigures, getComponentDoc, renderExplanation, type LiveMetrics,
} from '@/lib/aiKnowledge';

export const MAX_CHARS = 2000;

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  /** Shown once, never remembered or sent back to the AI: a failure, an
   *  upgrade prompt, "the AI is resting". Remembering them would make the AI
   *  read its own error messages as part of the conversation. */
  ephemeral?: boolean;
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
  /** True for the whole of a turn, from the question until the answer is complete. */
  loading: boolean;
  /** What the assistant is doing right now ("Checking your bookings…"), or
   *  null once the answer itself is being written out. */
  status: string | null;
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

const IS_LOCAL = typeof window !== 'undefined' && window.location.hostname === 'localhost';
const API = IS_LOCAL ? 'http://localhost:8000' : '/api/proxy';

/*
  THE CHAT TALKS TO THE API DIRECTLY.

  Everything else goes through the website's relay (/api/proxy), and the
  website host stops any request there at 60 seconds. A question that needed
  a few lookups while the AI thought, or one asked while the API was waking
  up, ran past that and the owner saw the dots for a minute and then "504".
  Straight to the API there is no such limit.

  Some browsers and networks cannot reach the API directly (a blocking
  extension, a VPN, an ISP): the request neither connects nor fails for
  twenty seconds or more. The API now answers within a second of receiving a
  question, so no answer in DIRECT_CONNECT_MS means it never arrived: the relay
  is used instead, and for the rest of the visit the direct route is skipped.
*/
const DIRECT = (() => {
  const raw = (process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
  return !IS_LOCAL && /^https?:\/\//i.test(raw) ? raw : '';
})();
const DIRECT_CONNECT_MS = 12_000;
const DIRECT_OFF_KEY = 'aibos-chat-direct-off';

function directUsable(): boolean {
  if (!DIRECT) return false;
  try { return window.sessionStorage.getItem(DIRECT_OFF_KEY) !== '1'; } catch { return true; }
}

async function postChat(path: '/chat/stream' | '/chat', body: string, signal: AbortSignal,
                        connectMs?: number): Promise<Response> {
  // authHeaders from lib/api carries WHICH books: the active business and,
  // for invited staff, whose. The chat used to send the login only, so an
  // owner with two businesses and every invited member of staff were answered
  // from the wrong set of books.
  const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) };
  if (directUsable()) {
    const direct = new AbortController();
    const follow = () => direct.abort();
    signal.addEventListener('abort', follow);
    const timer = connectMs ? window.setTimeout(() => direct.abort(), connectMs) : null;
    try {
      // `follow` stays attached on success: when the caller gives up on the
      // answer, the direct request is closed with it.
      return await fetch(`${DIRECT}${path}`, { method: 'POST', headers, body, signal: direct.signal });
    } catch (err) {
      signal.removeEventListener('abort', follow);
      if (signal.aborted) throw err;
      try { window.sessionStorage.setItem(DIRECT_OFF_KEY, '1'); } catch { /* private mode */ }
    } finally {
      if (timer) window.clearTimeout(timer);
    }
  }
  return fetch(`${API}${path}`, { method: 'POST', headers, body, signal });
}

/** A request that gives up on its own after `ms`, so nobody waits on dots forever. */
function deadlineSignal(ms: number): { signal: AbortSignal; clear: () => void } {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, clear: () => window.clearTimeout(t) };
}

// Silence this long means the answer is not coming. The API sends a line
// every 8 seconds while it works, so only a dead connection is this quiet;
// the margin is for a busy phone or computer that reads the line late.
const STREAM_IDLE_MS = 90_000;
const BUFFERED_MS = 90_000;

/** Plain words for a failure. Never a raw status line or a host's error page. */
function failureText(status: number | null, raw = ''): string {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return "You're offline, so I can't reach the AI right now. Everything you record still saves on this device and posts when the signal returns.";
  }
  if (status === 504 || status === 408 || /TIMEOUT|timed? ?out|abort/i.test(raw)) {
    return 'That question took too long to answer, so I stopped waiting. Please ask it again. Your records are all safe.';
  }
  return "I couldn't reach the AI just now. Please ask again in a moment. Your records are all safe.";
}

/** What the assistant is doing while a lookup runs, in the owner's words. */
const TOOL_STATUS: Record<string, string> = {
  get_business_snapshot: 'Checking your cash and totals…',
  query_events: 'Looking through your records…',
  list_products: 'Checking your stock…',
  upcoming_schedule: 'Checking your diary…',
  list_invoices: 'Checking your invoices…',
  simulate_scenario: 'Working out the numbers…',
  cash_forecast: 'Working out your cash ahead…',
  who_owes_me: 'Checking who owes you…',
  investigate_month: 'Finding what changed…',
  customer_summary: 'Looking at your customers…',
};

const nowTime = () =>
  new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

// ── Memory ────────────────────────────────────────────────────────────────────
// The conversation is kept per person and per business: on this device at
// once (localStorage), and on the server for every other device (migration
// 0034; without it the device copy is the memory). The recent part of it goes
// with every question so the AI answers in context and nobody repeats
// themselves.

const CHAT_STORE = 'aibos-chat-v1';
const LOCAL_KEEP = 120;          // messages kept on this device
const MODEL_HISTORY = 29;        // earlier messages sent with a question (+ the question = 30)
const MODEL_HISTORY_CHARS = 4000;

async function chatScope(): Promise<string | null> {
  try {
    const { data } = await createClient().auth.getSession();
    const uid = data.session?.user?.id;
    if (!uid) return null;
    let biz = '';
    let actingAs = '';
    try {
      biz = window.localStorage.getItem(ACTIVE_BUSINESS_KEY) || '';
      actingAs = window.localStorage.getItem(ACTING_AS_KEY) || '';
    } catch { /* private mode */ }
    return `${CHAT_STORE}:${uid}:${actingAs || 'self'}:${biz || 'default'}`;
  } catch {
    return null;
  }
}

function readLocal(scope: string): ChatMessage[] {
  try {
    const raw = window.localStorage.getItem(scope);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list)
      ? list.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.id)
      : [];
  } catch {
    return [];
  }
}

function writeLocal(scope: string, messages: ChatMessage[]): void {
  try {
    const keep = messages.filter((m) => !m.ephemeral && m.content.trim()).slice(-LOCAL_KEEP);
    if (keep.length) window.localStorage.setItem(scope, JSON.stringify(keep));
    else window.localStorage.removeItem(scope);
  } catch { /* storage full or private mode: the server copy still stands */ }
}

function stampOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return d.toDateString() === new Date().toDateString()
    ? time
    : `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${time}`;
}

/** Earlier messages first, then anything already on screen that they lack. */
function mergeMessages(earlier: ChatMessage[], current: ChatMessage[]): ChatMessage[] {
  const seen = new Set(earlier.map((m) => m.id));
  return [...earlier, ...current.filter((m) => !seen.has(m.id))];
}

/** The conversation so far, as the AI is sent it with the next question. */
function historyForModel(messages: ChatMessage[]): { role: 'user' | 'assistant'; content: string }[] {
  return messages
    .filter((m) => !m.ephemeral && m.content.trim())
    .slice(-MODEL_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MODEL_HISTORY_CHARS) }));
}

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
        note: 'Published industry reference ranges (mostly US/global studies; hotels: Southern Africa 2025). Cite as references only, never as the user\'s own figures.',
        ranges: refs,
      };
    }
  }
  // Digital Twin — live business state folded from recorded events.
  if (lv.hasTwin && s.twin) {
    ctx.business_state = {
      source: 'digital_twin: folded from events the user recorded',
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
      return 'The **Morning Brief** is a **Pro+** feature: your cash, sales, stock and expected deliveries summed up every morning, with one clear thing to do next.\n\n[Upgrade to Pro+](/checkout?plan=proplus) and your day starts ready before you ask.';
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
      '\nThis comes from the events you\'ve recorded. Log credit sales and supplier invoices as they happen and this stays exact.',
    ].join(' ');
  }

  if (intent === 'followup') {
    if (!s.rfm.length) {
      return "I can't see your customers yet. Upload a customer or sales file on the **Customers** page and I'll spot who's drifting and draft the check-ins for you.";
    }
    const fus = followUpProposals(s.rfm, sym, null);
    if (!fus.length) {
      return '✅ Nobody valuable is drifting right now. I watch churn risk as your customer data updates. When someone worth keeping goes quiet, you\'ll see them here.';
    }
    const lines = [`**${fus.length} customer${fus.length === 1 ? '' : 's'} worth a check-in:**`];
    for (const f of fus) lines.push(`• ${f.headline}: ${f.reason}`);
    lines.push(canAccess(s.tier, 'automation')
      ? '\nI\'ve drafted the check-in messages on your **Home** page. One tap opens WhatsApp with the text ready to send.'
      : '\nOn **Pro+** I draft the WhatsApp check-in for each of them. [Upgrade to Pro+](/checkout?plan=proplus)');
    return lines.join('\n');
  }

  if (intent === 'reorder') {
    let products: Product[] = [];
    try { products = await listProducts(); } catch { products = []; }
    const props = reorderProposals(products);
    if (!props.length) {
      return products.length
        ? '✅ Nothing needs reordering. Every tracked item is above its reorder level.'
        : "I can't suggest reorders yet. Add your products (with reorder levels) on the **Stock** page and I'll watch them for you.";
    }
    const lines = [`**${props.length} item${props.length === 1 ? ' needs' : 's need'} reordering:**`];
    for (const p of props.slice(0, 5)) {
      lines.push(`• ${p.headline}: ${p.reason}${p.estimatedCost !== undefined ? ` (about ${money(p.estimatedCost)})` : ''}`);
    }
    lines.push(canAccess(s.tier, 'automation')
      ? '\nI\'ve prepared these as one-tap drafts on your **Home** page. Tap Draft and confirm when the stock arrives.'
      : '\nOn **Pro+** I prepare these as one-tap drafts on your Home page. [Upgrade to Pro+](/checkout?plan=proplus)');
    return lines.join('\n');
  }

  if (intent === 'inventory') {
    let products: Product[] = [];
    try { products = await listProducts(); } catch { products = []; }
    const invValue = Number(s.twin?.inventory_value) || 0;
    if (!products.length) {
      if (invValue > 0) {
        return `Your stock on hand is worth **${money(invValue)}**, based on your recorded events.\n\nAdd your products on the **Stock** page and I'll track item-by-item levels: what's running low, what's overstocked, what to reorder.`;
      }
      return "You haven't added any stock yet, so there's nothing to count, and I won't guess.\n\nOpen **Stock** to add your products, or record a delivery on **Record** (e.g. “received 50 bags of sugar at K85 each”). From then on I can tell you exactly what's on hand and what's running low.";
    }
    const low = products.filter((p) => Number(p.reorder_level) > 0 && Number(p.on_hand ?? 0) <= Number(p.reorder_level));
    const lines: string[] = [];
    lines.push(`You have **${products.length} product${products.length === 1 ? '' : 's'}** in your catalog${invValue > 0 ? `, and your stock on hand is worth **${money(invValue)}**` : ''}.`);
    if (low.length) {
      lines.push(`\n⚠️ **${low.length} ${low.length === 1 ? 'item is' : 'items are'} at or below reorder level:**`);
      for (const p of low.slice(0, 6)) {
        lines.push(`• ${p.name}: ${Number(p.on_hand ?? 0)} ${p.unit || 'units'} left (reorder at ${Number(p.reorder_level)})`);
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
        lines.push(`🚚 **Yes, ${dueToday.length === 1 ? 'one delivery is' : `${dueToday.length} deliveries are`} expected today:**`);
        for (const e of dueToday.slice(0, 5)) {
          const from = e.payload?.supplier ? ` from ${String(e.payload.supplier)}` : '';
          const amt = Number(e.payload?.amount) || 0;
          lines.push(`• ${deliveryName(e.payload, 'Stock')}${from}${amt > 0 ? `: ${money(amt)}` : ''}`);
        }
        lines.push('\nWhen it arrives, confirm it on **Activity** (or just tell me) and your stock and payables update instantly.');
      } else {
        const next = expected[0];
        const when = new Date(next.occurred_at).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
        lines.push(`Nothing due today. Your next expected delivery is **${when}**${next.payload?.supplier ? ` from ${String(next.payload.supplier)}` : ''}.`);
      }
      return lines.join('\n');
    }

    lines.push('No deliveries are expected today. Nothing is tracked as on the way.');
    const last = (recent.status === 'fulfilled' ? recent.value : []).find((e) => e.status === 'confirmed');
    if (last) {
      const when = new Date(last.occurred_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
      const from = last.payload?.supplier ? ` from ${String(last.payload.supplier)}` : '';
      lines.push(`Your last stock delivery arrived **${when}**${from}.`);
    }
    if (suppliers > 0) lines.push(`You have **${suppliers} supplier${suppliers === 1 ? '' : 's'}** on file.`);
    lines.push('\nExpecting stock? Tell me, like “expecting 50kg sugar from Kasama Traders, K900”, and I\'ll track it until it arrives.');
    return lines.join('\n');
  }

  // intent === 'today' — sum today's confirmed sales from the spine.
  let sales: Awaited<ReturnType<typeof listEvents>> = [];
  try { sales = await listEvents({ event_type: 'Sale', limit: 200 }); } catch { return null; }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todays = sales.filter((e) => e.status !== 'void' && new Date(e.occurred_at) >= today);
  if (!todays.length) {
    return "No sales recorded yet today. If you've made sales, tell me on **Record**, like “sold 3 crates of drinks for K360”, and I'll keep today's total live for you.";
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
  const [status, setStatus] = useState<string | null>(null);
  // True while an answer's words are arriving: the dots give way to the text.
  const [streaming, setStreaming] = useState(false);
  const [online, setOnline] = useState(true);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [explainTarget, setExplainTarget] = useState<ExplainTarget | null>(null);

  const loadingRef = useRef(false);
  useEffect(() => { loadingRef.current = loading; }, [loading]);
  // The conversation as it stands, readable at send time without making
  // sendMessage depend on (and re-create with) every new message.
  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Business identity for the model context — read through a ref so sendMessage
  // stays referentially stable (this provider never re-renders per keystroke).
  const { profile } = useProfile();
  const profileRef = useRef(profile);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  // A chat-drafted spine event awaiting the owner's "confirm"/"cancel".
  const pendingChatEventRef = useRef<{ id: string; summary: string } | null>(null);

  // ── Memory: load this person's conversation for this business ──────────────
  const scopeRef = useRef<string | null>(null);
  const savedIdsRef = useRef<Set<string>>(new Set());
  const serverMemoryRef = useRef(false);
  const [historyReady, setHistoryReady] = useState(false);
  const signedIn = !!profile;

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    (async () => {
      const scope = await chatScope();
      if (cancelled || !scope || scope === scopeRef.current) return;
      scopeRef.current = scope;
      savedIdsRef.current = new Set();
      // This device's copy, at once.
      const local = readLocal(scope);
      if (local.length) setMessages((p) => mergeMessages(local, p));
      // The saved conversation, from any device.
      try {
        const res = await fetch(`${API}/chat/history?limit=100`, { headers: await authHeaders() });
        const d = res.ok ? await res.json() : null;
        if (!cancelled && d?.available) {
          serverMemoryRef.current = true;
          const saved: ChatMessage[] = (Array.isArray(d.messages) ? d.messages : [])
            .filter((m: { role?: string; content?: string }) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
            .map((m: { id: string; client_id?: string | null; role: 'user' | 'assistant'; content: string; created_at: string }) => ({
              id: m.client_id || m.id, role: m.role, content: m.content, timestamp: stampOf(m.created_at),
            }));
          saved.forEach((m) => savedIdsRef.current.add(m.id));
          if (saved.length) setMessages((p) => mergeMessages(saved, p));
        }
      } catch { /* offline or the API asleep: the device copy is the memory */ }
      if (!cancelled) setHistoryReady(true);
    })();
    return () => { cancelled = true; };
  }, [signedIn]);

  // ── Memory: keep it, once each answer is complete ──────────────────────────
  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope || loading) return;          // mid-answer: wait for the whole of it
    writeLocal(scope, messages);
    if (!historyReady || !serverMemoryRef.current) return;
    const unsaved = messages.filter((m) => !m.ephemeral && m.content.trim() && !savedIdsRef.current.has(m.id));
    if (!unsaved.length) return;
    unsaved.forEach((m) => savedIdsRef.current.add(m.id));
    (async () => {
      try {
        const res = await fetch(`${API}/chat/history`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
          body: JSON.stringify({ messages: unsaved.map((m) => ({ role: m.role, content: m.content, client_id: m.id })) }),
        });
        const d = res.ok ? await res.json() : null;
        if (!d) throw new Error('not saved');
        if (d.available === false) serverMemoryRef.current = false;
      } catch {
        // Try again with the next message.
        unsaved.forEach((m) => savedIdsRef.current.delete(m.id));
      }
    })();
  }, [messages, loading, historyReady]);

  const setOpen = useCallback((v: boolean) => setOpenState(v), []);
  const toggle = useCallback(() => setOpenState((v) => !v), []);

  // The "Ask AIBOS" shortcut on the installed app's icon lands on ?ask=1: open
  // the assistant straight away, then tidy the address so a reload does not
  // open it again.
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('ask') === '1') {
        setOpenState(true);
        url.searchParams.delete('ask');
        window.history.replaceState(null, '', url.pathname + (url.search || '') + url.hash);
      }
    } catch { /* no window: nothing to do */ }
  }, []);
  const clearConversation = useCallback(() => {
    setMessages([]);
    setSuggestions([]);
    pendingChatEventRef.current = null;
    savedIdsRef.current = new Set();
    const scope = scopeRef.current;
    if (scope) { try { window.localStorage.removeItem(scope); } catch { /* private mode */ } }
    if (serverMemoryRef.current) {
      (async () => {
        try { await fetch(`${API}/chat/history`, { method: 'DELETE', headers: await authHeaders() }); }
        catch { /* the next load shows it again; nothing is lost */ }
      })();
    }
  }, []);

  const pushAssistant = useCallback((content: string, ephemeral = false) => {
    setMessages((p) => [...p, {
      id: `a-${Date.now()}-${p.length}`, role: 'assistant', content, timestamp: nowTime(),
      ...(ephemeral ? { ephemeral: true } : {}),
    }]);
  }, []);

  /**
   * Streamed answer (audit #21). POSTs to /chat/stream and writes each piece
   * into a live bubble as it arrives.
   *
   *   'answered' — the turn is dealt with (an answer, a gate, or a message
   *                saying why not); nothing more to do
   *   'retry'    — it failed quickly before a word; the buffered /chat may
   *                still answer
   *   'failed'   — it failed after a long wait; a second attempt would only
   *                make the owner wait as long again, so it has been said
   */
  const streamChat = useCallback(async (payload: string): Promise<'answered' | 'retry' | 'failed'> => {
    const ctrl = new AbortController();
    let idle = window.setTimeout(() => ctrl.abort(), STREAM_IDLE_MS);
    const alive = () => { window.clearTimeout(idle); idle = window.setTimeout(() => ctrl.abort(), STREAM_IDLE_MS); };
    const started = Date.now();
    const slow = () => Date.now() - started > 20_000;

    const bubble: { id: string | null } = { id: null };
    try {
      let res: Response;
      try {
        res = await postChat('/chat/stream', payload, ctrl.signal, DIRECT_CONNECT_MS);
      } catch (err) {
        if (ctrl.signal.aborted) { pushAssistant(failureText(504), true); setOnline(false); return 'failed'; }
        throw err;
      }
      alive();

      // 402 = tier gate. Raised before the stream opens, so it's plain JSON.
      if (res.status === 402) {
        const d = await res.json().catch(() => ({} as Record<string, unknown>));
        setOnline(true);
        pushAssistant(`${typeof d.detail === 'string' ? d.detail : 'The AI CFO chat is a Pro feature.'}\n\n[Upgrade to Pro](/checkout?plan=pro) to chat with your AI CFO.`, true);
        return 'answered';
      }
      // 503 = we could not establish the plan, no AI key, or the AI is
      // resting. Not a reason to sell an upgrade, and not worth a second
      // attempt down the buffered path: it will fail identically.
      if (res.status === 503) {
        const d = await res.json().catch(() => ({} as Record<string, unknown>));
        setOnline(true);
        pushAssistant(typeof d.detail === 'string' ? d.detail
          : 'The chat is unavailable right now. This is a fault on our side.', true);
        return 'answered';
      }
      const ct = res.headers.get('content-type') ?? '';
      if (!res.ok || !ct.includes('text/event-stream') || !res.body) {
        if (slow()) { pushAssistant(failureText(res.status), true); setOnline(false); return 'failed'; }
        return 'retry';
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      // The bubble appears with the first word, not before: an empty bubble
      // under the typing dots read as an answer that had stalled.
      const write = (chunk: string) => {
        if (!bubble.id) {
          const newId = `a-${Date.now()}-stream`;
          bubble.id = newId;
          setStreaming(true);
          setMessages((p) => [...p, { id: newId, role: 'assistant', content: chunk, timestamp: nowTime() }]);
        } else {
          const cur = bubble.id;
          setMessages((p) => p.map((m) => (m.id === cur ? { ...m, content: m.content + chunk } : m)));
        }
      };
      let stopped: string | null = null;
      // A refusal (no plan, no AI key, a bad request) now arrives as a frame,
      // because the API opens the answer before it checks anything.
      let gate: { code: number; detail: string } | null = null;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        alive();
        buf += decoder.decode(value, { stream: true });
        // SSE frames are separated by a blank line; keep any partial tail.
        const frames = buf.split('\n\n');
        buf = frames.pop() ?? '';
        for (const frame of frames) {
          const line = frame.trim();
          if (!line.startsWith('data:')) continue;        // ": still working" heartbeats
          try {
            const msg = JSON.parse(line.slice(5).trim()) as {
              t?: string; tool?: string; status?: string; error?: string; done?: boolean; retry?: boolean;
              gate?: number; detail?: unknown;
            };
            if (msg.gate) gate = { code: msg.gate, detail: typeof msg.detail === 'string' ? msg.detail : '' };
            else if (msg.t) { write(msg.t); setStatus(null); }
            else if (msg.tool) setStatus(TOOL_STATUS[msg.tool] ?? 'Looking that up…');
            else if (msg.status === 'thinking') setStatus((s) => s ?? 'Thinking…');
            // retry:false is a spent allowance: the buffered path would only
            // spend another request against the same limit.
            else if (msg.error && (msg.retry === false || bubble.id)) stopped = msg.error;
            else if (msg.error) stopped = stopped ?? msg.error;
          } catch { /* ignore a malformed frame rather than kill the answer */ }
        }
      }
      if (gate) {
        setOnline(true);
        pushAssistant(gate.code === 402
          ? `${gate.detail || 'The AI CFO chat is a Pro feature.'}\n\n[Upgrade to Pro](/checkout?plan=pro) to chat with your AI CFO.`
          : (gate.detail || 'The chat is unavailable right now. This is a fault on our side.'), true);
        return 'answered';
      }
      if (bubble.id) {
        if (stopped) write(`\n\n${stopped}`);
        setOnline(true);
        return 'answered';
      }
      if (stopped && (/limit|allowance|resting/i.test(stopped) || slow())) {
        pushAssistant(stopped, true);
        setOnline(true);
        return 'failed';
      }
      return slow() ? (pushAssistant(failureText(null, stopped ?? ''), true), 'failed') : 'retry';
    } catch (err) {
      const aborted = ctrl.signal.aborted;
      if (bubble.id) {
        // Words already on screen: keep them and say it stopped.
        const cur = bubble.id;
        setMessages((p) => p.map((m) => (m.id === cur
          ? { ...m, content: `${m.content}\n\n(The answer stopped here. Please ask again for the rest.)` } : m)));
        return 'answered';
      }
      if (aborted || slow()) { pushAssistant(failureText(aborted ? 504 : null, String(err)), true); setOnline(false); return 'failed'; }
      return 'retry';
    } finally {
      window.clearTimeout(idle);
      setStreaming(false);
    }
  }, [pushAssistant]);

  const sendMessage = useCallback(async (raw: string) => {
    const text = raw.trim().slice(0, MAX_CHARS);
    if (!text || loadingRef.current) return;

    // The conversation before this question, for the AI's memory below.
    const earlier = historyForModel(messagesRef.current);
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
        pushAssistant(`✅ Recorded: ${draft.summary}.${typeof cashNow === 'number' ? ` Cash is now **${fmt(Number(cashNow), true, sym)}**.` : ''}`);
      } catch (err) {
        pushAssistant(`I couldn't post it: ${(err as Error).message}. It's saved as pending, and you can confirm it on the **Activity** page.`);
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
        pushAssistant('Discarded. Nothing was recorded.');
      } catch {
        pushAssistant("I couldn't discard it here. You can void it on the **Activity** page.");
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
        pushAssistant('Recording straight from the chat is a **Pro+** feature: type it once, say “confirm”, done.\n\nFor now the **Record** page does the same job, or [upgrade to Pro+](/checkout?plan=proplus) and never leave this window.');
        setSuggestions(['How do I record a sale?']);
        return;
      }
      setLoading(true);
      try {
        const cleaned = text.replace(/^(record|log)\b[:,]?\s*/i, '');
        const proposal = await classifyActivity(cleaned, (profileRef.current?.currency as string | null) || 'ZMW');
        if (!proposal?.event_type) {
          pushAssistant("I couldn't work out what kind of activity that is. Try phrasing it like “sold 3 bags of mealie meal for K450”, or use the **Record** page, which previews everything first.");
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
        const summary = `**${proposal.event_type}**${who ? ` · ${String(who)}` : ''}${amt > 0 ? `, ${fmt(amt, true, sym)}` : ''}`;
        pendingChatEventRef.current = { id: ev.id, summary };
        pushAssistant(`Here's what I'll record:\n\n${summary}\n\nSay **confirm** to post it to your books, or **cancel** to discard it.`);
        setSuggestions(['Confirm', 'Cancel']);
      } catch (err) {
        if (isNetworkError(err)) {
          pushAssistant("You're offline right now, so I can't classify that from here. The **Record** page still works: anything you save there is kept on your device and posts automatically when signal returns.");
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
        const lines = [`**${bm.label}, ${ind.label} reference:** ${bm.range}.`, '', bm.explain];
        if (bm.metric === 'margin' && lv.margin !== undefined) {
          let verdict = '';
          if (bm.loPct !== undefined && bm.hiPct !== undefined) {
            verdict = lv.margin > bm.hiPct
              ? ', above the reference range. Strong.'
              : lv.margin < bm.loPct
                ? ', below the reference range. Your biggest cost lines are the place to look.'
                : ', inside the reference range.';
          }
          lines.push('', `Your own net margin is **${lv.margin.toFixed(1)}%** (from your recorded data)${verdict}`);
        }
        lines.push('', '_Reference ranges come from published industry studies. They are orientation, not targets. Your own three-month trend beats any industry average._');
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

    // 3) No data yet, and they're asking for THEIR figures → answer here. This
    //    used to refuse EVERY question on an empty account, which meant a new
    //    owner could never reach the model at all: the chat just fired canned
    //    text, and a Free owner's daily taster questions were unspendable.
    //    The anti-fabrication line is now held where it belongs — the server
    //    states the empty state outright (has_data:false → _context_to_text)
    //    and the tools return empty — so everything else goes to the model and
    //    gets a real answer. Only a direct request for their own numbers stops
    //    here, because a round-trip could only say the same thing slower.
    const noData = !lv.hasFinancial && !lv.hasCustomer && !lv.hasOps && !lv.hasTwin;
    if (noData && asksForOwnFigures(text)) {
      pushAssistant("I don't have any of your business data yet, so I can't give you real figures, and I won't make them up.\n\nThe quickest start: open **Record** and tell me what happened today (“sold 3 crates of drinks for K360”). Or upload a CSV/Excel file on the **Overview** page. Until then I can still explain any metric or term. Try \"Explain net margin\".");
      setSuggestions(['How do I record a sale?', 'Explain net margin', 'How do I upload data?']);
      return;
    }

    // 4) Everything else → the AI CFO backend with full master context.
    //    Streamed (audit #21): the answer types out as the model writes it.
    //    Any streaming failure falls back to the buffered /chat below, so the
    //    chat can never be worse than it was before streaming existed.
    setLoading(true);
    setStatus('Thinking…');
    logUsage('chat');
    // ONE id for this question, sent on BOTH hops below. A Free owner's daily
    // taster is charged server-side per question, not per request — without
    // this the streaming attempt and its buffered fallback each took one, so
    // "3 free questions a day" ran out after two (audit #24).
    const qid = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `q-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    // `messages` is the conversation so far plus this question: the AI's
    // memory. Only `message` was sent before, so every question arrived on
    // its own and "and last month?" meant nothing.
    const payload = JSON.stringify({
      message: text,
      messages: [...earlier, { role: 'user', content: text }],
      qid,
      context: buildContext(s, lv, {
        name: profileRef.current?.business_name,
        type: profileRef.current?.business_type,
        industry: profileRef.current?.industry,
        location: profileRef.current?.location,
      }),
    });

    try {
      let outcome: 'answered' | 'retry' | 'failed' = 'retry';
      try {
        outcome = await streamChat(payload);
      } catch {
        outcome = 'retry';
      }
      if (outcome !== 'retry') return;

      // The buffered answer: the whole reply at once, for when streaming is
      // not getting through.
      setStatus('Thinking…');
      const limit = deadlineSignal(BUFFERED_MS);
      let res: Response;
      let body = '';
      try {
        res = await postChat('/chat', payload, limit.signal);
        body = await res.text();
      } catch (err) {
        setOnline(false);
        pushAssistant(failureText(limit.signal.aborted ? 504 : null, String(err)), true);
        return;
      } finally {
        limit.clear();
      }
      let data: Record<string, unknown> = {};
      try { data = body ? JSON.parse(body) : {}; } catch {
        // A host's error page, not our API. Never show it to the owner.
        setOnline(false);
        pushAssistant(failureText(res.status, body.slice(0, 300)), true);
        return;
      }
      // 402 = tier gate. The AI CFO chat is Pro+ — show a clean upgrade nudge,
      // not an error, and stop (this isn't a service failure).
      if (res.status === 402) {
        setOnline(true);
        const msg = typeof data.detail === 'string'
          ? data.detail
          : 'The AI CFO chat is a Pro feature.';
        pushAssistant(`${msg}\n\n[Upgrade to Pro](/checkout?plan=pro) to chat with your AI CFO.`, true);
        return;
      }
      // 503 = the service is at fault (no AI key, the plan could not be read,
      // the AI resting). Show what it said: those messages are written for
      // the owner.
      if (res.status === 503) {
        setOnline(true);
        pushAssistant(typeof data.detail === 'string' ? data.detail
          : 'The chat is unavailable right now. This is a fault on our side.', true);
        return;
      }
      if (!res.ok) {
        setOnline(false);
        pushAssistant(failureText(res.status, typeof data.detail === 'string' ? data.detail : ''), true);
        return;
      }
      setOnline(true);
      const reply = (data.reply as string) ?? (data.response as string) ?? '';
      if (reply.trim()) pushAssistant(reply);
      else pushAssistant(failureText(null), true);
    } finally {
      setLoading(false);
      setStatus(null);
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
      // Never on something the owner is using. A card is explainable as a
      // whole, and a long press inside one of its text boxes (the phone's way
      // to paste) opened the explainer and moved the cursor into the chat, so
      // what they typed next landed in the assistant instead of the form.
      if ((e.target as HTMLElement | null)?.closest('input, textarea, select, button, a, label, [contenteditable="true"]')) return;
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
      status: loading && !streaming ? (status ?? 'Working on it…') : null,
      sendMessage, pushAssistant, clearConversation,
    }}>
      {children}
    </Ctx.Provider>
  );
}
