'use client';

// Where the money is (redesign pilot): Mercury's accounts list in AIBOS's
// words. The money right now, split by how it was paid (the drawer, the
// mobile money wallet, the bank), then what customers owe and what the
// business owes. Each row opens what is behind it: a place opens the entries
// that make up its figure on the Money page (components/money/HowPaid.tsx),
// where "Not said how" can be put right one entry at a time.

import Link from 'next/link';
import { Banknote, Smartphone, Landmark, ArrowDownLeft, ArrowUpRight, HelpCircle, Flag } from 'lucide-react';
import type { HowPaid } from '@/lib/api';
import { useStore } from '@/lib/store';
import { useMoney } from '@/hooks/useMoney';
import BigMoney from './BigMoney';
import Panel from './Panel';

/** The Money page opened on the entries behind one place. */
export const howHref = (how: HowPaid) => `/dashboard/cash?how=${how}#how-paid`;

export default function WhereItIs() {
  const sym = useStore((s) => s.currencySymbol) || 'K';
  const twin = useStore((s) => s.twin);
  // The same read as the money figure and its line (hooks/useMoney).
  const money = useMoney(30);
  const split = money?.split ?? null;

  const receivables = Number(twin?.receivables) || 0;
  const payables = Number(twin?.payables) || 0;

  const accounts: { name: string; value: number; icon: React.ReactNode; href: string; sub?: string }[] = split ? [
    { name: 'Cash', value: split.cash, icon: <Banknote />, href: howHref('cash') },
    { name: 'Mobile money', value: split.mobile_money, icon: <Smartphone />, href: howHref('mobile_money') },
    { name: 'Bank and card', value: split.bank, icon: <Landmark />, href: howHref('bank') },
    ...(Math.abs(split.unsaid) > 0.005 ? [{
      name: 'Not said how', value: split.unsaid, icon: <HelpCircle />, href: howHref('unsaid'),
      sub: 'Open to say how each was paid',
    }] : []),
    ...(Math.abs(split.opening) > 0.005 ? [{
      name: 'Starting balance', value: split.opening, icon: <Flag />, href: '/dashboard/cash#what-you-hold',
      sub: 'What you held when you started recording',
    }] : []),
  ] : [];

  return (
    <Panel title="Where it is" labelledBy="where-it-is-title"
      action={<Link href="/dashboard/cash" className="pill pill-quiet" style={{ minHeight: 44 }}>Money</Link>}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {split === null && twin === null && <div className="skeleton" style={{ height: 160 }} />}
        {accounts.map((a) => (
          <Link key={a.name} href={a.href} className="row-link">
            <span className="avatar avatar-brand" aria-hidden="true">{a.icon}</span>
            <span className="row-main">
              <span className="row-title">{a.name}</span>
              {a.sub && <span className="row-sub">{a.sub}</span>}
            </span>
            <BigMoney value={a.value} sym={sym} size="md" />
          </Link>
        ))}
        {accounts.length > 0 && <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />}
        <Link href="/dashboard/invoices" className="row-link">
          <span className="avatar avatar-in" aria-hidden="true"><ArrowDownLeft /></span>
          <span className="row-main">
            <span className="row-title">Owed to you</span>
            <span className="row-sub">{receivables > 0 ? 'Customers who still have to pay' : 'Nobody owes you'}</span>
          </span>
          <BigMoney value={receivables} sym={sym} size="md" />
        </Link>
        <Link href="/dashboard/timeline?type=Purchase" className="row-link">
          <span className="avatar avatar-out" aria-hidden="true"><ArrowUpRight /></span>
          <span className="row-main">
            <span className="row-title">You owe</span>
            <span className="row-sub">{payables > 0 ? 'Bought on credit, not yet paid' : 'You owe nobody'}</span>
          </span>
          <BigMoney value={payables} sym={sym} size="md" />
        </Link>
      </div>
    </Panel>
  );
}
