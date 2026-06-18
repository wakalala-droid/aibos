# AI-BOS — Adaptive Function Governance (the Safeguard)

**Status:** v0.1 design + Layer 1 implemented. **Owner:** vwanheda@gmail.com
**Purpose:** let AI-BOS understand any uploaded file, feed each engine accurately, and *grow new functions from real data* — **without ever silently misreading data or changing the core engines.**

This is the binding contract for any file-driven extension. Nothing that touches the
core (`engine.py`, `engine2.py`, `engine3.py`, `intelligence.py`) is added without
passing every gate below **and** an explicit human approval.

---

## 0. Non-negotiable principles

1. **No fabrication.** The system never invents a dimension it doesn't have. If a file
   has no time column, it must NOT produce a "forecast" over non-time rows. It says so.
2. **Provenance + confidence on every reading.** Every column AI-BOS uses is shown to the
   user with what it was mapped to and how confident the mapping is. (Mirrors the proposal's
   risk mitigation: *"show confidence intervals, allow human override, start conservative."*)
3. **Core immutability.** AI-proposed functions are **additive** and **isolated**. They can
   never modify, override, or import the internals of a core engine.
4. **Propose, never auto-apply.** The AI emits *proposals as data*, not running code in prod.
5. **Human-in-the-loop.** No proposal becomes a product feature without the owner's approval.
6. **Reversible.** Every approved extension is versioned, feature-flagged, and removable.

---

## 1. The pipeline

```
upload ──► (1) READ-FIDELITY ──► (2) ROUTE ──► engines ──► output + manifest
                  │
                  └─ unmet need? ─► (3) PROPOSAL ─► (4) CRITIQUE GATE ─► (5) REVIEW QUEUE ─► owner ─► implement
```

### (1) Read-fidelity layer  *(Layer 1 — implemented in `aibos-api`)*
Before any engine runs, build a **manifest**:
- `columns[]`: each column → `{ role, confidence, sample, reason }` where `role ∈
  {revenue, cost, profit, margin, units, price, unit_cost, item, category, period,
  customer, multiplier, demand, unknown}`.
- `data_shape`: `time_series` (a real period column) or `cross_sectional` (rows are
  items/scenarios, not time).
- `flags[]`: human-readable honesty notes, e.g. *"No date/period column — trends and
  forecasts are unavailable; add a Month column to unlock them."*
- `unknown_columns[]`: columns AI-BOS couldn't confidently map → candidates for a proposal.
- `grouping_column`: a repeated categorical key (e.g. `Flower Type`) → enables per-item
  breakdown.

The manifest is returned with every analysis and surfaced as **"How AI-BOS read your file."**

### (2) Routing
- A file may feed **more than one engine**. A flat item-level financial model feeds
  **E3** (per-item unit economics) *and* **E1** (point-in-time P&L) — never one at the
  expense of the other.
- `cross_sectional` data must not be sent through the time-series forecaster as if it
  were periods.

### (3) Proposal  *(Layer 2 — governed, not yet enabled in prod)*
When the manifest has `unknown_columns` or an analytical need no engine covers, the AI may
emit a **Function Proposal** (pure data, schema in §2):
- `name`, `purpose` (plain English), `inputs` (named columns only),
- `formula` — a **restricted expression** over input columns (a safe DSL, **never** raw
  Python/`eval`),
- `preview` — computed in the sandbox on *this file only*,
- `extends_engine`, `confidence`, `citations[]` (if it used web/benchmark data),
- `assumptions[]`, `risks[]`.

### (4) Critique Gate — *intense scrutiny*
Every proposal must pass **all**:
| Check | What it enforces |
|---|---|
| **Sandbox** | Formula runs isolated: no network, no DB, no filesystem, CPU/mem/time-boxed, only the uploaded columns. |
| **Anti-hallucination** | Every output value must be traceable to real input columns; no constants pulled from nowhere. |
| **Core-immutability** | Static check: proposal cannot import/modify `engine*.py`; lives in `extensions/` with a fixed read-only interface. |
| **Critic LLM** | A second model scores it against a rubric: real need? math correct? could it mislead? duplicate of existing? |
| **Provenance** | Must carry confidence + citations for any external benchmark. |

A proposal that fails any check never reaches the owner as "ready."

### (5) Review queue + approval
Passing proposals land in an **owner-only review queue** with: plain-English explanation,
benefits, risks, the sandbox preview, and the critic's verdict. Owner → approve / reject /
revise. **Only on approval** is it promoted from sandbox extension → reviewed code →
implemented through the normal `next build` gate (still by a human).

---

## 2. Data shapes (contracts)

```ts
// Read-fidelity manifest (returned with every upload)
interface DataManifest {
  data_shape: 'time_series' | 'cross_sectional';
  columns: { name: string; role: string; confidence: number; reason: string }[];
  flags: string[];
  unknown_columns: string[];
  grouping_column: string | null;
}

// Function Proposal (Layer 2 — stored, reviewed, never auto-run in prod)
interface FunctionProposal {
  id: string;
  name: string;
  purpose: string;
  extends_engine: 'engine1' | 'engine2' | 'engine3' | 'engine4' | 'engine5';
  inputs: string[];             // column names only
  formula: string;             // restricted DSL, validated before storage
  preview: Record<string, unknown>;
  confidence: number;          // 0..1
  citations: string[];
  assumptions: string[];
  risks: string[];
  critique: { passed: boolean; checks: Record<string, boolean>; critic_notes: string };
  status: 'proposed' | 'approved' | 'rejected' | 'implemented';
  created_at: string;
}
```

---

## 3. What is explicitly OUT of scope (for safety)
- No execution of arbitrary AI-generated Python in production. Extensions are **derived
  metrics over named columns**, computed by a restricted evaluator.
- No proposal may write to other tenants' data or the shared DB.
- No automatic schema changes to core tables.

---

## 4. Implementation status
- **Layer 1 (read-fidelity manifest + honest no-forecast + per-item breakdown):** implemented
  in `aibos-api` (`_build_manifest`, `_detect_data_shape`, additive `manifest`/`breakdown`
  on `/upload`). Existing time-series files are unchanged.
- **Layer 2 (proposal + critique gate + review queue):** specified here; implemented behind
  an owner-only flag, preview-only, in a later increment.
