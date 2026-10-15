'use client';
/**
 * Cash plan (Growth, 16 October 2026): the money day by day for the next 13
 * weeks, from one read of the books (aibos-api cash_plan.py). The bills
 * already known (wages waiting for payday, ZRA on the 10th, Schedule
 * payments), the regular ones found in the history, what customers owe and
 * when they usually pay, and the everyday trade forecast by the engine: the
 * chance the money goes short each week, the lowest point, what is safe to
 * spend today and what fixes a shortfall, with any decision tried on the
 * same futures. Below Growth the page shows the owner's own headline risk,
 * locked but visible.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import FeatureGate from '@/components/ui/FeatureGate';
import Panel from '@/components/home/Panel';
import { DayBadge, Note } from '@/components/hospitality/kit';
import PlanBody, { teaser } from '@/components/cashplan/PlanBody';
import { ApiError, getCashGroup, getCashPlan, type CashGroup, type CashPlan } from '@/lib/api';
import { useStore } from '@/lib/store';
import { canAccess } from '@/lib/tiers';
import { fmt } from '@/lib/utils';

export default function CashPlanPage() {
  const tier = useStore((s) => s.tier);
  const version = useStore((s) => s.booksVersion);
  const storeSym = useStore((s) => s.currencySymbol) || 'K';
  const growth = canAccess(tier, 'cash_plan');
  const [plan, setPlan] = useState<CashPlan | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [floor, setFloor] = useState(0);
  const [floorText, setFloorText] = useState('');
  const [tried, setTried] = useState<CashPlan | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [group, setGroup] = useState<CashGroup | null>(null);

  const load = useCallback(async (f: number) => {
    try {
      setFailed(null);
      setPlan(await getCashPlan(f));
    } catch (e) {
      setFailed(e instanceof ApiError && e.status === 403
        ? 'The cash plan is for the owner and the accountant.'
        : 'The cash plan could not be worked out just now. Try again in a moment.');
    }
  }, []);

  useEffect(() => { load(floor); setTried(null); }, [load, floor, version]);

  useEffect(() => {
    if (!growth) return;
    let alive = true;
    getCashGroup(floor).then((g) => { if (alive) setGroup(g); }).catch(() => { /* not the owner, or one business */ });
    return () => { alive = false; };
  }, [growth, floor, version]);

  const sym = plan?.sym || storeSym;
  const { headline, detail } = teaser(plan);
  const decisionLine = tried?.scenario?.plan.daily.map((d) => d.p50) ?? null;

  return (
    <>
      <PageHeader
        title="Cash plan"
        subtitle="Your money day by day for the next 13 weeks, from your own books."
        actions={<Link className="pill" href="/dashboard/forecast">Sales forecast</Link>}
      />
      {failed && <Note tone="bad">{failed}</Note>}
      {!plan && !failed && <div className="skeleton" style={{ height: 320, borderRadius: 'var(--radius-lg)' }} />}

      {plan && (
        <FeatureGate feature="cash_plan" title="Cash plan" colour="var(--cyan)" headline={headline} detail={detail}>
          {plan.preview ? (
            // The plan on this device says Growth and the server does not (a
            // lapsed plan): say so rather than draw half a page.
            <Note tone="warn">
              Your plan does not include the cash plan right now. <Link href="/dashboard/billing">Plan & billing</Link> shows why.
            </Note>
          ) : !plan.ok ? (
            <Panel title="Not enough history yet">
              <p className="rs-text">{plan.reason}</p>
              {(plan.known ?? []).length > 0 && (
                <>
                  <p className="rs-text is-quiet" style={{ marginTop: 12 }}>Already known to be coming:</p>
                  <ul style={{ margin: '8px 0 0', padding: 0 }}>
                    {(plan.known ?? []).map((k) => (
                      <li key={k.id} className="row" style={{ listStyle: 'none' }}>
                        <DayBadge date={k.day} small />
                        <span className="row-title" style={{ flex: 1 }}>{k.label}</span>
                        <span className="row-amount">{k.dir === 'in' ? '+' : '-'}{fmt(k.amount, false, sym)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Panel>
          ) : (
            <PlanBody plan={plan} sym={sym} floor={floor} floorText={floorText} setFloorText={setFloorText}
              setFloor={setFloor} tried={tried} setTried={setTried} decisionLine={decisionLine}
              open={open} setOpen={setOpen} group={group} />
          )}
        </FeatureGate>
      )}
    </>
  );
}
