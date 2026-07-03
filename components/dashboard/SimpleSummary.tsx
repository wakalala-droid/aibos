'use client';

// SimpleSummary — the five-second explanation band (ux_intelligence.md:
// "Can a first-time business owner understand this in under five seconds?").
//
// In Simple mode, every technical hub opens with its story told in plain
// words, composed ONLY from the user's real data — the charts below become
// detail, not homework. Renders nothing in technical mode, and nothing when
// there's no data (each page's own empty state already handles that).

import { useStore } from '@/lib/store';
import { fmt } from '@/lib/utils';

export default function SimpleSummary({ page }: { page: 'cash' | 'customers' | 'ops' }) {
  const uiMode = useStore((s) => s.uiMode);
  const sym = useStore((s) => s.currencySymbol) || 'K';
  const twin = useStore((s) => s.twin);
  const kpi = useStore((s) => s.kpi);
  const rfm = useStore((s) => s.rfm);
  const pos = useStore((s) => s.posGrandTotals);

  if (uiMode !== 'simple') return null;
  const money = (n: number) => fmt(n, true, sym);

  let text: string | null = null;

  if (page === 'cash') {
    const cash = Number(twin?.cash) || 0;
    const recv = Number(twin?.receivables) || 0;
    const pay = Number(twin?.payables) || 0;
    if (twin && (cash !== 0 || Number(twin.event_count) > 0)) {
      const bits = [`In plain words: you're holding ${money(cash)} right now.`];
      if (recv > 0) bits.push(`Customers owe you ${money(recv)} — collecting it is the cheapest cash you'll ever raise.`);
      if (pay > 0) bits.push(`You owe suppliers ${money(pay)} — plan for it so it never surprises you.`);
      text = bits.join(' ');
    } else if (kpi && Number(kpi.totalRevenue) > 0) {
      text = `In plain words: across your uploaded months you brought in ${money(Number(kpi.totalRevenue))} and kept ${money(Number(kpi.totalProfit))} after costs. The charts below show when cash gets tight and why.`;
    }
  }

  if (page === 'customers' && rfm.length > 0) {
    const champions = rfm.filter((r) => r.segment === 'Champion').length;
    const atRisk = rfm.filter((r) => (Number(r.churn_risk) || 0) >= 70).length;
    const bits = [`In plain words: ${rfm.length} customer${rfm.length === 1 ? '' : 's'} on file.`];
    if (champions > 0) bits.push(`${champions} ${champions === 1 ? 'is a regular' : 'are regulars'} who drive your revenue — protect them.`);
    if (atRisk > 0) bits.push(`${atRisk} ${atRisk === 1 ? 'is' : 'are'} drifting — check-in drafts are ready on your Home page.`);
    else bits.push('Nobody valuable is drifting right now.');
    text = bits.join(' ');
  }

  if (page === 'ops' && pos) {
    const net = Number(pos.net_revenue ?? pos.gross_revenue) || 0;
    if (net > 0) {
      text = `In plain words: your sales data below adds up to ${money(net)}. This page shows what sells, when — your busiest hours and best sellers are where staffing and stock decisions pay off.`;
    }
  }

  if (!text) return null;

  return (
    <div
      style={{
        padding: '12px 16px', marginBottom: 16, borderRadius: 10,
        border: '1px solid color-mix(in srgb, var(--cyan) 22%, var(--border-md))',
        background: 'color-mix(in srgb, var(--cyan) 5%, transparent)',
      }}
    >
      <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.84rem', lineHeight: 1.55, color: 'var(--text-2)', margin: 0 }}>
        {text}
      </p>
    </div>
  );
}
