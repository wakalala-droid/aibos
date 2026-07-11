"use client";
// app/data-studio/page.tsx — AI-BOS Data Studio
// Excel-like formula engine + AI formula mode + data grid
// Data binding derives from canonical PascalCase store fields (Month/Revenue/Costs)
// with lowercase fallback, then computes profit/margin — so it works regardless of
// the casing the backend returns.

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFinancialStore } from "@/lib/store";
import { formatCurrency } from "@/lib/currency";
import { authHeaders } from "@/lib/api";
import SectionCard from "@/components/ui/SectionCard";
import PageHeader from '@/components/ui/PageHeader';

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

interface NormRow {
  month: string;
  revenue: number;
  costs: number;
  profit: number;
  margin: number;
}

// ── Formula palette ────────────────────────────────────────────────────────────

const PALETTE = [
  { fn: "SUM",       desc: "Total of a column",         example: "SUM(revenue)",            color: "var(--cyan)" },
  { fn: "AVG",       desc: "Average of a column",        example: "AVG(profit)",             color: "var(--cyan)" },
  { fn: "MAX",       desc: "Highest value",              example: "MAX(revenue)",            color: "var(--cyan)" },
  { fn: "MIN",       desc: "Lowest value",               example: "MIN(costs)",              color: "var(--cyan)" },
  { fn: "COUNT",     desc: "Count non-zero rows",        example: "COUNT(profit)",           color: "var(--text-3)" },
  { fn: "GROWTH",    desc: "% growth first → last",      example: "GROWTH(revenue)",         color: "var(--e2, #f97316)" },
  { fn: "MARGIN",    desc: "Profit margin %",            example: "MARGIN(revenue, profit)", color: "var(--e2, #f97316)" },
  { fn: "FORECAST",  desc: "Next-period prediction",     example: "FORECAST(revenue)",       color: "var(--good)" },
  { fn: "BREAKEVEN", desc: "Breakeven revenue",          example: "BREAKEVEN(costs, 0.6)",   color: "var(--good)" },
  { fn: "YOY",       desc: "Year-on-year growth %",      example: "YOY(revenue)",            color: "var(--warn)" },
  { fn: "AI:",       desc: "Natural language formula",   example: "AI: Which month had the worst margin?", color: "var(--cyan)" },
];

const AI_EXAMPLES = [
  "AI: Which month had the worst margin?",
  "AI: Calculate moving average of revenue",
  "AI: What is cost as % of revenue?",
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function num(v: unknown): number {
  const x = Number(v);
  return isFinite(x) ? x : 0;
}

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
  const monthly      = useMemo(() => store.monthly ?? [], [store.monthly]);
  const activeSheet  = store.activeSheet ?? null;

  const [formula,  setFormula]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [history,  setHistory]  = useState<HistoryEntry[]>([]);
  const [tab,      setTab]      = useState<"formula" | "grid">("formula");

  // Normalise every row from canonical PascalCase fields (with lowercase fallback),
  // deriving profit/margin so the page is correct regardless of backend casing.
  const rows: NormRow[] = useMemo(
    () =>
      monthly.map((m) => {
        const r = m as Record<string, unknown>;
        const revenue = num(r.Revenue ?? r.revenue);
        const costs   = num(r.Costs ?? r.costs);
        const profit  = r.profit != null ? num(r.profit) : revenue - costs;
        const margin  = r.margin != null ? num(r.margin) : revenue ? (profit / revenue) * 100 : 0;
        return {
          month: String(r.Month ?? r.month ?? "—"),
          revenue,
          costs,
          profit,
          margin,
        };
      }),
    [monthly]
  );

  const hasData = rows.length > 0;

  // Build column context from normalised data
  const colContext = useMemo<Record<string, number[]>>(() => {
    if (!rows.length) return {} as Record<string, number[]>;
    return {
      revenue: rows.map((m) => m.revenue),
      costs:   rows.map((m) => m.costs),
      profit:  rows.map((m) => m.profit),
      margin:  rows.map((m) => m.margin),
    };
  }, [rows]);

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
        headers: { "content-type": "application/json", ...(await authHeaders()) },
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

  const totRev    = rows.reduce((s, m) => s + m.revenue, 0);
  const totCost   = rows.reduce((s, m) => s + m.costs, 0);
  const totProfit = rows.reduce((s, m) => s + m.profit, 0);
  const avgMargin = rows.length ? rows.reduce((s, m) => s + m.margin, 0) / rows.length : 0;
  const bestRev   = rows.length
    ? rows.reduce((a, b) => (b.revenue > a.revenue ? b : a), rows[0])
    : null;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="page-container">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <PageHeader
        eyebrow="Data Intelligence"
        eyebrowColour="var(--cyan)"
        title="Data Studio"
        subtitle={hasData
          ? `${filename ?? "file"}${activeSheet ? ` · ${activeSheet}` : ""} · ${rows.length} periods · Excel-style + AI formulas`
          : "Excel-style formula engine + plain-English AI formulas"}
      />

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["formula", "grid"] as const).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                fontSize: 'var(--fs-data)',
                fontWeight: 600,
                cursor: "pointer",
                background: active ? "var(--cyan)" : "var(--bg-card)",
                color: active ? "#000" : "var(--text-2)",
                border: `1px solid ${active ? "var(--cyan)" : "var(--border)"}`,
                transition: "all 0.15s ease",
              }}
            >
              {t === "formula" ? "Formula Engine" : "Data Grid"}
            </button>
          );
        })}
      </div>

      {/* ── FORMULA TAB ─────────────────────────────────────────────────── */}
      {tab === "formula" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left: formula bar + palette + history */}
          <div className="lg:col-span-2" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Formula bar */}
            <SectionCard title="Formula Bar" subtitle="Type a formula or prefix with AI: for plain English" delay={0.04}>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  type="text"
                  value={formula}
                  onChange={(e) => setFormula(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") runFormula(); }}
                  placeholder="SUM(revenue)   ·   GROWTH(profit)   ·   AI: What drove my best month?"
                  disabled={loading}
                  autoFocus
                  style={{
                    flex: 1,
                    color: "var(--text-1)",
                    border: "1px solid var(--border)",
                    background: "var(--bg-page)",
                    fontSize: 'var(--fs-body)',
                    padding: "12px 14px",
                    borderRadius: 10,
                    outline: "none",
                  }}
                />
                <button
                  onClick={runFormula}
                  disabled={!formula.trim() || loading}
                  style={{
                    padding: "0 22px",
                    borderRadius: 10,
                    fontSize: 'var(--fs-body)',
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    background: formula.trim() && !loading ? "var(--cyan)" : "var(--bg-page)",
                    color: formula.trim() && !loading ? "#000" : "var(--text-3)",
                    border: "1px solid var(--border)",
                    cursor: formula.trim() && !loading ? "pointer" : "not-allowed",
                    transition: "all 0.15s ease",
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
                    style={{
                      marginTop: 10,
                      fontSize: 'var(--fs-label)',
                      padding: "8px 12px",
                      borderRadius: 8,
                      overflow: "hidden",
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.25)",
                      color: "var(--crit)",
                    }}
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Column chips */}
              {availCols.length > 0 && (
                <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 'var(--fs-label)', color: "var(--text-3)" }}>
                    COLUMNS
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
                      style={{
                        fontSize: 'var(--fs-label)',
                        padding: "3px 9px",
                        borderRadius: 6,
                        background: "var(--cyan-dim)",
                        color: "var(--cyan)",
                        border: "1px solid rgba(0,212,255,0.18)",
                        cursor: "pointer",
                      }}
                    >
                      {col}
                    </button>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* Formula palette */}
            <SectionCard title="Formula Palette" subtitle="Click a function to load an example" delay={0.08}>
              <div className="grid grid-cols-2 sm:grid-cols-3" style={{ gap: 10 }}>
                {PALETTE.map((item) => (
                  <button
                    key={item.fn}
                    onClick={() => setFormula(item.example)}
                    style={{
                      textAlign: "left",
                      padding: "13px 14px",
                      borderRadius: 10,
                      background: "var(--bg-page)",
                      border: "1px solid var(--border)",
                      cursor: "pointer",
                      transition: "border-color 0.15s ease",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = item.color; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
                  >
                    <div style={{ fontSize: 'var(--fs-data)', fontWeight: 700, marginBottom: 4, color: item.color }}>
                      {item.fn}
                    </div>
                    <div style={{ fontSize: 'var(--fs-label)', lineHeight: 1.4, color: "var(--text-3)" }}>
                      {item.desc}
                    </div>
                  </button>
                ))}
              </div>
            </SectionCard>

            {/* Result history */}
            {history.length > 0 && (
              <SectionCard title="History" delay={0.1} action={
                <button
                  onClick={() => setHistory([])}
                  style={{ fontSize: 'var(--fs-label)', color: "var(--text-3)", cursor: "pointer", background: "none", border: "none" }}
                >
                  Clear
                </button>
              }>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <AnimatePresence>
                    {history.map((h, i) => (
                      <motion.div
                        key={h.id}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{
                          padding: "12px 0",
                          borderTop: i > 0 ? "1px solid var(--border)" : "none",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                              <span
                                style={{
                                  fontSize: 'var(--fs-label)',
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  background: h.mode === "ai" ? "var(--cyan-dim)" : "var(--bg-page)",
                                  color: h.mode === "ai" ? "var(--cyan)" : "var(--text-3)",
                                  border: "1px solid var(--border)",
                                }}
                              >
                                {h.mode.toUpperCase()}
                              </span>
                              <code style={{ fontSize: 'var(--fs-label)', color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {h.formula}
                              </code>
                            </div>
                            {h.insight && (
                              <p style={{ fontSize: 'var(--fs-label)', lineHeight: 1.45, color: "var(--text-2)", margin: "0 0 4px" }}>
                                {h.insight}
                              </p>
                            )}
                            <button
                              onClick={() => setFormula(h.formula)}
                              style={{ fontSize: 'var(--fs-label)', color: "var(--text-3)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                            >
                              ↺ reuse
                            </button>
                          </div>
                          <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700, flexShrink: 0, color: resultColor(h.result) }}>
                            {formatResult(h.result)}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </SectionCard>
            )}
          </div>

          {/* Right: quick stats + AI tip / empty state */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {hasData && (
              <SectionCard title="Quick Stats" delay={0.12}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[
                    { label: "Total Revenue",  value: formatCurrency(totRev),    color: "var(--cyan)" },
                    { label: "Total Costs",    value: formatCurrency(totCost),   color: "var(--warn)" },
                    { label: "Total Profit",   value: formatCurrency(totProfit), color: totProfit >= 0 ? "var(--good)" : "var(--crit)" },
                    { label: "Avg Margin",     value: `${avgMargin.toFixed(1)}%`, color: avgMargin >= 0 ? "var(--good)" : "var(--crit)" },
                    { label: "Best Month",     value: bestRev ? bestRev.month : "—", color: "var(--text-2)" },
                    { label: "Best Revenue",   value: bestRev ? formatCurrency(bestRev.revenue) : "—", color: "var(--cyan)" },
                  ].map((stat) => (
                    <div key={stat.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 'var(--fs-data)', color: "var(--text-3)" }}>
                        {stat.label}
                      </span>
                      <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: stat.color }}>
                        {stat.value}
                      </span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* AI formula tip */}
            <div
              className="section-card"
              style={{ background: "rgba(0,212,255,0.03)", borderColor: "rgba(0,212,255,0.15)" }}
            >
              <h3 style={{ fontSize: 'var(--fs-label)', fontWeight: 600, marginBottom: 8, color: "var(--cyan)", letterSpacing: "0.06em" }}>
                AI FORMULA TIP
              </h3>
              <p style={{ fontSize: 'var(--fs-data)', lineHeight: 1.55, marginBottom: 14, color: "var(--text-2)" }}>
                Prefix any question with{" "}
                <code style={{ color: "var(--cyan)" }}>AI:</code>{" "}
                to ask in plain English instead of formula syntax.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {AI_EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setFormula(ex)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      fontSize: 'var(--fs-label)',
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: "var(--bg-card)",
                      color: "var(--text-3)",
                      border: "1px solid var(--border)",
                      cursor: "pointer",
                    }}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            {!hasData && (
              <div
                className="section-card"
                style={{ background: "rgba(245,158,11,0.05)", borderColor: "rgba(245,158,11,0.2)", textAlign: "center" }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ margin: "0 auto 8px" }}>
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"
                    stroke="var(--warn)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p style={{ fontSize: 'var(--fs-data)', fontWeight: 600, color: "var(--warn)", margin: "0 0 4px" }}>
                  No data loaded
                </p>
                <p style={{ fontSize: 'var(--fs-label)', color: "var(--text-3)", margin: 0 }}>
                  Upload a financial file on the dashboard to run formulas on real data.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── DATA GRID TAB ──────────────────────────────────────────────── */}
      {tab === "grid" && (
        <SectionCard title="Data Grid" subtitle={hasData ? `${rows.length} periods` : undefined} delay={0.04} style={{ padding: 0, overflow: "hidden" }}>
          {!hasData ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 260, gap: 10, padding: 24 }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="var(--text-4)" strokeWidth="1.5"/>
                <path d="M3 9h18M3 15h18M9 3v18M15 3v18" stroke="var(--text-4)" strokeWidth="1.5"/>
              </svg>
              <p style={{ color: "var(--text-3)", fontSize: 'var(--fs-body)', margin: 0 }}>
                No data — upload a financial file to populate the grid.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--bg-page)", borderBottom: "1px solid var(--border)" }}>
                    {["#", "Period", "Revenue", "Costs", "Profit", "Margin"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "12px 16px",
                          fontSize: 'var(--fs-label)',
                          fontWeight: 600,
                          textAlign: h === "#" || h === "Period" ? "left" : "right",
                          color: "var(--text-3)",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={`${row.month}-${i}`}
                      style={{ borderBottom: "1px solid var(--border)" }}
                    >
                      <td style={{ padding: "11px 16px", fontSize: 'var(--fs-label)', color: "var(--text-3)" }}>
                        {i + 1}
                      </td>
                      <td style={{ padding: "11px 16px", fontSize: 'var(--fs-body)', fontWeight: 600, color: "var(--text-1)" }}>
                        {row.month}
                      </td>
                      <td style={{ padding: "11px 16px", textAlign: "right", fontSize: 'var(--fs-data)', color: "var(--cyan)" }}>
                        {formatCurrency(row.revenue)}
                      </td>
                      <td style={{ padding: "11px 16px", textAlign: "right", fontSize: 'var(--fs-data)', color: "var(--warn)" }}>
                        {formatCurrency(row.costs)}
                      </td>
                      <td style={{ padding: "11px 16px", textAlign: "right", fontSize: 'var(--fs-data)', fontWeight: 600, color: row.profit >= 0 ? "var(--good)" : "var(--crit)" }}>
                        {formatCurrency(row.profit)}
                      </td>
                      <td style={{ padding: "11px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                          <div
                            style={{
                              width: `${Math.min(Math.abs(row.margin), 60) * 1.2}px`,
                              height: 4,
                              borderRadius: 2,
                              maxWidth: 72,
                              background:
                                row.margin >= 25 ? "var(--good)" : row.margin >= 12 ? "var(--warn)" : "var(--crit)",
                            }}
                          />
                          <span
                            style={{
                              fontSize: 'var(--fs-label)',
                              minWidth: 44,
                              textAlign: "right",
                              color: row.margin >= 25 ? "var(--good)" : row.margin >= 12 ? "var(--warn)" : "var(--crit)",
                            }}
                          >
                            {row.margin.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "var(--bg-page)", borderTop: "2px solid var(--border)" }}>
                    <td colSpan={2} style={{ padding: "13px 16px", fontSize: 'var(--fs-label)', fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Totals / Avg
                    </td>
                    <td style={{ padding: "13px 16px", textAlign: "right", fontSize: 'var(--fs-data)', fontWeight: 700, color: "var(--cyan)" }}>
                      {formatCurrency(totRev)}
                    </td>
                    <td style={{ padding: "13px 16px", textAlign: "right", fontSize: 'var(--fs-data)', fontWeight: 700, color: "var(--warn)" }}>
                      {formatCurrency(totCost)}
                    </td>
                    <td style={{ padding: "13px 16px", textAlign: "right", fontSize: 'var(--fs-data)', fontWeight: 700, color: totProfit >= 0 ? "var(--good)" : "var(--crit)" }}>
                      {formatCurrency(totProfit)}
                    </td>
                    <td style={{ padding: "13px 16px", textAlign: "right", fontSize: 'var(--fs-data)', fontWeight: 700, color: "var(--good)" }}>
                      {`${avgMargin.toFixed(1)}%`}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}
