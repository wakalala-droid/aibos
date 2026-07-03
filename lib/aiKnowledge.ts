// lib/aiKnowledge.ts — AI-BOS assistant knowledge base.
//
// This is the "pre-recorded dataset" that lets the floating assistant answer the
// most common questions WITHOUT hitting the Grok backend:
//   1. Component explanations  — long-press any tile → what it is + why it matters.
//   2. Glossary definitions    — "what is net margin?", "explain RFM".
//   3. Direct metric lookups   — "what's my total revenue?" → read live store value.
//
// Only open-ended reasoning ("what drove the cost spike?", "what should I do
// about churn?") falls through to the API. Everything here is deterministic and
// always accurate against the numbers actually on screen — no fabrication.

// ── Live metrics snapshot ───────────────────────────────────────────────────
// The assistant builds this from the Zustand store (it has fmt + currency); the
// knowledge base stays dependency-free and just reads pre-shaped values.

export interface Money { raw: number; fmt: string }

export interface LiveMetrics {
  currency: string;
  hasFinancial: boolean;
  hasCustomer: boolean;
  hasOps: boolean;
  // Engine 1 · Financial
  revenue?: Money;
  costs?: Money;
  profit?: Money;
  margin?: number;          // percent
  healthScore?: number;
  healthLabel?: string;
  monthsCount?: number;
  // Cross-engine scores
  overallScore?: number;
  overallLabel?: string;
  e1Score?: number;
  e2Score?: number;
  e3Score?: number;
  // Engine 2 · Customer
  champions?: number;
  highChurn?: number;
  retentionRate?: number;
  customersCount?: number;
  // Engine 3 · Operations
  netRevenue?: Money;
  drinkAttach?: number;
  benchmarksWarn?: number;
  topSeller?: string;
  productsCount?: number;
  // Digital Twin — live business state folded from recorded events (the spine).
  // Present whenever the user has recorded activity, even with no file uploaded.
  hasTwin: boolean;
  eventCount?: number;
  cash?: Money;
  inventoryValue?: Money;
  receivables?: Money;
  payables?: Money;
  suppliersCount?: number;
  employeesCount?: number;
}

// ── Component / metric documentation ────────────────────────────────────────

export interface ComponentDoc {
  id: string;
  /** Human title shown as the explanation heading. */
  title: string;
  /** What the component / metric is. */
  what: string;
  /** Why it matters to the business owner. */
  why: string;
  /** How it's derived or calculated (optional). */
  how?: string;
  /** A one-liner that weaves in the current value, when data is loaded. */
  live?: (lv: LiveMetrics) => string | null;
  /** Follow-up questions to suggest after explaining. */
  followups?: string[];
}

const pct = (v?: number) => (v === undefined ? null : `${v.toFixed(1)}%`);

export const COMPONENT_KNOWLEDGE: Record<string, ComponentDoc> = {
  // ── KPI cards ─────────────────────────────────────────────────────────────
  'kpi.revenue': {
    id: 'kpi.revenue',
    title: 'Total Revenue',
    what: 'The total money your business took in across the period in your uploaded data — every sale, before any costs are removed.',
    why: 'Revenue is the top line of everything. It sets the ceiling for profit and is the first signal of whether demand for what you sell is growing or shrinking.',
    how: 'Summed from the revenue column of your file. The ▲/▼ badge compares the latest month to the one before it; the sparkline traces the last 6 months.',
    live: (lv) => (lv.revenue ? `Right now your total revenue reads ${lv.revenue.fmt}.` : null),
    followups: ['What drove my revenue trend?', "What's my revenue forecast?"],
  },
  'kpi.costs': {
    id: 'kpi.costs',
    title: 'Total Costs',
    what: 'Everything it cost to run the business over the period — the spending side of your data.',
    why: "Costs decide how much of your revenue you actually keep. Watching them is how you protect margin; a cost line rising faster than revenue is the earliest warning of trouble.",
    how: 'Summed from the cost column of your file. Here, rising costs show a red badge (up is bad), unlike revenue where up is good.',
    live: (lv) => (lv.costs ? `Your total costs currently read ${lv.costs.fmt}.` : null),
    followups: ['What drove my cost trend?', 'Which months had the biggest cost spikes?'],
  },
  'kpi.profit': {
    id: 'kpi.profit',
    title: 'Net Profit',
    what: 'What is left after costs are taken out of revenue — the money the business actually made.',
    why: 'Profit is the number that keeps you in business. Revenue can grow while profit falls; this card tells you which way the part that matters is moving.',
    how: 'Net Profit = Total Revenue − Total Costs, summed across the period.',
    live: (lv) => (lv.profit ? `Your net profit currently reads ${lv.profit.fmt}.` : null),
    followups: ['How can I improve my profit?', "What's hurting my profit most?"],
  },
  'kpi.margin': {
    id: 'kpi.margin',
    title: 'Average Net Margin',
    what: 'The share of every Kwacha of revenue you keep as profit, averaged across the period — shown as a percentage.',
    why: 'Margin is the quality of your revenue. Two businesses can earn the same revenue; the one with the higher margin is healthier and survives downturns better. Margin moves in percentage points, not percent.',
    how: 'Net Margin = (Revenue − Costs) ÷ Revenue, averaged over the months in your file.',
    live: (lv) => (lv.margin !== undefined ? `Your average net margin is ${pct(lv.margin)}.` : null),
    followups: ['Why did my margin change?', 'Is my margin healthy for my industry?'],
  },

  // ── Engine score strip ──────────────────────────────────────────────────────
  'score.overall': {
    id: 'score.overall',
    title: 'Health Score',
    what: 'A single 0–100 score summarising the overall health of your business across every engine that has data.',
    why: "It's the one number to glance at first. Instead of reading ten charts, you get a verdict — and a colour (green / amber / red) telling you whether to relax or act.",
    how: 'Synthesised from your Financial, Customer and Operations signals. 75+ is strong (green), 50–74 needs attention (amber), below 50 is a warning (red).',
    live: (lv) => (lv.overallScore !== undefined ? `Your health score is ${lv.overallScore}${lv.overallLabel ? ` — ${lv.overallLabel}` : ''}.` : null),
    followups: ['What is dragging my health score down?', 'How do I raise my score?'],
  },
  'score.e1': {
    id: 'score.e1',
    title: 'Financial Engine Score',
    what: 'A 0–100 score for the financial side of your business: cash, forecast and profit & loss.',
    why: 'It isolates how your money is doing from your customers and operations, so you know which part of the business needs work.',
    live: (lv) => (lv.e1Score !== undefined ? `Your Financial engine score is ${lv.e1Score}.` : null),
    followups: ["What's my cash runway?", 'Show me my P&L trend'],
  },
  'score.e2': {
    id: 'score.e2',
    title: 'Customer Intelligence Score',
    what: 'A 0–100 score for your customer base — built from RFM segments, lifetime value and churn risk.',
    why: 'Keeping customers is cheaper than winning new ones. This score tells you whether your customer relationships are an asset or a leak.',
    live: (lv) => (lv.e2Score !== undefined ? `Your Customer engine score is ${lv.e2Score}.` : null),
    followups: ['Who are my best customers?', 'How many customers are at churn risk?'],
  },
  'score.e3': {
    id: 'score.e3',
    title: 'Operations Score',
    what: 'A 0–100 score for operations — point-of-sale performance, item velocity and how you compare to benchmarks.',
    why: 'It shows whether your day-to-day selling is efficient, where attach and upsell are leaking, and how you stack up against industry targets.',
    live: (lv) => (lv.e3Score !== undefined ? `Your Operations engine score is ${lv.e3Score}.` : null),
    followups: ['Which products sell best?', 'How is my drink attach rate?'],
  },

  // ── Charts & section cards ─────────────────────────────────────────────────
  'chart.revenue': {
    id: 'chart.revenue',
    title: 'Revenue Intelligence Chart',
    what: 'A month-by-month view of your revenue and profit over the last six months of data.',
    why: 'Trends tell stories single numbers hide — a steady climb, a seasonal dip, or the month a cost shock ate into profit. The gap between the two lines is your margin, visualised.',
    how: 'Plotted from your monthly file. Revenue is the upper line; Profit is Revenue minus Costs. It only appears for time-series data, never for item-level files where a time line would mislead.',
    followups: ['Which month performed best?', "What's my revenue forecast?"],
  },
  'card.customer': {
    id: 'card.customer',
    title: 'Customer Intelligence',
    what: 'A snapshot of your customer base: how many are champions, how many are at high churn risk, and your retention rate.',
    why: 'Your most loyal customers usually drive most of your profit. This card flags both the ones to nurture and the ones quietly slipping away.',
    live: (lv) =>
      lv.hasCustomer && lv.champions !== undefined
        ? `You currently have ${lv.champions} champion customer${lv.champions === 1 ? '' : 's'} and ${lv.highChurn ?? 0} at high churn risk.`
        : null,
    followups: ['How do I keep my champions?', 'Who is about to churn?'],
  },
  'card.operations': {
    id: 'card.operations',
    title: 'Operations',
    what: 'A snapshot of operational performance — net revenue, drink/side attach rates and how many benchmarks are below target.',
    why: 'Operations is where margin is won or lost at the till. Attach rate and benchmark gaps are some of the fastest levers a small business has to lift profit without new customers.',
    live: (lv) =>
      lv.hasOps && lv.drinkAttach !== undefined
        ? `Your drink attach rate is ${pct(lv.drinkAttach)}${lv.benchmarksWarn ? `, with ${lv.benchmarksWarn} benchmark${lv.benchmarksWarn === 1 ? '' : 's'} below target` : ''}.`
        : null,
    followups: ['How do I lift my attach rate?', 'Which benchmarks am I missing?'],
  },
  'card.unifiedIntelligence': {
    id: 'card.unifiedIntelligence',
    title: 'Unified Engine Intelligence',
    what: 'AI-synthesised insights drawn across all three engines at once — Financial, Customer and Operations — ranked by priority.',
    why: "This is where AI-BOS connects dots a human would miss: e.g. a margin dip explained by a churn spike in your best segment. It's the cross-engine reasoning that single dashboards can't give you.",
    how: 'Real cross-engine insights are used when two or more engines have data; otherwise signals are derived from whichever engine is loaded. High-priority items always surface first.',
    followups: ['What is my single most urgent action?', 'Give me the full brief'],
  },
  'card.executiveBrief': {
    id: 'card.executiveBrief',
    title: 'Executive Action Plan',
    what: 'A short, ranked list of the concrete actions AI-BOS recommends right now, drawn from your unified intelligence brief.',
    why: 'Insight without action is just trivia. This turns everything the engines found into a prioritised to-do list you can act on today.',
    followups: ['Why is this the top action?', 'Open the full brief'],
  },
  'card.upload': {
    id: 'card.upload',
    title: 'Upload & Analyse',
    what: 'Where you bring data in — a CSV or Excel file with month, revenue and cost columns, or a POS / customer export.',
    why: "Everything on this dashboard comes from what you upload. The more engines you feed (financial, customer, operations), the more cross-engine intelligence AI-BOS can give you.",
    followups: ['What file format do you need?', 'What columns should my file have?'],
  },
  'card.quickAccess': {
    id: 'card.quickAccess',
    title: 'Quick Access',
    what: 'Shortcuts into the deeper intelligence pages — Customer, POS, Benchmarks, Churn and the unified brief.',
    why: 'The overview is the summary; these links take you to the detailed analysis behind each headline number.',
  },
  'card.alerts': {
    id: 'card.alerts',
    title: 'Active Alerts',
    what: 'Variance and anomaly flags AI-BOS has raised — unusual movements in your numbers that are worth a look.',
    why: 'These are the things you would want someone to tap you on the shoulder about: a cost that jumped, a month that broke pattern. Catching them early is the whole point.',
    followups: ['What caused this alert?', 'Show me my anomalies'],
  },
  'card.dataManifest': {
    id: 'card.dataManifest',
    title: 'How AI-BOS Read Your File',
    what: 'A transparent breakdown of how AI-BOS interpreted each column of your upload — what it thinks each one means and how confident it is.',
    why: "Trust comes from showing the work. Before you rely on a single number, this card lets you confirm AI-BOS read your file the way you intended.",
  },
};

// ── Glossary (definitional matching) ────────────────────────────────────────
// Each term maps synonyms → a plain-language definition, optionally linked to a
// metric resolver so a definition can end with the user's live figure.

interface GlossaryEntry {
  keys: string[];
  term: string;
  def: string;
  metric?: keyof typeof METRIC_RESOLVERS;
}

const METRIC_RESOLVERS = {
  revenue: (lv: LiveMetrics) => (lv.revenue ? `Yours currently reads ${lv.revenue.fmt}.` : null),
  costs: (lv: LiveMetrics) => (lv.costs ? `Yours currently reads ${lv.costs.fmt}.` : null),
  profit: (lv: LiveMetrics) => (lv.profit ? `Yours currently reads ${lv.profit.fmt}.` : null),
  margin: (lv: LiveMetrics) => (lv.margin !== undefined ? `Yours is ${pct(lv.margin)}.` : null),
  health: (lv: LiveMetrics) => (lv.overallScore !== undefined ? `Yours is ${lv.overallScore}${lv.overallLabel ? ` (${lv.overallLabel})` : ''}.` : null),
  retention: (lv: LiveMetrics) => (lv.retentionRate !== undefined ? `Yours is ${pct(lv.retentionRate)}.` : null),
  churn: (lv: LiveMetrics) => (lv.highChurn !== undefined ? `You have ${lv.highChurn} customer${lv.highChurn === 1 ? '' : 's'} at high churn risk.` : null),
  attach: (lv: LiveMetrics) => (lv.drinkAttach !== undefined ? `Your drink attach is ${pct(lv.drinkAttach)}.` : null),
  cash: (lv: LiveMetrics) => (lv.cash ? `Your cash right now is ${lv.cash.fmt}.` : null),
  inventoryValue: (lv: LiveMetrics) => (lv.inventoryValue ? `Your stock on hand is worth ${lv.inventoryValue.fmt}.` : null),
  receivables: (lv: LiveMetrics) => (lv.receivables ? `Customers currently owe you ${lv.receivables.fmt}.` : null),
  payables: (lv: LiveMetrics) => (lv.payables ? `You currently owe suppliers ${lv.payables.fmt}.` : null),
} satisfies Record<string, (lv: LiveMetrics) => string | null>;

const GLOSSARY: GlossaryEntry[] = [
  { keys: ['net margin', 'profit margin', 'margin'], term: 'Net margin', metric: 'margin',
    def: 'Net margin is the percentage of revenue you keep as profit — (Revenue − Costs) ÷ Revenue. It measures the quality of your revenue, not just its size.' },
  { keys: ['revenue', 'turnover', 'top line', 'sales total'], term: 'Revenue', metric: 'revenue',
    def: 'Revenue is the total money your business takes in from sales before any costs are subtracted. It is the top line of your P&L.' },
  { keys: ['net profit', 'profit', 'bottom line', 'earnings'], term: 'Net profit', metric: 'profit',
    def: 'Net profit is what remains after all costs are removed from revenue — the money the business actually made.' },
  { keys: ['cost', 'costs', 'expenses', 'spending'], term: 'Costs', metric: 'costs',
    def: 'Costs are everything it takes to run the business over the period. They determine how much of your revenue you keep.' },
  { keys: ['health score', 'health', 'overall score'], term: 'Health score', metric: 'health',
    def: 'The health score is a single 0–100 verdict on your whole business, synthesised across Financial, Customer and Operations. 75+ is strong, 50–74 needs attention, below 50 is a warning.' },
  { keys: ['rfm', 'recency frequency monetary'], term: 'RFM',
    def: 'RFM segments customers by Recency (how recently they bought), Frequency (how often) and Monetary value (how much). It sorts your base into groups like Champions, Loyal and At-Risk so you know who to focus on.' },
  { keys: ['clv', 'ltv', 'lifetime value', 'customer lifetime value'], term: 'CLV',
    def: 'CLV (Customer Lifetime Value) estimates the total profit a customer brings over their whole relationship with you. It tells you how much you can afford to spend keeping them.' },
  { keys: ['churn', 'churn risk', 'attrition'], term: 'Churn', metric: 'churn',
    def: 'Churn is customers who stop buying from you. Churn risk scores how likely each customer is to leave, so you can intervene before they go.' },
  { keys: ['retention', 'retention rate'], term: 'Retention rate', metric: 'retention',
    def: 'Retention rate is the share of customers who keep coming back. High retention is usually cheaper and more profitable than constantly winning new customers.' },
  { keys: ['attach rate', 'attach', 'upsell rate'], term: 'Attach rate', metric: 'attach',
    def: 'Attach rate is how often an add-on (like a drink with a meal) is sold alongside a main item. Lifting it raises revenue per order without needing new customers.' },
  { keys: ['benchmark', 'benchmarks', 'industry target'], term: 'Benchmarks',
    def: 'Benchmarks compare your metrics against industry targets (e.g. QSR norms), so you can see where you are ahead and where you are leaving money on the table.' },
  { keys: ['runway', 'cash runway'], term: 'Cash runway',
    def: 'Cash runway is how many months your business can keep operating at the current burn rate before cash runs out. It is the single most important survival number for a small business.' },
  { keys: ['breakeven', 'break even', 'break-even'], term: 'Breakeven',
    def: 'Breakeven is the revenue level where you exactly cover your costs — below it you lose money, above it you profit. It tells you the minimum you must sell.' },
  { keys: ['anomaly', 'anomalies'], term: 'Anomaly',
    def: 'An anomaly is a number that breaks your normal pattern — an unusual spike or drop. AI-BOS flags them so genuine problems and opportunities do not slip past unnoticed.' },
  { keys: ['variance'], term: 'Variance',
    def: 'Variance is the gap between what you expected and what actually happened. Tracking it shows whether your business is drifting off plan and by how much.' },
  { keys: ['forecast', 'projection'], term: 'Forecast',
    def: 'A forecast projects where your numbers are heading based on recent trends, so you can plan cash, stock and staffing before the future arrives.' },
  { keys: ['champion', 'champions'], term: 'Champions',
    def: 'Champions are your best customers — recent, frequent and high-spending. They typically drive a large share of profit and are the group most worth protecting.' },
  // Digital Twin terms — answered from recorded events, no file needed.
  { keys: ['cash on hand', 'cash balance', 'cash position', 'money in the till', 'bank balance', 'cash'], term: 'Cash', metric: 'cash',
    def: 'Cash is the money your business is holding right now. Every event you record — a sale, an expense, a supplier payment — moves it up or down from your opening balance.' },
  { keys: ['stock value', 'inventory value', 'stock on hand', 'inventory', 'stock'], term: 'Stock on hand', metric: 'inventoryValue',
    def: 'Stock on hand is the value of the goods you currently hold to sell. It grows when you receive stock and shrinks as you sell, so it tells you how much money is sitting on your shelves.' },
  { keys: ['owes me', 'owe me', 'receivables', 'receivable', 'debtors', 'customers owe'], term: 'Receivables', metric: 'receivables',
    def: 'Receivables is money customers owe you — sales you have made but not yet been paid for. The faster you collect it, the healthier your cash.' },
  { keys: ['i owe', 'we owe', 'payables', 'payable', 'creditors'], term: 'Payables', metric: 'payables',
    def: 'Payables is money you owe suppliers — goods or services you have received but not yet paid for. Tracking it stops due dates from surprising your cash.' },
];

// ── Local answer engine ─────────────────────────────────────────────────────

export function getComponentDoc(id: string): ComponentDoc | undefined {
  return COMPONENT_KNOWLEDGE[id];
}

/** Build the explanation text for a long-pressed component. */
export function renderExplanation(doc: ComponentDoc, lv?: LiveMetrics): string {
  const parts = [`**${doc.title}**`, '', doc.what, '', `**Why it matters:** ${doc.why}`];
  if (doc.how) parts.push('', `**How it's worked out:** ${doc.how}`);
  const liveLine = lv && doc.live ? doc.live(lv) : null;
  if (liveLine) parts.push('', `📊 ${liveLine}`);
  return parts.join('\n');
}

const has = (q: string, ...terms: string[]) => terms.some((t) => q.includes(t));

/**
 * Try to answer a typed question entirely from local knowledge.
 * Returns the answer string, or null when the question needs the Grok API
 * (open-ended reasoning, "why did X happen", "what should I do").
 */
export function localAnswer(rawQuery: string, lv: LiveMetrics): string | null {
  const q = rawQuery.toLowerCase().trim().replace(/[?!.]+$/, '');
  if (!q) return null;

  // Greetings & capability questions — always local.
  if (/^(hi|hey|hello|yo|hiya|good (morning|afternoon|evening))\b/.test(q)) {
    return "Hello! I'm your AI-BOS assistant. I can explain anything on your dashboard, define any term, and pull up your live numbers. Long-press any card to have me break it down — or just ask.";
  }
  if (has(q, 'what can you do', 'how do you work', 'who are you', 'what are you', 'how can you help', 'help me')) {
    return "I'm built into your AI-BOS dashboard. I can:\n\n• **Answer business questions** — “how much cash do I have?”, “what's my current inventory?”, “how much did I make today?”.\n• **Explain any component** — long-press a card and I'll tell you what it is and why it matters.\n• **Define any term** — ask “what is net margin?” or “explain RFM”.\n• **Reason across your data** — deeper “why” and “what should I do” questions go to the full AI CFO.";
  }

  // How to upload / add data — always useful, answered locally.
  if (has(q, 'upload', 'import', 'add data', 'add my data', 'load data', 'load my data', 'attach a file', 'attach data', 'bring in data', 'how do i add my', 'where do i put my')) {
    return UPLOAD_HOWTO;
  }

  // How to record activity — the everyday path, answered locally.
  if (has(q, 'how do i record', 'how to record', 'record a sale', 'record a purchase', 'record an expense', 'record activity', 'log a sale', 'log an expense')) {
    return RECORD_HOWTO;
  }

  // Open-ended reasoning belongs to the API, even if it mentions a known term.
  const isReasoning = /\b(why|how come|what (drove|caused|happened)|what should|what would|recommend|advice|should i|how (do|can) i (improve|fix|increase|reduce|grow|lift)|predict|forecast|will|going to)\b/.test(q);

  // Definitional intent → answer from glossary.
  const isDefinition = /\b(what (is|are|does|do)|what's|whats|define|definition|meaning of|explain|tell me about)\b/.test(q);
  // Direct value lookup intent.
  const isLookup = /\b(how much|how many|what's my|whats my|what is my|what are my|my current|show me my|value of|figure for)\b/.test(q);

  // Self-referential = the user is asking about THEIR figure ("my", "our", "we").
  const selfRef = /\b(my|mine|our|ours|we|us)\b/.test(q);

  if (!isReasoning && (isDefinition || isLookup)) {
    for (const g of GLOSSARY) {
      if (g.keys.some((k) => q.includes(k))) {
        const live = g.metric ? METRIC_RESOLVERS[g.metric](lv) : null;
        // Asking for THEIR number but we have no value for it → be honest and
        // NEVER imply a figure. (Trust is the product — no fabrication.)
        if (g.metric && !live && (isLookup || selfRef)) {
          return `I don't have your ${g.term.toLowerCase()} yet — nothing has been uploaded for it, so there's no real figure to show and I won't guess one.\n\nUpload the relevant file on the **Overview** page and I'll pull it instantly. For reference: ${g.def}`;
        }
        // Pure lookup ("how much revenue") and we have a number → lead with it.
        if (isLookup && !isDefinition && live) return `${capitalise(g.term)}: ${live.replace(/^Yours (currently reads|is) /, '')}`;
        return live ? `${g.def}\n\n📊 ${live}` : g.def;
      }
    }
  }

  return null;
}

const RECORD_HOWTO =
  "Recording is how AIBOS learns your business — one line at a time:\n\n1. Open the **Record** page.\n2. Type (or speak) what happened in plain words — “sold 3 bags of mealie meal for K450”, “paid K200 for transport”, “received 50kg sugar from Kasama Traders, K900”.\n3. Check the preview and confirm.\n\nThat's it. Each event updates your cash, stock, and money owed automatically — and the more you record, the smarter my answers get.";

const UPLOAD_HOWTO =
  "Two ways to bring in your data:\n\n• **Record it** — open **Record**, type what happened (“sold 3 bags of mealie meal for K450”), confirm, done. AIBOS keeps the books from there.\n• **Upload a file** — on the **Overview** page, drop a CSV or Excel file (financials with month, revenue and cost columns, a POS export, or a customer file).\n\nAs soon as either is in, I can answer with your real numbers — until then I won't make any up.";

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Suggested questions surfaced when the panel first opens (empty state). */
export const DEFAULT_PROMPTS = [
  'Morning brief',
  'How much cash do I have?',
  "What's my current inventory?",
  'How much did I make today?',
  'What should I focus on first?',
];
