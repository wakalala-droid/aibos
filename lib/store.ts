'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Alert, Anomaly, AttachRates, BasketPair, BCGItem, BenchmarkResult,
  BreakevenData, BusinessType, CategoryBreakdown, CLVTier, CrossInsight,
  CustomerSegment, E2Data, E3Data, EngineFlags, MenuGap, MonthlyRecord,
  POSGrandTotals, ProductRecord, RetentionData, RFMRecord, TopItem, VelocityItem,
} from './api';

export interface KPIData { totalRevenue: number; totalCosts: number; totalProfit: number; avgMargin: number; }
export interface HealthScore { score: number; label: string; colour: string; bestMonth: string; worstMonth: string; }
export type ForecastMonth = { month: string; historical?: number; forecast?: number; lower?: number; upper?: number; };
export type CashFlowData = { runway: number; currentCash: number; monthlyBurn: number; projections: any[]; };

// ── MOCK DATA — ALL IN ZMW KWACHA ───────────────────────────────────────────

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
  score: 71, label: 'Healthy', colour: '#60a5fa',
  bestMonth: 'May', worstMonth: 'January',
};

const MOCK_ALERTS: Alert[] = [
  { id: 'a1', severity: 'warning', title: 'Cost spike — January', description: 'Costs exceeded 74% of revenue in January. Review supplier invoices.', month: 'Jan', value: 132200, expected: 120000 },
  { id: 'a2', severity: 'info',    title: 'Revenue growth — March', description: 'March recorded highest revenue (K215,009) — driven by promotions.', month: 'Mar', value: 215009, expected: 192600 },
];

const MOCK_RFM: RFMRecord[] = [
  { customer_id: 'C001', recency_days: 12, frequency: 5, monetary: 4250, r_score: 5, f_score: 5, m_score: 4, rfm_score: 14, segment: 'Champion', clv: 102000, clv_tier: 'High', churn_risk: 8,  churn_label: '🟢 Low',    intervention: 'No action needed.', avg_order: 850 },
  { customer_id: 'C002', recency_days: 44, frequency: 3, monetary: 2870, r_score: 3, f_score: 3, m_score: 3, rfm_score: 9,  segment: 'Loyal',    clv: 68880,  clv_tier: 'Mid',  churn_risk: 48, churn_label: '🟡 Medium', intervention: 'Follow up C002 this week. Share new product update.', avg_order: 957 },
  { customer_id: 'C003', recency_days: 68, frequency: 1, monetary: 1200, r_score: 1, f_score: 1, m_score: 2, rfm_score: 4,  segment: 'At Risk',  clv: 28800,  clv_tier: 'Low',  churn_risk: 81, churn_label: '🔴 High',   intervention: 'URGENT: Contact C003 today. Offer 15% discount. K972 at risk.', avg_order: 1200 },
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
  retention_rate: 66.7, returning_customers: 2, total_customers: 3,
  cohort_data: [{ cohort: '2024-01', customers: 3 }, { cohort: '2024-02', customers: 2 }],
};

const MOCK_PRODUCTS_E2: ProductRecord[] = [
  { product: 'Pizzas',     total_revenue: 148253, num_orders: 2344, avg_order_val: 63.2, unique_buyers: 3, bcg_class: '⭐ Star'           },
  { product: 'Promotions', total_revenue: 38443,  num_orders: 859,  avg_order_val: 44.8, unique_buyers: 2, bcg_class: '⭐ Star'           },
  { product: 'Drinks',     total_revenue: 16272,  num_orders: 1479, avg_order_val: 11.0, unique_buyers: 3, bcg_class: '❓ Question Mark'   },
  { product: 'Sides',      total_revenue: 1435,   num_orders: 45,   avg_order_val: 31.9, unique_buyers: 1, bcg_class: '🐕 Dog'             },
];

const MOCK_BASKET_PAIRS: BasketPair[] = [
  { product_a: 'Pizzas', product_b: 'Drinks',     times_together: 3 },
  { product_a: 'Pizzas', product_b: 'Promotions', times_together: 2 },
  { product_a: 'Drinks', product_b: 'Sides',       times_together: 1 },
];

const MOCK_GT: POSGrandTotals = { units_sold: 7736, gross_revenue: 215529.30, discount_value: 520.00, net_revenue: 215009.30 };

const MOCK_CATEGORIES: CategoryBreakdown[] = [
  { category: 'Pizzas',     units: 2344, revenue: 148253.0, pct_of_total: 68.8, avg_price: 63.2 },
  { category: 'Promotions', units: 859,  revenue: 38443.3,  pct_of_total: 17.8, avg_price: 44.8 },
  { category: 'Drinks',     units: 1479, revenue: 16272.0,  pct_of_total: 7.5,  avg_price: 11.0 },
  { category: 'Ice Cream',  units: 793,  revenue: 4456.0,   pct_of_total: 2.1,  avg_price: 5.6  },
  { category: 'Extras',     units: 385,  revenue: 3335.0,   pct_of_total: 1.5,  avg_price: 8.7  },
  { category: 'Sides',      units: 45,   revenue: 1435.0,   pct_of_total: 0.7,  avg_price: 31.9 },
];

const MOCK_TOP_ITEMS: TopItem[] = [
  { sku: 'L20',  name: 'Chicken & Mushroom',    category: 'Pizzas',     units_sold: 241, revenue: 20485,  velocity_rank: '🔥' },
  { sku: 'L3',   name: 'Something Meaty Pizza', category: 'Pizzas',     units_sold: 142, revenue: 13490,  velocity_rank: '🔥' },
  { sku: 'L128', name: 'Chicken Triple Decker', category: 'Pizzas',     units_sold: 83,  revenue: 10790,  velocity_rank: '🔥' },
  { sku: 'P1',   name: 'Double Deal',           category: 'Promotions', units_sold: 380, revenue: 27980,  velocity_rank: '🔥' },
  { sku: 'D1',   name: 'Pepsi 500ml',           category: 'Drinks',     units_sold: 980, revenue: 10780,  velocity_rank: '🔥' },
];

const MOCK_BENCHMARKS: BenchmarkResult[] = [
  { metric: 'drink_attach_pct',       label: 'Drink Attach Rate',      actual: 63.1, benchmark: 80,  status: 'warn', gap: -16.9, unit: '%' },
  { metric: 'discount_rate_pct',      label: 'Discount Rate',           actual: 0.24, benchmark: 2,   status: 'good', gap: 1.76,  unit: '%' },
  { metric: 'top3_sku_concentration', label: 'Top 3 SKU Concentration', actual: 41.2, benchmark: 55,  status: 'good', gap: 13.8,  unit: '%' },
  { metric: 'category_mix_primary',   label: 'Primary Category Mix',    actual: 68.8, benchmark: 65,  status: 'warn', gap: -3.8,  unit: '%' },
];

const MOCK_ATTACH: AttachRates = { drink_attach_pct: 63.1, side_attach_pct: 1.9, addon_attach_pct: 65.0 };

const MOCK_CROSS: CrossInsight[] = [
  { insight: 'Drink attach rate is 63.1% — QSR benchmark is 80%. At current pizza volume (2,344 units/week), closing the gap is worth approx. K5,200 in additional weekly drink revenue.', source_engines: ['E3','E2'], priority: 'high',   action: 'Train staff on drink upsell at point-of-order. Bundle: main + Pepsi at K5 discount.' },
  { insight: 'Discount rate is 0.24% — well below the 2% industry average. You have headroom to offer a targeted 10% promotion to C003 without margin damage. K28,800 CLV is at risk.',    source_engines: ['E3','E2'], priority: 'medium', action: 'Send a K120 discount voucher to C003 this week — protects K28,800 CLV for K120 spend.' },
  { insight: 'Chicken & Mushroom (K20,485) + Chicken Triple Decker (K10,790) = 14.5% of total revenue from 2 SKUs. A 3-day stockout costs K13,500.',                                        source_engines: ['E3'],      priority: 'medium', action: 'Set minimum stock alerts for your top 2 SKUs. Negotiate priority delivery with supplier.' },
  { insight: 'Health score is 71/100 despite 1 Champion customer with K102,000 CLV. Revenue quality is strong but cost structure limits margin growth from 27.5% toward 32%.',              source_engines: ['E1','E2'], priority: 'medium', action: 'Audit January cost spike (K132,200) — review supplier invoices and renegotiate terms.' },
];

const MOCK_BRIEF =
  '1. Implement drink upsell at every order — closing 63% → 80% attach adds K5,200/week (K270k/year).\n' +
  '2. Contact C003 today with 15% discount offer — K28,800 CLV protected for K120 spend.\n' +
  '3. Set stock alerts for Chicken & Mushroom and Chicken Triple Decker — K31k/week risk.\n' +
  '4. Champion customer C001 (K102,000 CLV) needs personal engagement this month.\n' +
  '5. Review January cost spike (K132,200 vs K120,000 expected) to lift margin from 27.5% to 30%.';

const MOCK_OPS =
  '1. Net revenue of K215,009 over 7 days = K30,716/day average. Identify peak 3-hour window and staff up.\n' +
  '2. Drink attach of 63.1% is 16.9% below the 80% QSR benchmark — K5,200/week in uncaptured revenue.\n' +
  '3. Pizzas represent 68.8% of revenue — negotiate volume discount with dough supplier and buffer 3-day stock.';

const MOCK_CUST_BRIEF =
  '1. C001 (Champion) generates K4,250 revenue with K102,000 CLV — prioritise monthly personal engagement above all.\n' +
  '2. C003 is At Risk with K28,800 CLV at stake and 81% churn probability — a 15% discount offer saves K972 short-term revenue.\n' +
  '3. Pizzas + Drinks are your top basket pair (3×) — train staff to offer a drink with every pizza order.';

// ── STORE ────────────────────────────────────────────────────────────────────

interface Store {
  // E1
  monthly: MonthlyRecord[];
  kpi: KPIData;
  health: HealthScore;
  alerts: Alert[];
  anomalies: Anomaly[];
  breakeven: BreakevenData | null;
  cashflow: CashFlowData | null;
  currency: string;
  currencySymbol: string;
  sidebarCollapsed: boolean;
  uploadedFile: string | null;
  isLoading: boolean;
  // Engine flags — DEFAULT TRUE so mock data pages are visible
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
  intelligenceScores: { overall_score: number; e1_score: number; e2_score: number; e3_score: number; overall_label: string } | null;
  crossInsights: CrossInsight[];
  unifiedBrief: string;
  // Actions
  setCurrency: (c: string, s: string) => void;
  setUploadedFile: (n: string | null) => void;
  setLoading: (v: boolean) => void;
  toggleSidebar: () => void;
  setBusinessType: (t: BusinessType | null) => void;
  hydrateFromUpload: (r: any) => void;
  resetAll: () => void;
}

function hc(score: number) {
  if (score >= 80) return '#34d399';
  if (score >= 60) return '#60a5fa';
  if (score >= 40) return '#fbbf24';
  return '#ef4444';
}

export const useStore = create<Store>()(
  persist(
    (set) => ({
      monthly: MOCK_MONTHLY,
      kpi: MOCK_KPI,
      health: MOCK_HEALTH,
      alerts: MOCK_ALERTS,
      anomalies: [],
      breakeven: null,
      cashflow: null,
      currency: 'ZMW',
      currencySymbol: 'K',
      sidebarCollapsed: false,
      uploadedFile: null,
      isLoading: false,
      engineFlags: { e1: true, e2: true, e3: true },
      hasEngine2Data: true,
      hasEngine3Data: true,
      businessType: 'QSR',
      rfm: MOCK_RFM,
      segments: MOCK_SEGMENTS,
      clvTiers: MOCK_CLV_TIERS,
      retention: MOCK_RETENTION,
      productsE2: MOCK_PRODUCTS_E2,
      basketPairs: MOCK_BASKET_PAIRS,
      customerIntelBrief: MOCK_CUST_BRIEF,
      posBusinessName: 'Debonairs (East Park Aura)',
      posPeriod: '1st–7th March 2024',
      posGrandTotals: MOCK_GT,
      categories: MOCK_CATEGORIES,
      velocityItems: [],
      bcgItems: [],
      topItems: MOCK_TOP_ITEMS,
      attachRates: MOCK_ATTACH,
      benchmarks: MOCK_BENCHMARKS,
      menuGaps: [],
      opsIntelBrief: MOCK_OPS,
      intelligenceScores: { overall_score: 71, e1_score: 68, e2_score: 74, e3_score: 72, overall_label: 'Healthy' },
      crossInsights: MOCK_CROSS,
      unifiedBrief: MOCK_BRIEF,

      setCurrency: (c, s) => set({ currency: c, currencySymbol: s }),
      setUploadedFile: (n) => set({ uploadedFile: n }),
      setLoading: (v) => set({ isLoading: v }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setBusinessType: (t) => set({ businessType: t }),

      hydrateFromUpload: (r) => {
        const sym = r.currency_symbol || 'K';
        const pnl = r.pnl || {};
        const kpi: KPIData = {
          totalRevenue: pnl.total_revenue ?? 0,
          totalCosts:   pnl.total_costs   ?? 0,
          totalProfit:  pnl.total_profit  ?? 0,
          avgMargin:    pnl.avg_margin    ?? 0,
        };
        const ns: Partial<Store> = {
          monthly: r.monthly ?? [],
          kpi,
          health: {
            score: r.health_score ?? 0,
            label: r.health_label ?? '',
            colour: hc(r.health_score ?? 0),
            bestMonth:  pnl.best_month  ?? '',
            worstMonth: pnl.worst_month ?? '',
          },
          alerts:      r.alerts      ?? [],
          anomalies:   r.anomalies   ?? [],
          breakeven:   r.breakeven   ?? null,
          currency:    r.currency    ?? 'ZMW',
          currencySymbol: sym,
          engineFlags: r.engine_flags ?? { e1: true, e2: false, e3: false },
          hasEngine2Data: r.engine_flags?.e2 ?? false,
          hasEngine3Data: r.engine_flags?.e3 ?? false,
          businessType: r.business_type ?? 'QSR',
        };
        if (r.e2) {
          ns.rfm               = r.e2.rfm          ?? [];
          ns.segments          = r.e2.segments      ?? [];
          ns.clvTiers          = r.e2.clv_tiers     ?? [];
          ns.retention         = r.e2.retention     ?? null;
          ns.productsE2        = r.e2.products      ?? [];
          ns.basketPairs       = r.e2.basket_pairs  ?? [];
          ns.customerIntelBrief = r.e2.customer_intel_brief ?? '';
        }
        if (r.e3) {
          ns.posBusinessName = r.e3.business_name ?? '';
          ns.posPeriod       = r.e3.period        ?? '';
          ns.posGrandTotals  = r.e3.grand_totals  ?? null;
          ns.categories      = r.e3.categories    ?? [];
          ns.topItems        = r.e3.top_items      ?? [];
          ns.bcgItems        = r.e3.bcg_items      ?? [];
          ns.attachRates     = r.e3.attach_rates   ?? null;
          ns.benchmarks      = r.e3.benchmarks     ?? [];
          ns.menuGaps        = r.e3.menu_gaps      ?? [];
          ns.opsIntelBrief   = r.e3.ops_intel_brief ?? '';
        }
        if (r.intelligence) {
          ns.intelligenceScores = {
            overall_score: r.intelligence.overall_score ?? 0,
            e1_score:      r.intelligence.e1_score ?? 0,
            e2_score:      r.intelligence.e2_score ?? 0,
            e3_score:      r.intelligence.e3_score ?? 0,
            overall_label: r.intelligence.overall_label ?? '',
          };
          ns.crossInsights = r.intelligence.cross_insights ?? [];
          ns.unifiedBrief  = r.intelligence.unified_brief  ?? '';
        }
        set(ns as Store);
      },

      resetAll: () => set({
        monthly: MOCK_MONTHLY, kpi: MOCK_KPI, health: MOCK_HEALTH,
        alerts: MOCK_ALERTS, anomalies: [], breakeven: null, cashflow: null,
        currency: 'ZMW', currencySymbol: 'K',
        engineFlags: { e1: true, e2: true, e3: true }, hasEngine2Data: true, hasEngine3Data: true,
        uploadedFile: null, businessType: 'QSR',
        rfm: MOCK_RFM, segments: MOCK_SEGMENTS, clvTiers: MOCK_CLV_TIERS,
        retention: MOCK_RETENTION, productsE2: MOCK_PRODUCTS_E2, basketPairs: MOCK_BASKET_PAIRS,
        customerIntelBrief: MOCK_CUST_BRIEF,
        posBusinessName: 'Debonairs (East Park Aura)', posPeriod: '1st–7th March 2024',
        posGrandTotals: MOCK_GT, categories: MOCK_CATEGORIES, velocityItems: [],
        bcgItems: [], topItems: MOCK_TOP_ITEMS, attachRates: MOCK_ATTACH,
        benchmarks: MOCK_BENCHMARKS, menuGaps: [], opsIntelBrief: MOCK_OPS,
        intelligenceScores: { overall_score: 71, e1_score: 68, e2_score: 74, e3_score: 72, overall_label: 'Healthy' },
        crossInsights: MOCK_CROSS, unifiedBrief: MOCK_BRIEF,
      }),
    }),
    { name: 'aibos-v4', partialize: (s) => { const { isLoading, ...r } = s; return r; } }
  )
);
