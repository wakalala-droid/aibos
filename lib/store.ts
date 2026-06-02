'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Alert, Anomaly, AttachRates, BasketPair, BCGItem, BenchmarkResult,
  BreakevenData, BusinessType, CashFlowData, CategoryBreakdown, CLVTier,
  CrossInsight, CustomerSegment, E2Data, E3Data, EngineFlags, ForecastMonth,
  IntelligenceData, MenuGap, MonthlyRecord, POSGrandTotals, ProductRecord,
  RetentionData, RFMRecord, TopItem, VelocityItem,
} from './api';

// ---------------------------------------------------------------------------
// KPI / Health shape
// ---------------------------------------------------------------------------

export interface KPIData {
  totalRevenue: number;
  totalCosts: number;
  totalProfit: number;
  avgMargin: number;
  revenueGrowth?: number;
  profitGrowth?: number;
  runway?: number;
}

export interface HealthScore {
  score: number;
  label: string;
  colour: string;
  bestMonth: string;
  worstMonth: string;
}

// ---------------------------------------------------------------------------
// Currency helper — always ZMW / K for AI-BOS Zambia
// ---------------------------------------------------------------------------

const DEFAULT_CURRENCY    = 'ZMW';
const DEFAULT_CURRENCY_SYM = 'K';

// Kept for backward compat — store callers use sym directly
export function setCurrencyGlobal(_sym: string) {}

// ---------------------------------------------------------------------------
// MOCK DATA — Engine 1 (Kwacha, Zambian restaurant)
// ---------------------------------------------------------------------------

const MOCK_MONTHLY: MonthlyRecord[] = [
  { Month: 'Jan', Revenue: 178400, Costs: 132200 },
  { Month: 'Feb', Revenue: 192600, Costs: 141800 },
  { Month: 'Mar', Revenue: 215009, Costs: 154300 },
  { Month: 'Apr', Revenue: 208750, Costs: 149600 },
  { Month: 'May', Revenue: 223180, Costs: 158900 },
  { Month: 'Jun', Revenue: 198340, Costs: 144500 },
];

const MOCK_KPI: KPIData = {
  totalRevenue: 1_216_279,
  totalCosts:    881_300,
  totalProfit:   334_979,
  avgMargin:      27.5,
};

const MOCK_HEALTH: HealthScore = {
  score: 71,
  label: 'Healthy',
  colour: '#60A5FA',
  bestMonth: 'May',
  worstMonth: 'January',
};

const MOCK_ALERTS: Alert[] = [
  {
    id: 'a1', severity: 'warning',
    title: 'Cost spike — January',
    description: 'Costs exceeded 74% of revenue in January. Review supplier invoices.',
    month: 'Jan', value: 132200, expected: 120000,
  },
  {
    id: 'a2', severity: 'info',
    title: 'Revenue growth — March',
    description: 'March recorded highest revenue (K215,009) — driven by promotions.',
    month: 'Mar', value: 215009, expected: 192600,
  },
];

// ---------------------------------------------------------------------------
// MOCK DATA — Engine 2 (Kwacha, 3 customers)
// ---------------------------------------------------------------------------

const MOCK_RFM: RFMRecord[] = [
  {
    customer_id: 'C001', recency_days: 12, frequency: 5, monetary: 4250,
    r_score: 5, f_score: 5, m_score: 4, rfm_score: 14,
    segment: 'Champion', clv: 102000, clv_tier: 'High',
    churn_risk: 8, churn_label: '🟢 Low', intervention: 'No action needed.',
    avg_order: 850,
  },
  {
    customer_id: 'C002', recency_days: 44, frequency: 3, monetary: 2870,
    r_score: 3, f_score: 3, m_score: 3, rfm_score: 9,
    segment: 'Loyal', clv: 68880, clv_tier: 'Mid',
    churn_risk: 48, churn_label: '🟡 Medium',
    intervention: 'Follow up C002 this week. Share new product update.',
    avg_order: 957,
  },
  {
    customer_id: 'C003', recency_days: 68, frequency: 1, monetary: 1200,
    r_score: 1, f_score: 1, m_score: 2, rfm_score: 4,
    segment: 'At Risk', clv: 28800, clv_tier: 'Low',
    churn_risk: 81, churn_label: '🔴 High',
    intervention: 'URGENT: Contact C003 today. Offer 15% discount. K972 at risk.',
    avg_order: 1200,
  },
];

const MOCK_SEGMENTS: CustomerSegment[] = [
  { segment: 'Champion', count: 1, avg_spend: 4250, total_revenue: 4250 },
  { segment: 'Loyal',    count: 1, avg_spend: 2870, total_revenue: 2870 },
  { segment: 'At Risk',  count: 1, avg_spend: 1200, total_revenue: 1200 },
];

const MOCK_CLV_TIERS: CLVTier[] = [
  { tier: 'High', count: 1, total_clv: 102000 },
  { tier: 'Mid',  count: 1, total_clv: 68880  },
  { tier: 'Low',  count: 1, total_clv: 28800  },
];

const MOCK_RETENTION: RetentionData = {
  retention_rate: 66.7,
  returning_customers: 2,
  total_customers: 3,
  cohort_data: [
    { cohort: '2024-01', customers: 3 },
    { cohort: '2024-02', customers: 2 },
  ],
};

const MOCK_PRODUCTS_E2: ProductRecord[] = [
  { product: 'Pizzas',     total_revenue: 148253, num_orders: 2344, avg_order_val: 63.2, unique_buyers: 3, bcg_class: '⭐ Star'          },
  { product: 'Promotions', total_revenue: 38443,  num_orders: 859,  avg_order_val: 44.8, unique_buyers: 2, bcg_class: '⭐ Star'          },
  { product: 'Drinks',     total_revenue: 16272,  num_orders: 1479, avg_order_val: 11.0, unique_buyers: 3, bcg_class: '❓ Question Mark'  },
  { product: 'Sides',      total_revenue: 1435,   num_orders: 45,   avg_order_val: 31.9, unique_buyers: 1, bcg_class: '🐕 Dog'            },
];

const MOCK_BASKET_PAIRS: BasketPair[] = [
  { product_a: 'Pizzas', product_b: 'Drinks',     times_together: 3 },
  { product_a: 'Pizzas', product_b: 'Promotions', times_together: 2 },
  { product_a: 'Drinks', product_b: 'Sides',       times_together: 1 },
];

const MOCK_CUSTOMER_BRIEF =
  '1. Your 1 Champion customer (C001) generates K4,250 in revenue with a CLV of K102,000 — ' +
  'prioritise monthly personal engagement to protect this relationship above all others.\n' +
  '2. C003 is At Risk with K28,800 CLV at stake and 81% churn probability — ' +
  'an immediate 15% discount offer costs K180 to save K972 in near-term revenue.\n' +
  '3. Pizzas + Drinks are your top basket pair (3×) — ' +
  'train all staff to offer a drink with every pizza order to close the 63% attach gap.';

// ---------------------------------------------------------------------------
// MOCK DATA — Engine 3 (Kwacha, Debonairs East Park)
// ---------------------------------------------------------------------------

const MOCK_GT: POSGrandTotals = {
  units_sold:     7736,
  gross_revenue:  215529.30,
  discount_value: 520.00,
  net_revenue:    215009.30,
};

const MOCK_CATEGORIES: CategoryBreakdown[] = [
  { category: 'Pizzas',     units: 2344, revenue: 148253.0, pct_of_total: 68.8, avg_price: 63.2 },
  { category: 'Promotions', units: 859,  revenue: 38443.3,  pct_of_total: 17.8, avg_price: 44.8 },
  { category: 'Drinks',     units: 1479, revenue: 16272.0,  pct_of_total: 7.5,  avg_price: 11.0 },
  { category: 'Ice Cream',  units: 793,  revenue: 4456.0,   pct_of_total: 2.1,  avg_price: 5.6  },
  { category: 'Extras',     units: 385,  revenue: 3335.0,   pct_of_total: 1.5,  avg_price: 8.7  },
  { category: 'Hot Subs',   units: 61,   revenue: 2725.0,   pct_of_total: 1.3,  avg_price: 44.7 },
  { category: 'Sides',      units: 45,   revenue: 1435.0,   pct_of_total: 0.7,  avg_price: 31.9 },
];

const MOCK_TOP_ITEMS: TopItem[] = [
  { sku: 'L20',  name: 'Chicken & Mushroom',    category: 'Pizzas', units_sold: 241, revenue: 20485,  velocity_rank: '🔥' },
  { sku: 'L3',   name: 'Something Meaty Pizza', category: 'Pizzas', units_sold: 142, revenue: 13490,  velocity_rank: '🔥' },
  { sku: 'L128', name: 'Chicken Triple Decker', category: 'Pizzas', units_sold: 83,  revenue: 10790,  velocity_rank: '🔥' },
  { sku: 'L32',  name: 'Sweet & Sour Chicken',  category: 'Pizzas', units_sold: 95,  revenue: 8075,   velocity_rank: '✅' },
  { sku: 'L2',   name: 'Club Pizza',            category: 'Pizzas', units_sold: 54,  revenue: 5130,   velocity_rank: '✅' },
  { sku: 'P1',   name: 'Double Deal',           category: 'Promotions', units_sold: 380, revenue: 27980, velocity_rank: '🔥' },
  { sku: 'D1',   name: 'Pepsi 500ml',           category: 'Drinks', units_sold: 980, revenue: 10780,  velocity_rank: '🔥' },
];

const MOCK_BENCHMARKS: BenchmarkResult[] = [
  { metric: 'drink_attach_pct',       label: 'Drink Attach Rate',      actual: 63.1, benchmark: 80,  status: 'warn', gap: -16.9, unit: '%' },
  { metric: 'discount_rate_pct',      label: 'Discount Rate',           actual: 0.24, benchmark: 2,   status: 'good', gap: 1.76,  unit: '%' },
  { metric: 'top3_sku_concentration', label: 'Top 3 SKU Concentration', actual: 41.2, benchmark: 55,  status: 'good', gap: 13.8,  unit: '%' },
  { metric: 'category_mix_primary',   label: 'Primary Category Mix',    actual: 68.8, benchmark: 65,  status: 'warn', gap: -3.8,  unit: '%' },
];

const MOCK_ATTACH_RATES: AttachRates = {
  drink_attach_pct: 63.1,
  side_attach_pct:  1.9,
  addon_attach_pct: 65.0,
};

const MOCK_MENU_GAPS: MenuGap[] = [
  {
    name: 'Garlic Bread', sku: 'S1', category: 'Sides',
    issue: 'Low velocity (6.4 units/day) but above-average price',
    opportunity: 'Promote this item — high margin, low customer awareness.',
  },
];

const MOCK_OPS_BRIEF =
  '1. Net revenue of K215,009 over 7 days averages K30,716/day — ' +
  'identify your peak 3-hour window and add one extra staff member to maximise throughput.\n' +
  '2. Drink attach rate of 63.1% is 16.9% below the 80% QSR benchmark — ' +
  'at 7,736 units/week this gap represents K5,200 in uncaptured weekly drink revenue.\n' +
  '3. Pizzas represent 68.8% of revenue — negotiate a volume discount with your dough supplier ' +
  'and maintain a minimum 3-day stock buffer for your top 3 SKUs.';

// ---------------------------------------------------------------------------
// MOCK DATA — Intelligence Layer
// ---------------------------------------------------------------------------

const MOCK_CROSS_INSIGHTS: CrossInsight[] = [
  {
    insight:
      'Drink attach rate is 63.1% — QSR benchmark is 80%. At current pizza volume ' +
      '(2,344 units/week), closing the gap is worth approx. K5,200 in additional weekly drink revenue.',
    source_engines: ['E3', 'E2'],
    priority: 'high',
    action: 'Train staff on drink upsell at point-of-order. Add K5 bundle deals pairing main + Pepsi.',
  },
  {
    insight:
      'Discount rate is 0.24% — well below the 2% industry average. You have significant headroom ' +
      'to run a targeted 10% promotion for At Risk customer C003 without margin damage. K28,800 CLV is at risk.',
    source_engines: ['E3', 'E2'],
    priority: 'medium',
    action: 'Send a personalised K120 discount voucher to C003 this week — costs K120 to save K972.',
  },
  {
    insight:
      'Chicken & Mushroom (K20,485) + Chicken Triple Decker (K10,790) = 14.5% of total revenue ' +
      'from just 2 SKUs. A 3-day stockout of either costs K13,500.',
    source_engines: ['E3'],
    priority: 'medium',
    action: 'Implement minimum stock alerts for your top 2 revenue SKUs. Negotiate supplier priority delivery.',
  },
  {
    insight:
      'Financial health score is 71/100 despite 1 Champion customer with K102,000 CLV. ' +
      'Revenue quality is strong but cost structure has room to improve margins from 27.5% toward 32%.',
    source_engines: ['E1', 'E2'],
    priority: 'medium',
    action: 'Audit January cost spike (K132,200) — review supplier invoices and renegotiate delivery terms.',
  },
];

const MOCK_UNIFIED_BRIEF =
  '1. Implement a drink upsell script at every order point this week — ' +
  'closing the 63.1% → 80% attach gap adds K5,200/week (K270,400/year) at zero cost.\n' +
  '2. Contact at-risk customer C003 today with a 15% discount offer — ' +
  'K972 near-term revenue and K28,800 CLV protected for K180 spend.\n' +
  '3. Set minimum stock alerts for Chicken & Mushroom and Chicken Triple Decker — ' +
  'these 2 SKUs represent K31,275/week in revenue risk if unavailable.\n' +
  '4. Champion customer C001 (K102,000 CLV) deserves personal engagement this month — ' +
  'a complimentary meal or loyalty preview costs under K150 and reinforces the relationship.\n' +
  '5. Review January cost spike (K132,200 vs K120,000 expected) — ' +
  'a 10% cost reduction across the board would lift net margin from 27.5% to 30.4%.';

const MOCK_INTELLIGENCE_SCORES = {
  overall_score: 71,
  e1_score: 68,
  e2_score: 74,
  e3_score: 72,
  overall_label: 'Healthy' as const,
};

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

interface AIBOSStore {
  // E1
  monthly: MonthlyRecord[];
  kpi: KPIData;
  health: HealthScore;
  alerts: Alert[];
  anomalies: Anomaly[];
  forecast: ForecastMonth[];
  breakeven: BreakevenData | null;
  cashflow: CashFlowData | null;
  currency: string;
  currencySymbol: string;
  sidebarCollapsed: boolean;
  activeTab: string;
  uploadedFile: string | null;
  isLoading: boolean;

  // Engine flags
  engineFlags: EngineFlags;
  hasEngine2Data: boolean;
  hasEngine3Data: boolean;
  businessType: BusinessType | null;

  // E2
  rfm: RFMRecord[];
  segments: CustomerSegment[];
  clvTiers: CLVTier[];
  retention: RetentionData | null;
  productsE2: ProductRecord[];
  basketPairs: BasketPair[];
  customerIntelBrief: string;

  // E3
  posBusinessName: string;
  posPeriod: string;
  posGrandTotals: POSGrandTotals | null;
  categories: CategoryBreakdown[];
  velocityItems: VelocityItem[];
  bcgItems: BCGItem[];
  topItems: TopItem[];
  attachRates: AttachRates | null;
  benchmarks: BenchmarkResult[];
  menuGaps: MenuGap[];
  opsIntelBrief: string;

  // Intelligence
  intelligenceScores: typeof MOCK_INTELLIGENCE_SCORES | null;
  crossInsights: CrossInsight[];
  unifiedBrief: string;

  // Actions
  setCurrency: (currency: string, symbol: string) => void;
  updateData: (partial: Partial<AIBOSStore>) => void;
  setUploadedFile: (name: string | null) => void;
  setLoading: (v: boolean) => void;
  toggleSidebar: () => void;
  setActiveTab: (tab: string) => void;
  setBusinessType: (type: BusinessType | null) => void;
  setEngineFlags: (flags: EngineFlags) => void;
  updateEngine2Data: (data: Partial<AIBOSStore>) => void;
  updateEngine3Data: (data: Partial<AIBOSStore>) => void;
  updateIntelligence: (data: Partial<AIBOSStore>) => void;
  hydrateFromUpload: (result: import('./api').UploadResult) => void;
  resetAll: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function healthColour(score: number): string {
  if (score >= 80) return '#34D399';
  if (score >= 60) return '#60A5FA';
  if (score >= 40) return '#FBBF24';
  return '#EF4444';
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useStore = create<AIBOSStore>()(
  persist(
    (set) => ({
      // E1 defaults — Kwacha mock
      monthly: MOCK_MONTHLY,
      kpi: MOCK_KPI,
      health: MOCK_HEALTH,
      alerts: MOCK_ALERTS,
      anomalies: [],
      forecast: [],
      breakeven: null,
      cashflow: null,
      currency: DEFAULT_CURRENCY,
      currencySymbol: DEFAULT_CURRENCY_SYM,
      sidebarCollapsed: false,
      activeTab: '/dashboard',
      uploadedFile: null,
      isLoading: false,

      engineFlags: { e1: true, e2: true, e3: true },
      hasEngine2Data: true,
      hasEngine3Data: true,
      businessType: 'QSR',

      // E2 defaults — Kwacha mock
      rfm: MOCK_RFM,
      segments: MOCK_SEGMENTS,
      clvTiers: MOCK_CLV_TIERS,
      retention: MOCK_RETENTION,
      productsE2: MOCK_PRODUCTS_E2,
      basketPairs: MOCK_BASKET_PAIRS,
      customerIntelBrief: MOCK_CUSTOMER_BRIEF,

      // E3 defaults — Kwacha mock
      posBusinessName: 'Debonairs (East Park Aura)',
      posPeriod: '1st–7th March 2024',
      posGrandTotals: MOCK_GT,
      categories: MOCK_CATEGORIES,
      velocityItems: [],
      bcgItems: [],
      topItems: MOCK_TOP_ITEMS,
      attachRates: MOCK_ATTACH_RATES,
      benchmarks: MOCK_BENCHMARKS,
      menuGaps: MOCK_MENU_GAPS,
      opsIntelBrief: MOCK_OPS_BRIEF,

      // Intelligence defaults — Kwacha mock
      intelligenceScores: MOCK_INTELLIGENCE_SCORES,
      crossInsights: MOCK_CROSS_INSIGHTS,
      unifiedBrief: MOCK_UNIFIED_BRIEF,

      // ── Actions ─────────────────────────────────────────────────────────

      setCurrency: (currency, symbol) => set({ currency, currencySymbol: symbol }),
      updateData: (partial) => set((s) => ({ ...s, ...partial })),
      setUploadedFile: (name) => set({ uploadedFile: name }),
      setLoading: (v) => set({ isLoading: v }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setActiveTab: (tab) => set({ activeTab: tab }),
      setBusinessType: (type) => set({ businessType: type }),
      setEngineFlags: (flags) => set({ engineFlags: flags }),
      updateEngine2Data: (data) => set((s) => ({ ...s, ...data })),
      updateEngine3Data: (data) => set((s) => ({ ...s, ...data })),
      updateIntelligence: (data) => set((s) => ({ ...s, ...data })),

      hydrateFromUpload: (result) => {
        const sym = result.currency_symbol || DEFAULT_CURRENCY_SYM;
        const pnl = result.pnl;

        const kpi: KPIData = {
          totalRevenue: pnl.total_revenue,
          totalCosts:   pnl.total_costs,
          totalProfit:  pnl.total_profit,
          avgMargin:    pnl.avg_margin,
        };

        const cashflow: CashFlowData | null = result.cashflow
          ? {
              runway:       Math.round(result.cashflow[0]?.projected_cash / Math.max(kpi.totalCosts / 12, 1)),
              currentCash:  result.cashflow[0]?.projected_cash || 0,
              monthlyBurn:  kpi.totalCosts / 12,
              projections:  result.cashflow,
            }
          : null;

        const forecast: ForecastMonth[] = result.forecast?.months?.map(
          (m: string, i: number) => ({
            month: m,
            historical: result.forecast.historical?.[i],
            forecast:   result.forecast.predictions?.[i],
          }),
        ) ?? [];

        const newState: Partial<AIBOSStore> = {
          monthly:         result.monthly,
          kpi,
          health: {
            score:      result.health_score,
            label:      result.health_label,
            colour:     healthColour(result.health_score),
            bestMonth:  pnl.best_month,
            worstMonth: pnl.worst_month,
          },
          alerts:      result.alerts,
          anomalies:   result.anomalies,
          forecast,
          breakeven:   result.breakeven,
          cashflow,
          currency:    result.currency,
          currencySymbol: sym,
          engineFlags: result.engine_flags,
          hasEngine2Data: result.engine_flags.e2,
          hasEngine3Data: result.engine_flags.e3,
          businessType: result.business_type as BusinessType,
        };

        if (result.e2) {
          const e2 = result.e2;
          newState.rfm               = e2.rfm;
          newState.segments          = e2.segments;
          newState.clvTiers          = e2.clv_tiers;
          newState.retention         = e2.retention;
          newState.productsE2        = e2.products;
          newState.basketPairs       = e2.basket_pairs;
          newState.customerIntelBrief = e2.customer_intel_brief;
        }

        if (result.e3) {
          const e3 = result.e3;
          newState.posBusinessName = e3.business_name;
          newState.posPeriod       = e3.period;
          newState.posGrandTotals  = e3.grand_totals;
          newState.categories      = e3.categories;
          newState.topItems        = e3.top_items;
          newState.bcgItems        = e3.bcg_items;
          newState.attachRates     = e3.attach_rates;
          newState.benchmarks      = e3.benchmarks;
          newState.menuGaps        = e3.menu_gaps;
          newState.opsIntelBrief   = e3.ops_intel_brief;
        }

        if (result.intelligence) {
          const intel = result.intelligence;
          newState.intelligenceScores = {
            overall_score: intel.overall_score,
            e1_score:      intel.e1_score,
            e2_score:      intel.e2_score,
            e3_score:      intel.e3_score,
            overall_label: intel.overall_label as any,
          };
          newState.crossInsights = intel.cross_insights;
          newState.unifiedBrief  = intel.unified_brief;
        }

        set(newState as AIBOSStore);
      },

      resetAll: () => set({
        monthly:       MOCK_MONTHLY,
        kpi:           MOCK_KPI,
        health:        MOCK_HEALTH,
        alerts:        MOCK_ALERTS,
        anomalies:     [],
        forecast:      [],
        breakeven:     null,
        cashflow:      null,
        currency:      DEFAULT_CURRENCY,
        currencySymbol: DEFAULT_CURRENCY_SYM,
        engineFlags:   { e1: true, e2: true, e3: true },
        hasEngine2Data: true,
        hasEngine3Data: true,
        businessType:  'QSR',
        uploadedFile:  null,
        rfm:           MOCK_RFM,
        segments:      MOCK_SEGMENTS,
        clvTiers:      MOCK_CLV_TIERS,
        retention:     MOCK_RETENTION,
        productsE2:    MOCK_PRODUCTS_E2,
        basketPairs:   MOCK_BASKET_PAIRS,
        customerIntelBrief: MOCK_CUSTOMER_BRIEF,
        posBusinessName: 'Debonairs (East Park Aura)',
        posPeriod:       '1st–7th March 2024',
        posGrandTotals:  MOCK_GT,
        categories:      MOCK_CATEGORIES,
        velocityItems:   [],
        bcgItems:        [],
        topItems:        MOCK_TOP_ITEMS,
        attachRates:     MOCK_ATTACH_RATES,
        benchmarks:      MOCK_BENCHMARKS,
        menuGaps:        MOCK_MENU_GAPS,
        opsIntelBrief:   MOCK_OPS_BRIEF,
        intelligenceScores: MOCK_INTELLIGENCE_SCORES,
        crossInsights:   MOCK_CROSS_INSIGHTS,
        unifiedBrief:    MOCK_UNIFIED_BRIEF,
      }),
    }),
    {
      name: 'aibos-store-v3',
      partialize: (s) => {
        const { isLoading, ...rest } = s;
        return rest;
      },
    },
  ),
);
