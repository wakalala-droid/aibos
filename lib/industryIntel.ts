// lib/industryIntel.ts — Industry intelligence pack.
//
// Reference knowledge that makes AIBOS fluent in each vertical: what "good"
// looks like for a restaurant, a lodge, an online store, a quarry. The owner
// asks "is my margin okay?" and gets THEIR real number next to the industry
// reference range — clearly labelled as a reference, never presented as their
// data (SAFEGUARD §0.1).
//
// Ranges are sourced from published 2025/2026 industry studies (see inline
// citations). They are mostly US/global figures plus Southern-Africa hotel
// data — useful orientation, not targets. The honest framing every answer
// carries: your own trend over the last three months beats any industry
// average.

export interface Benchmark {
  /** How owners ask about it. Tested against the lowercased question. */
  ask: RegExp;
  label: string;
  /** Reference range in plain words, e.g. "28–35% of sales". */
  range: string;
  /** Numeric bounds as % of revenue when the metric is comparable. */
  loPct?: number;
  hiPct?: number;
  /** Which live metric this compares against ('margin' = net margin). */
  metric?: 'margin';
  /** Plain-language meaning + the lever the owner can pull. */
  explain: string;
}

export interface IndustryIntel {
  key: string;
  benchmarks: Benchmark[];
}

// Shared: questions that signal "compare me to the industry" rather than
// "define this term" or "read my number".
export const BENCHMARK_CUE =
  /\b(good|bad|healthy|normal|okay|ok\??|too (high|low)|benchmark|industry|typical|average for|compare|should (my|i|it)|what should)\b/;

const PACKS: Record<string, IndustryIntel> = {
  restaurant: {
    key: 'restaurant',
    benchmarks: [
      {
        // Food cost 28–35%, industry average ~32% (VantaInsights 2026,
        // NetSuite restaurant benchmarks).
        ask: /\bfood cost|cost of ingredients|ingredient cost\b/,
        label: 'Food cost',
        range: '28–35% of sales (industry average ≈ 32%)',
        explain:
          'Food cost is what the ingredients on the plate cost you, as a share of what the plate sells for. Above ~35%, portions, waste or supplier prices are eating your profit; the levers are portion control, menu prices and buying better.',
      },
      {
        // Labor 25–35% of sales (Toast, HC-Resource 2025).
        ask: /\blabou?r cost|staff cost|wages? (as|share|percent)|payroll\b/,
        label: 'Labour cost',
        range: '25–35% of sales',
        explain:
          'Labour cost is wages as a share of sales. Watch it weekly against takings — quiet shifts with full staffing are where it slips.',
      },
      {
        // Prime cost 55–65% (NOVA Platform 2026, Whipplewood).
        ask: /\bprime cost\b/,
        label: 'Prime cost',
        range: '55–65% of sales (food + labour together)',
        explain:
          'Prime cost is food plus labour — the two costs you control daily. Keep the pair under about 65% of sales and the rest of the business has room to breathe.',
      },
      {
        // Net margin: FSR 3–5%, QSR 6–9% (Restroworks 2024/25 statistics).
        ask: /\b(net )?(profit )?margin\b/,
        label: 'Net margin',
        range: '3–9% (sit-down 3–5%, fast service 6–9%)',
        loPct: 3,
        hiPct: 9,
        metric: 'margin',
        explain:
          'Restaurants run on thin margins — a few percent is normal, not failure. The fastest wins are usually food cost and waste, not more customers.',
      },
    ],
  },

  hospitality: {
    key: 'hospitality',
    benchmarks: [
      {
        // Southern Africa 2025: 61–70% occupancy in well-performing months
        // (STR/CoStar via Tourism News Africa, Statista MEA).
        ask: /\boccupancy\b/,
        label: 'Occupancy',
        range: '60–70% (well-performing Southern African hotels, 2025)',
        explain:
          'Occupancy is the share of your rooms filled each night. Below the reference range, the levers are rate, direct bookings and repeat guests — an empty room tonight is revenue you never get back.',
      },
      {
        ask: /\brevpar|revenue per (available )?room\b/,
        label: 'RevPAR',
        range: 'your average nightly rate × your occupancy',
        explain:
          'RevPAR (revenue per available room) blends rate and occupancy into one number, so you can see whether discounting to fill rooms is actually earning more. Track it week by week — the trend matters more than any target.',
      },
      {
        ask: /\b(average )?(daily |room )?rate\b|adr\b/,
        label: 'Average daily rate',
        range: 'set by your market — track your own month-over-month trend',
        explain:
          'Your average nightly rate should be judged against your own history and your local competitors, not a global table. If occupancy is strong, test a higher rate; if rooms sit empty, the rate is only one lever — packaging and direct bookings matter as much.',
      },
    ],
  },

  ecommerce: {
    key: 'ecommerce',
    benchmarks: [
      {
        // 2.5–3% global average 2025 (Nector, Triple Whale).
        ask: /\bconversion( rate)?\b/,
        label: 'Conversion rate',
        range: '2–3% of visitors buying is the global average',
        explain:
          'Conversion rate is the share of store visitors who buy. Under ~2%, look at product photos, price clarity and checkout friction before spending more on ads.',
      },
      {
        // ~70–77% average; below 65% is good (Upcounting 2025, EVS stats).
        ask: /\bcart abandon|abandoned cart\b/,
        label: 'Cart abandonment',
        range: '70–77% is average; below 65% is good',
        explain:
          'Most people who add to cart never buy — that is normal everywhere. A simple follow-up message recovers 5–15% of abandoned carts, the cheapest sales you will ever make.',
      },
      {
        // ≥50% gross margin for sustainable ecommerce (Flowium 2026).
        ask: /\bgross margin|markup\b/,
        label: 'Gross margin',
        range: 'at least 50% gross margin for a sustainable store',
        explain:
          'Online stores carry delivery, returns and ad costs that eat thin margins alive. If a product cannot earn ~50% over what it costs you, it usually cannot pay for its own marketing.',
      },
      {
        ask: /\b(net )?(profit )?margin\b/,
        label: 'Net margin',
        range: 'varies widely by category — gross margin ≥50% is the anchor',
        metric: 'margin',
        explain:
          'Net margin in e-commerce depends heavily on delivery and advertising costs. Anchor on gross margin per product first, then watch your own net trend month over month.',
      },
    ],
  },

  mine: {
    key: 'mine',
    benchmarks: [
      {
        // Hauling 40–70% of surface-mining opex (MDPI 2025, ResearchGate
        // quarry cost structure).
        ask: /\bhauling|transport cost|trucking\b/,
        label: 'Hauling cost share',
        range: 'often 40–70% of operating cost in surface operations',
        explain:
          'Moving material is usually the single biggest cost in a surface operation. Shorter hauls, full loads and route condition are worth more attention than almost anything else on site.',
      },
      {
        ask: /\bfuel\b/,
        label: 'Fuel',
        range: 'the swing factor — hard ground can push consumption up ~15%',
        explain:
          'Fuel is the cost that moves first when conditions change. Record fuel purchases as expenses consistently and watch the monthly trend against tonnes moved — cost per tonne is the number that keeps a small operation honest.',
      },
      {
        // Maintenance 2–6% of asset value annually (Opsima mining KPIs).
        ask: /\bmaintenance|repairs?\b/,
        label: 'Maintenance',
        range: '2–6% of equipment value per year, rising with fleet age',
        explain:
          'Planned maintenance is cheaper than breakdowns — unplanned downtime costs you the repair AND the lost output. Record repairs as expenses per machine and the pattern will show you which unit is bleeding money.',
      },
      {
        ask: /\bcost per tonne|per ton\b/,
        label: 'Cost per tonne',
        range: 'no universal figure — it varies by rock, haul and method',
        explain:
          'Cost per tonne is your operation’s heartbeat: total monthly operating cost divided by tonnes sold. Published figures vary too much to borrow — build your own baseline from three months of recorded expenses and output, then beat it.',
      },
    ],
  },
};

/** Resolve the intelligence pack for an industry profile key, if one exists. */
export function intelOf(industryKey: string): IndustryIntel | null {
  return PACKS[industryKey] ?? null;
}

/**
 * Match a benchmark question for this industry. Returns the benchmark hit, or
 * null when the question isn't a "compare me / what's good" question.
 */
export function matchBenchmark(question: string, industryKey: string): Benchmark | null {
  const q = question.toLowerCase();
  if (!BENCHMARK_CUE.test(q)) return null;
  const pack = PACKS[industryKey];
  if (!pack) return null;
  return pack.benchmarks.find((b) => b.ask.test(q)) ?? null;
}

/** Compact reference block for the AI CFO context — labels + ranges only. */
export function referenceContext(industryKey: string): Array<{ metric: string; reference_range: string }> | null {
  const pack = PACKS[industryKey];
  if (!pack) return null;
  return pack.benchmarks.map((b) => ({ metric: b.label, reference_range: b.range }));
}
