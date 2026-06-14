"use client";

// app/data-studio/page.tsx — AI-BOS Data Studio
// Spreadsheet-like grid with Excel formulas, AI formulas, and real data

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFinancialStore } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormulaResult {
  success: boolean;
  mode: "formula" | "ai";
  formula: string;
  formula_used?: string;
  result: unknown;
  insight?: string;
}

interface FormulaHistoryEntry {
  id: string;
  formula: string;
  result: unknown;
  insight?: string;
  mode: string;
  ts: number;
}

// ─── Formula palette ──────────────────────────────────────────────────────────

const FORMULA_PALETTE = [
  { label: "SUM", desc: "Sum a column", example: "SUM(revenue)", color: "var(--cyan)" },
  { label: "AVG", desc: "Average a column", example: "AVG(profit)", color: "var(--cyan)" },
  { label: "MAX", desc: "Highest value", example: "MAX(revenue)", color: "var(--cyan)" },
  { label: "MIN", desc: "Lowest value", example: "MIN(costs)", color: "var(--cyan)" },
  { label: "GROWTH", desc: "% growth first → last", example: "GROWTH(revenue)", color: "var(--e2, #f97316)" },
  { label: "MARGIN", desc: "Profit margin %", example: "MARGIN(revenue, profit)", color: "var(--e2, #f97316)" },
  { label: "FORECAST", desc: "Next period forecast", example: "FORECAST(revenue)", color: "var(--good)" },
  { label: "BREAKEVEN", desc: "Breakeven revenue", example: "BREAKEVEN(fixed_costs, 0.6)", color: "var(--good)" },
  { label: "YOY", desc: "Year-on-year growth", example: "YOY(revenue)", color: "var(--warn)" },
  { label: "COUNT", desc: "Count non-zero values", example: "COUNT(profit)", color: "var(--text-3)" },
  { label: "AI:", desc: "Ask AI to compute anything", example: "AI: What is our busiest quarter?", color: "var(--cyan)" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatResult(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (Array.isArray(val)) {
    if (val.length <= 6) return val.map((v) => (typeof v === "number" ? v.toFixed(2) : String(v))).join(", ");
    return `[${val.length} values] avg: ${(val.reduce((s: number, v) => s + Number(v), 0) / val.length).toFixed(2)}`;
  }
  if (typeof val === "number") {
    if (val > 10000) return formatCurrency(val);
    if (val > 100) return val.toFixed(2);
    return `${val.toFixed(2)}%`;
  }
  return String(val);
}

function getResultColor(val: unknown): string {
  if (typeof val === "number") {
    if (val > 0) return "var(--good)";
    if (val < 0) return "var(--crit)";
  }
  return "var(--cyan)";
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DataStudio() {
  const { cabinetId, filename, monthly, activeSheet } = useFinancialStore();

  const [formula, setFormula] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<FormulaHistoryEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"formula" | "grid">("formula");

  // Build column context from store monthly data
  const columnContext = useMemo(() => {
    if (!monthly.length) return {};
    return {
      revenue: monthly.map((m) => m.revenue),
      costs: monthly.map((m) => m.costs),
      profit: monthly.map((m) => m.profit),
      margin: monthly.map((m) => m.margin),
    };
  }, [monthly]);

  const availableColumns = Object.keys(columnContext);

  const runFormula = useCallback(async () => {
    const f = formula.trim();
    if (!f) return;

    setLoading(true);
    setError(null);

    try {
      const isAI = f.toUpperCase().startsWith("AI:");
      const payload = {
        formula: f,
        cabinet_id: cabinetId || undefined,
        column_context: columnContext,
        ai_mode: isAI,
      };

      const res = await fetch("/api/proxy/data-studio/compute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Error ${res.status}`);
      }

      const data: FormulaResult = await res.json();

      const entry: FormulaHistoryEntry = {
        id: crypto.randomUUID(),
        formula: f,
        result: data.result,
        insight: data.insight,
        mode: data.mode,
        ts: Date.now(),
      };
      setHistory((prev) => [entry, ...prev].slice(0, 50));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [formula, cabinetId, columnContext]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") runFormula();
  };

  const insertFormula = (example: string) => {
    setFormula(example);
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--bg-page)", padding: "24px" }}
    >
      <div className="max-w-6xl mx-auto">
        {/* ── Header ── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "var(--cyan)/10", border: "1px solid var(--cyan)/30" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
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
                className="text-xs"
                style={{ color: "var(--text-3)", fontFamily: "JetBrains Mono, monospace" }}
              >
                {cabinetId
                  ? `${filename}${activeSheet ? ` · ${activeSheet}` : ""} · ${monthly.length} periods loaded`
                  : "No data loaded — upload a file first"}
              </p>
            </div>
          </div>
        </div>

        {/* ── Tab switcher ── */}
        <div className="flex gap-2 mb-6">
          {(["formula", "grid"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: activeTab === tab ? "var(--cyan)" : "var(--bg-card)",
                color: activeTab === tab ? "#000" : "var(--text-2)",
                border: "1px solid",
                borderColor: activeTab === tab ? "var(--cyan)" : "var(--border)",
                fontFamily: "Inter, sans-serif",
              }}
            >
              {tab === "formula" ? "Formula Engine" : "Data Grid"}
            </button>
          ))}
        </div>

        {activeTab === "formula" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* ── Left: Formula input + palette ── */}
            <div className="lg:col-span-2 space-y-4">
              {/* Formula bar */}
              <div
                className="rounded-2xl border p-4"
                style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
              >
                <label
                  className="block text-xs mb-2 font-medium"
                  style={{ color: "var(--text-3)", fontFamily: "JetBrains Mono, monospace" }}
                >
                  fx  FORMULA BAR
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formula}
                    onChange={(e) => setFormula(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder='Try: SUM(revenue) or AI: What drove my best month?'
                    className="flex-1 bg-transparent outline-none text-sm px-3 py-2.5 rounded-xl border transition-all"
                    style={{
                      color: "var(--text-1)",
                      borderColor: "var(--border)",
                      background: "var(--bg-page)",
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                    disabled={loading}
                    autoFocus
                  />
                  <button
                    onClick={runFormula}
                    disabled={!formula.trim() || loading}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      background: formula.trim() && !loading ? "var(--cyan)" : "var(--bg-page)",
                      color: formula.trim() && !loading ? "#000" : "var(--text-3)",
                      border: "1px solid var(--border)",
                      fontFamily: "Inter, sans-serif",
                      cursor: formula.trim() && !loading ? "pointer" : "not-allowed",
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
                      className="mt-2 text-xs px-3 py-2 rounded-lg"
                      style={{
                        background: "var(--crit)/10",
                        color: "var(--crit)",
                        fontFamily: "JetBrains Mono, monospace",
                      }}
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* Available columns */}
                {availableColumns.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span
                      className="text-[10px]"
                      style={{ color: "var(--text-3)", fontFamily: "JetBrains Mono, monospace" }}
                    >
                      Columns:
                    </span>
                    {availableColumns.map((col) => (
                      <button
                        key={col}
                        onClick={() => setFormula((prev) => { const s = prev.endsWith("(") ? prev + col : prev + `(${col})`; return s.replace("((", "("); })}
                        className="text-[10px] px-2 py-0.5 rounded-md"
                        style={{
                          background: "var(--cyan)/10",
                          color: "var(--cyan)",
                          fontFamily: "JetBrains Mono, monospace",
                          border: "1px solid var(--cyan)/20",
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
                  className="text-xs font-medium mb-3"
                  style={{ color: "var(--text-3)", fontFamily: "JetBrains Mono, monospace" }}
                >
                  FORMULA PALETTE
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {FORMULA_PALETTE.map((item) => (
                    <button
                      key={item.label}
                      onClick={() => insertFormula(item.example)}
                      className="text-left p-3 rounded-xl border transition-all hover:border-[var(--cyan)] group"
                      style={{
                        background: "var(--bg-page)",
                        borderColor: "var(--border)",
                      }}
                    >
                      <div
                        className="text-xs font-bold mb-0.5"
                        style={{ color: item.color, fontFamily: "JetBrains Mono, monospace" }}
                      >
                        {item.label}
                      </div>
                      <div
                        className="text-[10px] leading-relaxed"
                        style={{ color: "var(--text-3)" }}
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
                  className="rounded-2xl border"
                  style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
                >
                  <div className="flex items-center justify-between px-4 pt-4 pb-2">
                    <h3
                      className="text-xs font-medium"
                      style={{ color: "var(--text-3)", fontFamily: "JetBrains Mono, monospace" }}
                    >
                      RESULT HISTORY
                    </h3>
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
                      {history.map((entry) => (
                        <motion.div
                          key={entry.id}
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="px-4 py-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span
                                  className="text-[10px] px-1.5 py-0.5 rounded-sm"
                                  style={{
                                    background: entry.mode === "ai" ? "var(--cyan)/15" : "var(--bg-page)",
                                    color: entry.mode === "ai" ? "var(--cyan)" : "var(--text-3)",
                                    fontFamily: "JetBrains Mono, monospace",
                                  }}
                                >
                                  {entry.mode.toUpperCase()}
                                </span>
                                <code
                                  className="text-xs truncate"
                                  style={{ color: "var(--text-2)", fontFamily: "JetBrains Mono, monospace" }}
                                >
                                  {entry.formula}
                                </code>
                              </div>
                              {entry.insight && (
                                <p
                                  className="text-xs mt-1"
                                  style={{ color: "var(--text-2)", fontFamily: "Inter, sans-serif" }}
                                >
                                  {entry.insight}
                                </p>
                              )}
                            </div>
                            <div
                              className="text-sm font-bold flex-shrink-0"
                              style={{
                                color: getResultColor(entry.result),
                                fontFamily: "JetBrains Mono, monospace",
                              }}
                            >
                              {formatResult(entry.result)}
                            </div>
                          </div>
                          <button
                            onClick={() => insertFormula(entry.formula)}
                            className="text-[10px] mt-1"
                            style={{ color: "var(--text-3)" }}
                          >
                            ↺ reuse
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </div>

            {/* ── Right: Quick stats / AI tip panel ── */}
            <div className="space-y-4">
              {/* Quick stats */}
              {monthly.length > 0 && (
                <div
                  className="rounded-2xl border p-4 space-y-3"
                  style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
                >
                  <h3
                    className="text-xs font-medium"
                    style={{ color: "var(--text-3)", fontFamily: "JetBrains Mono, monospace" }}
                  >
                    QUICK STATS
                  </h3>
                  {[
                    {
                      label: "Total Revenue",
                      value: monthly.reduce((s, m) => s + m.revenue, 0),
                      color: "var(--cyan)",
                    },
                    {
                      label: "Total Costs",
                      value: monthly.reduce((s, m) => s + m.costs, 0),
                      color: "var(--warn)",
                    },
                    {
                      label: "Total Profit",
                      value: monthly.reduce((s, m) => s + m.profit, 0),
                      color: "var(--good)",
                    },
                    {
                      label: "Best Month",
                      value: Math.max(...monthly.map((m) => m.revenue)),
                      color: "var(--cyan)",
                    },
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
                        {formatCurrency(stat.value)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* AI tip */}
              <div
                className="rounded-2xl border p-4"
                style={{
                  background: "linear-gradient(135deg, var(--cyan)/5, transparent)",
                  borderColor: "var(--cyan)/20",
                }}
              >
                <h3
                  className="text-xs font-medium mb-2"
                  style={{ color: "var(--cyan)", fontFamily: "JetBrains Mono, monospace" }}
                >
                  AI FORMULA TIP
                </h3>
                <p
                  className="text-xs leading-relaxed mb-3"
                  style={{ color: "var(--text-2)", fontFamily: "Inter, sans-serif" }}
                >
                  Prefix any question with <code style={{ color: "var(--cyan)" }}>AI:</code> to use natural language instead of formula syntax.
                </p>
                <div className="space-y-1.5">
                  {[
                    "AI: Which month had the worst margin?",
                    "AI: Calculate 3-month moving average of revenue",
                    "AI: What is my cost as % of revenue?",
                  ].map((ex) => (
                    <button
                      key={ex}
                      onClick={() => setFormula(ex)}
                      className="w-full text-left text-[10px] px-2 py-1.5 rounded-lg transition-colors"
                      style={{
                        background: "var(--bg-card)",
                        color: "var(--text-3)",
                        fontFamily: "JetBrains Mono, monospace",
                        border: "1px solid var(--border)",
                      }}
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>

              {/* No data warning */}
              {!cabinetId && (
                <div
                  className="rounded-2xl border p-4 text-center"
                  style={{
                    background: "var(--warn)/5",
                    borderColor: "var(--warn)/20",
                  }}
                >
                  <p
                    className="text-xs"
                    style={{ color: "var(--warn)", fontFamily: "Inter, sans-serif" }}
                  >
                    Upload a file on the main page to use formulas on your business data.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Data Grid tab ── */}
        {activeTab === "grid" && (
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
          >
            {monthly.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <p style={{ color: "var(--text-3)", fontFamily: "Inter, sans-serif" }}>
                  No data loaded. Upload a financial file to view the grid.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-page)", borderBottom: "1px solid var(--border)" }}>
                      <th
                        className="px-4 py-3 text-left text-xs font-medium"
                        style={{ color: "var(--text-3)", fontFamily: "JetBrains Mono, monospace" }}
                      >
                        #
                      </th>
                      {["Month / Period", "Revenue", "Costs", "Profit", "Margin %"].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-right text-xs font-medium"
                          style={{ color: "var(--text-3)", fontFamily: "JetBrains Mono, monospace" }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthly.map((row, i) => (
                      <motion.tr
                        key={row.month + i}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02 }}
                        style={{ borderBottom: "1px solid var(--border)" }}
                        className="hover:bg-[var(--bg-page)] transition-colors"
                      >
                        <td
                          className="px-4 py-2.5 text-xs"
                          style={{ color: "var(--text-3)", fontFamily: "JetBrains Mono, monospace" }}
                        >
                          {i + 1}
                        </td>
                        <td
                          className="px-4 py-2.5 font-medium"
                          style={{ color: "var(--text-1)", fontFamily: "Inter, sans-serif" }}
                        >
                          {row.month}
                        </td>
                        <td
                          className="px-4 py-2.5 text-right"
                          style={{ color: "var(--cyan)", fontFamily: "JetBrains Mono, monospace" }}
                        >
                          {formatCurrency(row.revenue)}
                        </td>
                        <td
                          className="px-4 py-2.5 text-right"
                          style={{ color: "var(--warn)", fontFamily: "JetBrains Mono, monospace" }}
                        >
                          {formatCurrency(row.costs)}
                        </td>
                        <td
                          className="px-4 py-2.5 text-right"
                          style={{
                            color: row.profit >= 0 ? "var(--good)" : "var(--crit)",
                            fontFamily: "JetBrains Mono, monospace",
                          }}
                        >
                          {formatCurrency(row.profit)}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-2">
                            <div
                              className="h-1.5 rounded-full"
                              style={{
                                width: `${Math.min(row.margin, 50) * 2}px`,
                                background:
                                  row.margin >= 25
                                    ? "var(--good)"
                                    : row.margin >= 15
                                    ? "var(--warn)"
                                    : "var(--crit)",
                                maxWidth: "80px",
                              }}
                            />
                            <span
                              className="text-xs"
                              style={{
                                color:
                                  row.margin >= 25
                                    ? "var(--good)"
                                    : row.margin >= 15
                                    ? "var(--warn)"
                                    : "var(--crit)",
                                fontFamily: "JetBrains Mono, monospace",
                              }}
                            >
                              {row.margin.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "var(--bg-page)", borderTop: "2px solid var(--border)" }}>
                      <td colSpan={2} className="px-4 py-3">
                        <span
                          className="text-xs font-bold"
                          style={{ color: "var(--text-2)", fontFamily: "JetBrains Mono, monospace" }}
                        >
                          TOTALS
                        </span>
                      </td>
                      {[
                        { val: monthly.reduce((s, m) => s + m.revenue, 0), color: "var(--cyan)" },
                        { val: monthly.reduce((s, m) => s + m.costs, 0), color: "var(--warn)" },
                        { val: monthly.reduce((s, m) => s + m.profit, 0), color: "var(--good)" },
                      ].map(({ val, color }, i) => (
                        <td
                          key={i}
                          className="px-4 py-3 text-right text-sm font-bold"
                          style={{ color, fontFamily: "JetBrains Mono, monospace" }}
                        >
                          {formatCurrency(val)}
                        </td>
                      ))}
                      <td
                        className="px-4 py-3 text-right text-sm font-bold"
                        style={{ color: "var(--good)", fontFamily: "JetBrains Mono, monospace" }}
                      >
                        {(
                          monthly.reduce((s, m) => s + m.margin, 0) / (monthly.length || 1)
                        ).toFixed(1)}
                        %
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
