"use client";
// app/data-studio/page.tsx — AI-BOS Data Studio
// Excel-like formula engine + AI formula mode + data grid
// All store access is null-safe

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFinancialStore } from "@/lib/store";
import { formatCurrency } from "@/lib/currency";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ComputeResult {
  success: boolean;
  mode: "formula" | "ai";
  formula?: string;
  formula_used?: string;
  result: unknown;
  insight?: string;
}

interface HistoryEntry {
  id: string;
  formula: string;
  result: unknown;
  insight?: string;
  mode: string;
  ts: number;
}

// ── Formula palette ────────────────────────────────────────────────────────────

const PALETTE = [
  { fn: "SUM",       desc: "Total of a column",         example: "SUM(revenue)",           color: "var(--cyan)" },
  { fn: "AVG",       desc: "Average of a column",        example: "AVG(profit)",            color: "var(--cyan)" },
  { fn: "MAX",       desc: "Highest value",              example: "MAX(revenue)",            color: "var(--cyan)" },
  { fn: "MIN",       desc: "Lowest value",               example: "MIN(costs)",              color: "var(--cyan)" },
  { fn: "COUNT",     desc: "Count non-zero rows",        example: "COUNT(profit)",           color: "var(--text-3)" },
  { fn: "GROWTH",    desc: "% growth first → last",      example: "GROWTH(revenue)",        color: "var(--e2, #f97316)" },
  { fn: "MARGIN",    desc: "Profit margin %",            example: "MARGIN(revenue, profit)", color: "var(--e2, #f97316)" },
  { fn: "FORECAST",  desc: "Next-period prediction",     example: "FORECAST(revenue)",      color: "var(--good)" },
  { fn: "BREAKEVEN", desc: "Breakeven revenue",          example: "BREAKEVEN(costs, 0.6)",  color: "var(--good)" },
  { fn: "YOY",       desc: "Year-on-year growth %",      example: "YOY(revenue)",           color: "var(--warn)" },
  { fn: "AI:",       desc: "Natural language formula",   example: "AI: Which month had the worst margin?", color: "var(--cyan)" },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatResult(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (Array.isArray(val)) {
    const nums = val.map(Number).filter(isFinite);
    if (!nums.length) return "[]";
    if (nums.length <= 6) return nums.map((v) => v.toFixed(2)).join(", ");
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
    return `[${nums.length} values] avg ${avg.toFixed(2)}`;
  }
  if (typeof val === "number") {
    if (Math.abs(val) >= 1000) return formatCurrency(val);
    return `${val.toFixed(2)}`;
  }
  return String(val);
}

function resultColor(val: unknown): string {
  if (typeof val === "number") {
    if (val > 0) return "var(--good)";
    if (val < 0) return "var(--crit)";
  }
  return "var(--cyan)";
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function DataStudio() {
  const store        = useFinancialStore();
  const cabinetId    = store.cabinetId ?? null;
  const filename     = store.filename ?? null;
  const monthly      = store.monthly ?? [];
  const activeSheet  = store.activeSheet ?? null;

  const [formula,  setFormula]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [history,  setHistory]  = useState<HistoryEntry[]>([]);
  const [tab,      setTab]      = useState<"formula" | "grid">("formula");

  // Build column context from live store data
  const colContext = useMemo(() => {
    if (!monthly.length) return {} as Record<string, number[]>;
    return {
      revenue: monthly.map((m) => m.revenue ?? 0),
      costs:   monthly.map((m) => m.costs   ?? 0),
      profit:  monthly.map((m) => m.profit  ?? 0),
      margin:  monthly.map((m) => m.margin  ?? 0),
    };
  }, [monthly]);

  const availCols = Object.keys(colContext);

  // ── Run formula ──────────────────────────────────────────────────────────────

  const runFormula = useCallback(async () => {
    const f = formula.trim();
    if (!f) return;
    setLoading(true);
    setError(null);

    try {
      const isAI = f.toUpperCase().startsWith("AI:");
      const payload = {
        formula: f,
        cabinet_id:     cabinetId ?? undefined,
        column_context: colContext,
        ai_mode:        isAI,
      };

      const res = await fetch("/api/proxy/data-studio/compute", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify(payload),
      });

      const data = (await res.json()) as ComputeResult & { detail?: string };
      if (!res.ok) throw new Error(data.detail ?? `Error ${res.status}`);

      setHistory((prev) =>
        [
          {
            id:      Math.random().toString(36).slice(2),
            formula: f,
            result:  data.result,
            insight: data.insight,
            mode:    data.mode ?? (isAI ? "ai" : "formula"),
            ts:      Date.now(),
          },
          ...prev,
        ].slice(0, 50)
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [formula, cabinetId, colContext]);

  // ── Totals for quick-stats ────────────────────────────────────────────────

  const totRev    = monthly.reduce((s, m) => s + (m.revenue ?? 0), 0);
  const totCost   = monthly.reduce((s, m) => s + (m.costs   ?? 0), 0);
  const totProfit = monthly.reduce((s, m) => s + (m.profit  ?? 0), 0);
  const bestRev   = monthly.length
    ? monthly.reduce((a, b) => ((b.revenue ?? 0) > (a.revenue ?? 0) ? b : a), monthly[0])
    : null;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--bg-page)", padding: "24px 24px 48px" }}
    >
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background:  "rgba(0,212,255,0.08)",
              border:      "1px solid rgba(0,212,255,0.2)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="var(--cyan)" strokeWidth="1.5"/>
              <path d="M3 9h18M3 15h18M9 3v18M15 3v18" stroke="var(--cyan)" strokeWidth="1.5"/>
            </svg>
          </div>
          <div>
            <h1
              className="text-xl font-bold"
              style={{ color: "var(--text-1)", fontFamily: "Inter, sans-serif" }}
            >
              Data Studio
            </h1>
            <p
              className="text-[11px]"
              style={{ color: "var(--text-3)", fontFamily: "JetBrains Mono, monospace" }}
            >
              {cabinetId
                ? `${filename ?? "file"}${activeSheet ? ` · ${activeSheet}` : ""} · ${monthly.length} periods`
                : "No data loaded — upload a file to use formulas on real data"}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(["formula", "grid"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background:   tab === t ? "var(--cyan)"     : "var(--bg-card)",
                color:        tab === t ? "#000"             : "var(--text-2)",
                border:       "1px solid",
                borderColor:  tab === t ? "var(--cyan)"     : "var(--border)",
                fontFamily:   "Inter, sans-serif",
              }}
            >
              {t === "formula" ? "Formula Engine" : "Data Grid"}
            </button>
          ))}
        </div>

        {/* ── FORMULA TAB ─────────────────────────────────────────────────── */}
        {tab === "formula" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left: formula bar + palette + history */}
            <div className="lg:col-span-2 space-y-4">

              {/* Formula bar */}
              <div
                className="rounded-2xl border p-4"
                style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
              >
                <label
                  className="block text-[11px] mb-2 font-medium"
                  style={{ color: "var(--text-3)", fontFamily: "JetBrains Mono, monospace" }}
                >
                  fx  FORMULA BAR
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formula}
                    onChange={(e) => setFormula(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") runFormula(); }}
                    placeholder='SUM(revenue)  ·  GROWTH(profit)  ·  AI: What drove my best month?'
                    disabled={loading}
                    autoFocus
                    className="flex-1 bg-transparent outline-none text-sm px-3 py-2.5 rounded-xl border"
                    style={{
                      color:        "var(--text-1)",
                      borderColor:  "var(--border)",
                      background:   "var(--bg-page)",
                      fontFamily:   "JetBrains Mono, monospace",
                    }}
                  />
                  <button
                    onClick={runFormula}
                    disabled={!formula.trim() || loading}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      background:  formula.trim() && !loading ? "var(--cyan)" : "var(--bg-page)",
                      color:       formula.trim() && !loading ? "#000"        : "var(--text-3)",
                      border:      "1px solid var(--border)",
                      fontFamily:  "Inter, sans-serif",
                      cursor:      formula.trim() && !loading ? "pointer"     : "not-allowed",
                    }}
                  >
                    {loading ? "Running…" : "Run ↵"}
                  </button>
                </div>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-2 text-xs px-3 py-2 rounded-lg overflow-hidden"
                      style={{
                        background: "rgba(239,68,68,0.08)",
                        color:      "var(--crit)",
                        fontFamily: "JetBrains Mono, monospace",
                      }}
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* Column chips */}
                {availCols.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5 items-center">
                    <span
                      className="text-[10px]"
                      style={{ color: "var(--text-3)", fontFamily: "JetBrains Mono, monospace" }}
                    >
                      Columns:
                    </span>
                    {availCols.map((col) => (
                      <button
                        key={col}
                        onClick={() => {
                          setFormula((prev) => {
                            const trimmed = prev.trimEnd();
                            if (trimmed.endsWith("(")) return trimmed + col;
                            if (!trimmed) return col;
                            return trimmed + `(${col})`;
                          });
                        }}
                        className="text-[10px] px-2 py-0.5 rounded-md transition-colors"
                        style={{
                          background: "rgba(0,212,255,0.08)",
                          color:      "var(--cyan)",
                          border:     "1px solid rgba(0,212,255,0.18)",
                          fontFamily: "JetBrains Mono, monospace",
                        }}
                      >
                        {col}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Formula palette */}
              <div
                className="rounded-2xl border p-4"
                style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
              >
                <h3
                  className="text-[11px] font-medium mb-3"
                  style={{ color: "var(--text-3)", fontFamily: "JetBrains Mono, monospace" }}
                >
                  FORMULA PALETTE
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PALETTE.map((item) => (
                    <button
                      key={item.fn}
                      onClick={() => setFormula(item.example)}
                      className="text-left p-3 rounded-xl border transition-all"
                      style={{
                        background:   "var(--bg-page)",
                        borderColor:  "var(--border)",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = item.color;
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                      }}
                    >
                      <div
                        className="text-xs font-bold mb-0.5"
                        style={{ color: item.color, fontFamily: "JetBrains Mono, monospace" }}
                      >
                        {item.fn}
                      </div>
                      <div
                        className="text-[10px] leading-snug"
                        style={{ color: "var(--text-3)", fontFamily: "Inter, sans-serif" }}
                      >
                        {item.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Result history */}
              {history.length > 0 && (
                <div
                  className="rounded-2xl border overflow-hidden"
                  style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                    <span
                      className="text-[11px] font-medium"
                      style={{ color: "var(--text-3)", fontFamily: "JetBrains Mono, monospace" }}
                    >
                      HISTORY
                    </span>
                    <button
                      onClick={() => setHistory([])}
                      className="text-[10px]"
                      style={{ color: "var(--text-3)", fontFamily: "JetBrains Mono, monospace" }}
                    >
                      Clear
                    </button>
                  </div>
                  <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                    <AnimatePresence>
                      {history.map((h) => (
                        <motion.div
                          key={h.id}
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="px-4 py-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span
                                  className="text-[9px] px-1.5 py-0.5 rounded"
                                  style={{
                                    background: h.mode === "ai" ? "rgba(0,212,255,0.12)" : "var(--bg-page)",
                                    color:      h.mode === "ai" ? "var(--cyan)"          : "var(--text-3)",
                                    fontFamily: "JetBrains Mono, monospace",
                                    border:     "1px solid var(--border)",
                                  }}
                                >
                                  {h.mode.toUpperCase()}
                                </span>
                                <code
                                  className="text-xs truncate"
                                  style={{ color: "var(--text-2)", fontFamily: "JetBrains Mono, monospace" }}
                                >
                                  {h.formula}
                                </code>
                              </div>
                              {h.insight && (
                                <p
                                  className="text-xs leading-snug"
                                  style={{ color: "var(--text-2)", fontFamily: "Inter, sans-serif" }}
                                >
                                  {h.insight}
                                </p>
                              )}
                              <button
                                onClick={() => setFormula(h.formula)}
                                className="text-[10px] mt-1"
                                style={{ color: "var(--text-3)", fontFamily: "JetBrains Mono, monospace" }}
                              >
                                ↺ reuse
                              </button>
                            </div>
                            <div
                              className="text-sm font-bold flex-shrink-0"
                              style={{ color: resultColor(h.result), fontFamily: "JetBrains Mono, monospace" }}
                            >
                              {formatResult(h.result)}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </div>

            {/* Right: quick stats + AI tip */}
            <div className="space-y-4">
              {monthly.length > 0 && (
                <div
                  className="rounded-2xl border p-4 space-y-3"
                  style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
                >
                  <h3
                    className="text-[11px] font-medium"
                    style={{ color: "var(--text-3)", fontFamily: "JetBrains Mono, monospace" }}
                  >
                    QUICK STATS
                  </h3>
                  {[
                    { label: "Total Revenue",  value: formatCurrency(totRev),    color: "var(--cyan)" },
                    { label: "Total Costs",    value: formatCurrency(totCost),   color: "var(--warn)" },
                    { label: "Total Profit",   value: formatCurrency(totProfit), color: totProfit >= 0 ? "var(--good)" : "var(--crit)" },
                    { label: "Best Month",     value: bestRev ? bestRev.month : "—", color: "var(--text-2)" },
                    { label: "Best Revenue",   value: bestRev ? formatCurrency(bestRev.revenue) : "—", color: "var(--cyan)" },
                  ].map((stat) => (
                    <div key={stat.label} className="flex justify-between items-center">
                      <span
                        className="text-xs"
                        style={{ color: "var(--text-3)", fontFamily: "Inter, sans-serif" }}
                      >
                        {stat.label}
                      </span>
                      <span
                        className="text-sm font-bold"
                        style={{ color: stat.color, fontFamily: "JetBrains Mono, monospace" }}
                      >
                        {stat.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* AI formula tip */}
              <div
                className="rounded-2xl border p-4"
                style={{
                  background:  "rgba(0,212,255,0.03)",
                  borderColor: "rgba(0,212,255,0.15)",
                }}
              >
                <h3
                  className="text-[11px] font-medium mb-2"
                  style={{ color: "var(--cyan)", fontFamily: "JetBrains Mono, monospace" }}
                >
                  AI FORMULA TIP
                </h3>
                <p
                  className="text-xs leading-relaxed mb-3"
                  style={{ color: "var(--text-2)", fontFamily: "Inter, sans-serif" }}
                >
                  Prefix any question with{" "}
                  <code style={{ color: "var(--cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                    AI:
                  </code>{" "}
                  to ask in plain English instead of formula syntax.
                </p>
                {[
                  "AI: Which month had the worst margin?",
                  "AI: Calculate moving average of revenue",
                  "AI: What is cost as % of revenue?",
                ].map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setFormula(ex)}
                    className="w-full text-left text-[10px] px-2 py-1.5 rounded-lg mb-1.5 transition-colors"
                    style={{
                      background: "var(--bg-card)",
                      color:      "var(--text-3)",
                      border:     "1px solid var(--border)",
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                  >
                    {ex}
                  </button>
                ))}
              </div>

              {!cabinetId && (
                <div
                  className="rounded-2xl border p-4 text-center"
                  style={{
                    background:  "rgba(245,158,11,0.05)",
                    borderColor: "rgba(245,158,11,0.2)",
                  }}
                >
                  <p
                    className="text-xs"
                    style={{ color: "var(--warn)", fontFamily: "Inter, sans-serif" }}
                  >
                    Upload a financial file to run formulas on real business data.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── DATA GRID TAB ──────────────────────────────────────────────── */}
        {tab === "grid" && (
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
          >
            {monthly.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <p
                  style={{ color: "var(--text-3)", fontFamily: "Inter, sans-serif" }}
                >
                  No data — upload a financial file to populate the grid.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table
                  className="w-full text-sm"
                  style={{ borderCollapse: "collapse" }}
                >
                  <thead>
                    <tr
                      style={{
                        background:   "var(--bg-page)",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      {["#", "Period", "Revenue", "Costs", "Profit", "Margin"].map(
                        (h) => (
                          <th
                            key={h}
                            className={`px-4 py-3 text-xs font-medium ${h === "#" || h === "Period" ? "text-left" : "text-right"}`}
                            style={{
                              color:      "var(--text-3)",
                              fontFamily: "JetBrains Mono, monospace",
                            }}
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {monthly.map((row, i) => (
                      <motion.tr
                        key={`${row.month}-${i}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.015 }}
                        style={{ borderBottom: "1px solid var(--border)" }}
                      >
                        <td
                          className="px-4 py-2.5 text-xs"
                          style={{ color: "var(--text-3)", fontFamily: "JetBrains Mono, monospace" }}
                        >
                          {i + 1}
                        </td>
                        <td
                          className="px-4 py-2.5 text-sm font-medium"
                          style={{ color: "var(--text-1)", fontFamily: "Inter, sans-serif" }}
                        >
                          {row.month}
                        </td>
                        <td
                          className="px-4 py-2.5 text-right text-sm"
                          style={{ color: "var(--cyan)", fontFamily: "JetBrains Mono, monospace" }}
                        >
                          {formatCurrency(row.revenue)}
                        </td>
                        <td
                          className="px-4 py-2.5 text-right text-sm"
                          style={{ color: "var(--warn)", fontFamily: "JetBrains Mono, monospace" }}
                        >
                          {formatCurrency(row.costs)}
                        </td>
                        <td
                          className="px-4 py-2.5 text-right text-sm font-medium"
                          style={{
                            color:      (row.profit ?? 0) >= 0 ? "var(--good)" : "var(--crit)",
                            fontFamily: "JetBrains Mono, monospace",
                          }}
                        >
                          {formatCurrency(row.profit)}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-2">
                            {/* Mini margin bar */}
                            <div
                              style={{
                                width:      `${Math.min(Math.abs(row.margin ?? 0), 60) * 1.2}px`,
                                height:     "4px",
                                borderRadius: "2px",
                                background:
                                  (row.margin ?? 0) >= 25
                                    ? "var(--good)"
                                    : (row.margin ?? 0) >= 12
                                    ? "var(--warn)"
                                    : "var(--crit)",
                                maxWidth: "72px",
                              }}
                            />
                            <span
                              className="text-xs"
                              style={{
                                color:
                                  (row.margin ?? 0) >= 25
                                    ? "var(--good)"
                                    : (row.margin ?? 0) >= 12
                                    ? "var(--warn)"
                                    : "var(--crit)",
                                fontFamily: "JetBrains Mono, monospace",
                                minWidth:   "44px",
                                textAlign:  "right",
                              }}
                            >
                              {(row.margin ?? 0).toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                  {/* Totals footer */}
                  <tfoot>
                    <tr
                      style={{
                        background:  "var(--bg-page)",
                        borderTop:   "2px solid var(--border)",
                      }}
                    >
                      <td
                        colSpan={2}
                        className="px-4 py-3 text-xs font-bold"
                        style={{ color: "var(--text-2)", fontFamily: "JetBrains Mono, monospace" }}
                      >
                        TOTALS / AVG
                      </td>
                      <td
                        className="px-4 py-3 text-right text-sm font-bold"
                        style={{ color: "var(--cyan)", fontFamily: "JetBrains Mono, monospace" }}
                      >
                        {formatCurrency(totRev)}
                      </td>
                      <td
                        className="px-4 py-3 text-right text-sm font-bold"
                        style={{ color: "var(--warn)", fontFamily: "JetBrains Mono, monospace" }}
                      >
                        {formatCurrency(totCost)}
                      </td>
                      <td
                        className="px-4 py-3 text-right text-sm font-bold"
                        style={{
                          color:      totProfit >= 0 ? "var(--good)" : "var(--crit)",
                          fontFamily: "JetBrains Mono, monospace",
                        }}
                      >
                        {formatCurrency(totProfit)}
                      </td>
                      <td
                        className="px-4 py-3 text-right text-sm font-bold"
                        style={{ color: "var(--good)", fontFamily: "JetBrains Mono, monospace" }}
                      >
                        {monthly.length > 0
                          ? `${(monthly.reduce((s, m) => s + (m.margin ?? 0), 0) / monthly.length).toFixed(1)}%`
                          : "—"}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
