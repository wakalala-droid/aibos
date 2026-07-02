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
import { fmt } from '@/lib/utils';
import { logUsage } from '@/lib/usage';
import { createClient } from '@/lib/supabase';
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
  return {
    currency: sym,
    hasFinancial, hasCustomer, hasOps,
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
function buildContext(s: StoreState, lv: LiveMetrics): Record<string, unknown> {
  const sym = s.currencySymbol || 'K';
  const ctx: Record<string, unknown> = {
    currency_symbol: sym,
    cabinet_id: s.cabinetId ?? undefined,
    has_data: lv.hasFinancial || lv.hasCustomer || lv.hasOps,
    // Anti-fabrication contract for the model (trust is the product).
    guardrails: 'Only state numbers that appear in this context. If a figure is not provided, say you do not have it and that no data has been uploaded for it. Never estimate, assume, round-trip, or invent figures.',
  };
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

  const setOpen = useCallback((v: boolean) => setOpenState(v), []);
  const toggle = useCallback(() => setOpenState((v) => !v), []);
  const clearConversation = useCallback(() => { setMessages([]); setSuggestions([]); }, []);

  const pushAssistant = useCallback((content: string) => {
    setMessages((p) => [...p, { id: `a-${Date.now()}-${p.length}`, role: 'assistant', content, timestamp: nowTime() }]);
  }, []);

  const sendMessage = useCallback(async (raw: string) => {
    const text = raw.trim().slice(0, MAX_CHARS);
    if (!text || loadingRef.current) return;

    setMessages((p) => [...p, { id: `u-${Date.now()}`, role: 'user', content: text, timestamp: nowTime() }]);
    setSuggestions([]);

    const s = useStore.getState();
    const lv = buildLiveMetrics(s);

    // 1) Local answer — definitions, explanations, direct metric lookups.
    const local = localAnswer(text, lv);
    if (local) { pushAssistant(local); return; }

    // 2) No data uploaded yet → DO NOT call the model. With an empty context it
    //    will happily invent the user's figures, which is exactly the trust
    //    failure we must never ship. Answer honestly instead.
    if (!lv.hasFinancial && !lv.hasCustomer && !lv.hasOps) {
      pushAssistant("I don't have any of your data loaded yet, so I can't give you real figures — and I won't make them up.\n\nUpload a CSV or Excel file (financial, customer or POS) on the **Overview** page and I'll analyse your actual numbers. Until then I can still explain any metric or term — try \"Explain net margin\" or \"What is RFM?\".");
      setSuggestions(['Explain net margin', 'What is a health score?', 'How do I upload data?']);
      return;
    }

    // 3) Open-ended reasoning → Grok backend with full master context.
    setLoading(true);
    logUsage('chat');
    try {
      const res = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ message: text, context: buildContext(s, lv) }),
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
  }, [pushAssistant]);

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
      pushAssistant(`**${label}**\n\nThis is part of your AI-BOS dashboard. Ask me what you'd like to know about it and I'll pull the detail from your data.${valueLine}`);
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
