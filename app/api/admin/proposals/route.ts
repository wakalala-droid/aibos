/**
 * /api/admin/proposals — owner review queue for AI/rule function proposals
 * (SAFEGUARD.md Layer 2). Admin-verified; service-role writes.
 *
 *  GET   → list all proposals (newest first)
 *  POST  → persist a batch returned by the backend `/propose` { proposals[], source_file }
 *  PATCH → set a proposal's status { id, status: 'approved'|'rejected'|'implemented' }
 *
 * Proposals are DATA (a sandbox-validated formula + preview + critique). Nothing
 * here executes a formula; approval only records intent for a human to implement.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-server';
import { createServiceClient } from '@/lib/supabase-admin';

const STATUSES = ['proposed', 'approved', 'rejected', 'implemented'] as const;

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  try {
    const admin = createServiceClient();
    const { data, error } = await admin
      .from('function_proposals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return NextResponse.json({ proposals: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => ({}))) as {
    proposals?: Record<string, unknown>[];
    source_file?: string;
  };
  const proposals = Array.isArray(body.proposals) ? body.proposals : [];
  if (proposals.length === 0) {
    return NextResponse.json({ error: 'No proposals to persist.' }, { status: 400 });
  }

  // Map the backend shape → table columns. We trust only structural fields and
  // never store anything executable beyond the (already sandbox-validated) formula.
  const rows = proposals.slice(0, 25).map((p) => ({
    name: String(p.name ?? 'Unnamed metric').slice(0, 120),
    purpose: typeof p.purpose === 'string' ? p.purpose.slice(0, 400) : null,
    extends_engine: typeof p.extends_engine === 'string' ? p.extends_engine : null,
    inputs: p.inputs ?? [],
    formula: String(p.formula ?? '').slice(0, 400),
    preview: p.preview ?? {},
    confidence: typeof p.confidence === 'number' ? p.confidence : 0,
    citations: p.citations ?? [],
    assumptions: p.assumptions ?? [],
    risks: p.risks ?? [],
    critique: p.critique ?? {},
    source: p.source === 'ai' ? 'ai' : 'rule',
    status: 'proposed',
    source_file: typeof body.source_file === 'string' ? body.source_file.slice(0, 200) : null,
    created_by: auth.user.email,
  }));

  try {
    const admin = createServiceClient();
    const { data, error } = await admin.from('function_proposals').insert(rows).select('id');
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, inserted: data?.length ?? 0 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => ({}))) as { id?: string; status?: string };
  if (!body.id || !STATUSES.includes(body.status as (typeof STATUSES)[number])) {
    return NextResponse.json({ error: 'id and a valid status are required.' }, { status: 400 });
  }
  try {
    const admin = createServiceClient();
    const { data, error } = await admin
      .from('function_proposals')
      .update({ status: body.status, reviewed_by: auth.user.email, reviewed_at: new Date().toISOString() })
      .eq('id', body.id)
      .select('id, status')
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: 'Proposal not found.' }, { status: 404 });
    return NextResponse.json({ ok: true, proposal: data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
