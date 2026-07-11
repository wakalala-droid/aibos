'use client';

// DecisionsQueue — the Overview opens on the answer, not the data (audit §12.01).
//
// "What needs you today": the 1–3 things that changed and the action for each,
// ranked by severity, each with a one-tap response. The metrics grid below
// becomes the evidence for these decisions, not the front page.
//
// Trust rules (SAFEGUARD §0.1): every decision is derived from recorded data —
// runway from the cashflow engine, reorders from real stock levels the owner
// set, follow-ups from the RFM engine, alerts from anomaly detection. If a
// signal has no data behind it, its decision is omitted; when nothing needs
// attention, the band says so honestly instead of inventing urgency.
// Propose → confirm, always: "Draft reorder" creates a PENDING receipt the
// owner confirms on arrival; check-ins are sent from the owner's own WhatsApp.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { useProfile } from '@/lib/profile';
import { canAccess } from '@/lib/tiers';
import { fmt } from '@/lib/utils';
import { listProducts, type Product } from '@/lib/api';
import {
  reorderProposals, draftReorder, followUpProposals, dismissedFollowUps, dismissFollowUp,
  type ReorderProposal,
} from '@/lib/automation';
import BorderGlow from '@/components/ui/BorderGlow';

// Core chrome tuning — identical to KPICard/SectionCard (craft-bar rule).
const CURSOR_GLOW = '190 95 62';
const MESH = ['#22d3ee', '#60a5fa', '#a78bfa'];

type Severity = 'crit' | 'warn';

interface Decision {
  id: string;
  severity: Severity;
  headline: string;
  reason: string;
  /** link → navigate; draft → create pending reorder; followup → WhatsApp + Done. */
  kind: 'link' | 'draft' | 'followup';
  actionLabel: string;
  href?: string;
  proposal?: ReorderProposal;
  waLink?: string;
  customerId?: string;
}

const SEV_COLOR: Record<Severity, string> = { crit: 'var(--crit)', warn: 'var(--warn)' };
const SEV_WORD: Record<Severity, string> = { crit: 'Critical', warn: 'Attention' };

const actionBtn: React.CSSProperties = {
  flexShrink: 0, padding: '7px 14px', borderRadius: 'var(--radius-md)', border: 'none',
  cursor: 'pointer', fontSize: 'var(--fs-data)', fontWeight: 600,
  background: 'var(--cyan)', color: '#fff', textDecoration: 'none',
  display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
};
const quietBtn: React.CSSProperties = {
  ...actionBtn,
  background: 'var(--bg-badge)', color: 'var(--text-2)',
  border: '1px solid var(--border-md)',
};

export default function DecisionsQueue() {
  const { alerts, cashflow, rfm, monthly, tier, currencySymbol } = useStore();
  const { profile } = useProfile();
  const sym = currencySymbol || 'K';
  const canAutomate = canAccess(tier, 'automation');

  // Live stock levels — the one signal the store doesn't carry. Same guarded
  // fetch as Simple home; a missing/unconfigured spine degrades to [].
  const [products, setProducts] = useState<Product[] | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try { const p = await listProducts(); if (alive) setProducts(p); }
      catch { if (alive) setProducts([]); }
    })();
    return () => { alive = false; };
  }, []);

  const [fuDismissed, setFuDismissed] = useState<Set<string>>(new Set());
  useEffect(() => { setFuDismissed(dismissedFollowUps()); }, []);
  const [draftState, setDraftState] = useState<Record<string, 'drafting' | 'done' | 'error'>>({});
  const [expanded, setExpanded] = useState(false);

  const decisions = useMemo<Decision[]>(() => {
    const out: Decision[] = [];
    const safeAlerts = Array.isArray(alerts) ? alerts : [];
    const safeMonthly = Array.isArray(monthly) ? monthly : [];

    // 1 · Cash runway — same bands the Cash page uses (crit <6mo, warn <12mo).
    const runway = Number(cashflow?.runway);
    if (Number.isFinite(runway) && runway > 0 && runway < 12) {
      out.push({
        id: 'runway',
        severity: runway < 6 ? 'crit' : 'warn',
        headline: `Cash runway is ${runway} month${runway === 1 ? '' : 's'}`,
        reason: runway < 6
          ? 'Below the 6-month line — decide what to cut or collect now.'
          : 'Under the 12-month comfort line — worth a plan this week.',
        kind: 'link', href: '/dashboard/cash', actionLabel: 'Review cash',
      });
    }

    // 2 · Critical anomaly/variance alerts.
    const crit = safeAlerts.filter(a => String(a.severity ?? '').toLowerCase() === 'critical');
    if (crit.length > 0) {
      out.push({
        id: 'alerts',
        severity: 'crit',
        headline: crit.length === 1 ? String(crit[0].title) : `${crit.length} critical alerts on your numbers`,
        reason: crit.length === 1
          ? String(crit[0].description || 'Flagged by anomaly detection.')
          : crit.slice(0, 2).map(a => String(a.title)).join(' · '),
        kind: 'link', href: '/dashboard/anomaly', actionLabel: 'Review alerts',
      });
    }

    // 3 · Stock about to run out — one-tap draft (propose → confirm).
    for (const p of reorderProposals(products ?? []).slice(0, 2)) {
      out.push({
        id: `re-${p.productId}`,
        severity: 'warn',
        headline: `Stock low: ${p.item}`,
        reason: `${p.reason}${p.estimatedCost !== undefined ? ` · reorder ≈ ${fmt(p.estimatedCost, true, sym)}` : ''}`,
        kind: 'draft', proposal: p, href: '/dashboard/inventory',
        actionLabel: canAutomate ? 'Draft reorder' : 'Review stock',
      });
    }

    // 4 · Highest-value drifting customer (dismissals persist a week).
    const fu = followUpProposals(rfm, sym, profile?.business_name)
      .filter(f => !fuDismissed.has(f.customerId))[0];
    if (fu) {
      out.push({
        id: `fu-${fu.customerId}`,
        severity: 'warn',
        headline: fu.headline,
        reason: fu.reason,
        kind: 'followup', waLink: fu.waLink, customerId: fu.customerId,
        actionLabel: 'Send check-in',
      });
    }

    // 5 · Margin compression month-over-month (≥3 pts).
    if (safeMonthly.length >= 2) {
      const marginOf = (m: any) => {
        const rev = Number(m?.Revenue) || 0;
        return rev > 0 ? ((rev - (Number(m?.Costs) || 0)) / rev) * 100 : 0;
      };
      const delta = marginOf(safeMonthly[safeMonthly.length - 1]) - marginOf(safeMonthly[safeMonthly.length - 2]);
      if (delta <= -3) {
        out.push({
          id: 'margin',
          severity: 'warn',
          headline: `Margin compressed ${Math.abs(delta).toFixed(1)} pts last month`,
          reason: 'Costs grew faster than revenue — find the line responsible.',
          kind: 'link', href: '/dashboard/variance', actionLabel: 'See what changed',
        });
      }
    }

    // Critical first; order within a band already reflects each signal's own ranking.
    return out.sort((a, b) => (a.severity === 'crit' ? 0 : 1) - (b.severity === 'crit' ? 0 : 1));
  }, [alerts, cashflow, monthly, products, rfm, sym, profile?.business_name, fuDismissed, canAutomate]);

  const onDraft = useCallback(async (p: ReorderProposal) => {
    setDraftState(s => ({ ...s, [p.productId]: 'drafting' }));
    try {
      await draftReorder(p);
      setDraftState(s => ({ ...s, [p.productId]: 'done' }));
    } catch {
      setDraftState(s => ({ ...s, [p.productId]: 'error' }));
    }
  }, []);

  const onFollowUpDone = useCallback((customerId: string) => {
    dismissFollowUp(customerId);
    setFuDismissed(prev => new Set([...prev, customerId]));
  }, []);

  // First run with nothing loaded anywhere: stay silent rather than shout
  // "all clear" about a business AIBOS hasn't seen yet.
  const hasSignalSources =
    (Array.isArray(monthly) && monthly.length > 0) ||
    rfm.length > 0 ||
    (products?.length ?? 0) > 0 ||
    (Array.isArray(alerts) && alerts.length > 0) ||
    !!cashflow;
  if (!hasSignalSources) return null;

  const visible = expanded ? decisions : decisions.slice(0, 3);
  const hidden = decisions.length - visible.length;
  const critCount = decisions.filter(d => d.severity === 'crit').length;

  return (
    <section aria-label="What needs you today" style={{ marginBottom: 24 }}>
      <BorderGlow glowColor={CURSOR_GLOW} backgroundColor="var(--bg-card)" borderRadius={14} glowRadius={48} glowIntensity={1.2} coneSpread={12} colors={MESH}>
        <div className="section-card glow-inner">
          <span className="bento-tex" aria-hidden="true" />

          {/* Header: the count IS the summary. */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: decisions.length > 0 ? 14 : 0 }}>
            <h2 className="section-title" style={{ margin: 0 }}>
              {decisions.length === 0
                ? 'Nothing needs you right now'
                : `${decisions.length} thing${decisions.length === 1 ? '' : 's'} need${decisions.length === 1 ? 's' : ''} you today`}
            </h2>
            {critCount > 0 && (
              <span style={{
                fontSize: 'var(--fs-label)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                color: 'var(--crit)', background: 'var(--red-dim)',
                border: '1px solid color-mix(in srgb, var(--crit) 30%, transparent)',
                padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap',
              }}>
                {critCount} critical
              </span>
            )}
          </div>

          {decisions.length === 0 ? (
            <p style={{ fontSize: 'var(--fs-data)', color: 'var(--text-3)', margin: '6px 0 0', lineHeight: 1.5 }}>
              Runway, stock, customers and anomalies are all inside their limits.
              The numbers below are the evidence.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {visible.map(d => {
                const sev = SEV_COLOR[d.severity];
                const st = d.proposal ? draftState[d.proposal.productId] : undefined;
                return (
                  <div
                    key={d.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '12px 14px', borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-badge)', border: '1px solid var(--border)',
                      borderLeft: `2px solid ${sev}`,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-1)', margin: '0 0 2px' }}>
                        {d.headline}
                        <span style={{ marginLeft: 8, fontSize: 'var(--fs-label)', fontWeight: 700, color: sev, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {SEV_WORD[d.severity]}
                        </span>
                      </p>
                      <p style={{ fontSize: 'var(--fs-data)', color: 'var(--text-3)', margin: 0, lineHeight: 1.45 }}>
                        {d.reason}
                      </p>
                    </div>

                    {/* One-tap response */}
                    {d.kind === 'link' && d.href && (
                      <Link href={d.href} style={quietBtn}>{d.actionLabel} →</Link>
                    )}
                    {d.kind === 'draft' && d.proposal && (
                      canAutomate ? (
                        <button
                          type="button"
                          onClick={() => void onDraft(d.proposal!)}
                          disabled={st === 'drafting' || st === 'done'}
                          style={{
                            ...actionBtn,
                            background: st === 'done' ? 'var(--green-dim)' : 'var(--cyan)',
                            color: st === 'done' ? 'var(--good)' : '#fff',
                            cursor: st === 'drafting' || st === 'done' ? 'default' : 'pointer',
                          }}
                        >
                          {st === 'drafting' ? 'Drafting…' : st === 'done' ? 'Drafted ✓' : st === 'error' ? 'Try again' : d.actionLabel}
                        </button>
                      ) : (
                        <Link href={d.href!} style={quietBtn}>{d.actionLabel} →</Link>
                      )
                    )}
                    {d.kind === 'followup' && d.waLink && d.customerId && (
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <a href={d.waLink} target="_blank" rel="noreferrer" style={actionBtn}>
                          {d.actionLabel}
                        </a>
                        <button
                          type="button"
                          onClick={() => onFollowUpDone(d.customerId!)}
                          aria-label={`Mark check-in with ${d.customerId} as done for this week`}
                          style={quietBtn}
                        >
                          Done
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {hidden > 0 && (
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  style={{
                    alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 'var(--fs-data)', fontWeight: 600, color: 'var(--cyan)', padding: '2px 0',
                  }}
                >
                  Show {hidden} more
                </button>
              )}
            </div>
          )}
        </div>
      </BorderGlow>
    </section>
  );
}
