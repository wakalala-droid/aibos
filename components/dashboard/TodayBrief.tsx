'use client';

// TodayBrief — the Morning Brief, on the homepage instead of behind a button
// (audit #9, owner-approved plan). Deterministic lines from lib/brief.ts —
// numbers by code, never a model call. Free tier sees the money position
// (the twin is free by doctrine); the full day needs morning_brief (Pro+).
// Silent before any data exists, like DecisionsQueue.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { useProfile } from '@/lib/profile';
import { canAccess, requiredTier, TIERS } from '@/lib/tiers';
import { briefLines, type BriefLine } from '@/lib/brief';
import { fetchBriefExtras, type BriefExtras } from '@/lib/briefData';
import { logUsage } from '@/lib/usage';
import SectionCard from '@/components/ui/SectionCard';

/** Markdown-lite: render **bold** spans, nothing else. */
function Md({ text }: { text: string }) {
  const parts = text.split('**');
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1
          ? <strong key={i} style={{ color: 'var(--text-1)', fontWeight: 700 }}>{p}</strong>
          : <span key={i}>{p}</span>
      )}
    </>
  );
}

function Row({ line, index }: { line: BriefLine; index: number }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 0', borderTop: index > 0 ? '1px solid var(--border)' : 'none' }}>
      <span aria-hidden style={{ fontSize: 'var(--fs-body)', lineHeight: 1.5, flexShrink: 0 }}>{line.emoji}</span>
      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', lineHeight: 1.55, margin: 0 }}>
        <Md text={line.md} />
      </p>
    </div>
  );
}

export default function TodayBrief() {
  const twin = useStore((s) => s.twin);
  const sym = useStore((s) => s.currencySymbol) || 'K';
  const tier = useStore((s) => s.tier);
  const { profile } = useProfile();
  const full = canAccess(tier, 'morning_brief');

  const [extras, setExtras] = useState<BriefExtras | null>(null);
  useEffect(() => {
    if (!full) return;                       // Free renders from the twin alone
    let alive = true;
    fetchBriefExtras().then((x) => { if (alive) setExtras(x); }).catch(() => {});
    return () => { alive = false; };
  }, [full]);

  const twinActive = !!twin && (Number(twin.event_count) > 0 || Number(twin.cash) !== 0);

  const lines = useMemo(() => {
    if (!twinActive) return [];
    const all = briefLines({
      sym,
      businessName: profile?.business_name as string | null,
      twin,
      products: extras?.products ?? [],
      salesToday: extras?.salesToday ?? [],
      salesYesterday: extras?.salesYesterday ?? [],
      expectedDeliveries: extras?.expectedDeliveries ?? [],
      commitmentsToday: extras?.commitmentsToday ?? [],
      overdueInvoices: extras?.overdueInvoices ?? null,
    });
    return full ? all : all.filter((l) => l.emoji === '💰');
  }, [twinActive, sym, profile?.business_name, twin, extras, full]);

  // The homepage IS the brief now — this is the funnel's insight moment.
  useEffect(() => {
    if (lines.length > 0) logUsage('brief_viewed', { meta: { surface: 'today' } });
  }, [lines.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  if (lines.length === 0) return null;       // silent before data exists

  const day = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });

  return (
    <SectionCard title={`Today — ${day}`} subtitle={full ? 'Your day, ready before you ask' : 'Your money position'} style={{ marginBottom: 20 }}>
      <div>
        {lines.map((l, i) => <Row key={i} line={l} index={i} />)}
      </div>
      {!full && (
        <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: '12px 0 0' }}>
          The full brief — sales, stock, deliveries, one thing to do — comes with{' '}
          <Link href={`/checkout?plan=${requiredTier('morning_brief')}`} style={{ color: 'var(--cyan)', fontWeight: 600 }}>
            {TIERS[requiredTier('morning_brief')].name}
          </Link>.
        </p>
      )}
    </SectionCard>
  );
}
