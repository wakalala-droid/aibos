/**
 * Admin · set up a customer's hospitality property, without their login.
 *
 * WHY THIS EXISTS. Everything needed to put a property's bookings through
 * AI-BOS lives inside that customer's own account: the property, its units, and
 * the key their website uses. So connecting a client's site meant somebody
 * signing in AS the client, which is exactly what a platform operator should
 * not have to do, and does not scale past the first one.
 *
 * WHERE THE POWER COMES FROM. Admin authority stays where it already is:
 * `requireAdmin()` on the caller's own session cookie, the same gate every
 * other /api/admin/* route uses. The API deliberately learns nothing about
 * admins. Adding an admin concept to a service whose key already bypasses row
 * level security would be a much larger door than this needs.
 *
 * WHAT IT CAN AND CANNOT TOUCH. Properties, units and the website token. That
 * is all. It never reads guests, never reads bookings, and never touches the
 * sealed ID documents. Every row it writes is stamped with the CUSTOMER's
 * user_id, never the admin's, and every call lands in admin_audit under the
 * admin's own email.
 *
 * GET  → { profile, entitled, property, units }
 * POST → { action: 'setup' | 'mint' | 'clear', ... }
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-server';
import { createServiceClient } from '@/lib/supabase-admin';
import { canAccess, isTier, requiredTier, TIERS, type Tier } from '@/lib/tiers';
import { slugFrom } from '@/lib/slug';

type Admin = ReturnType<typeof createServiceClient>;

interface UnitInput {
  unit_name?: unknown;
  bedrooms?: unknown;
  bathrooms?: unknown;
  max_guests?: unknown;
  base_nightly_rate?: unknown;
  currency?: unknown;
  public_slug?: unknown;
}

const MAX_UNITS = 40;

/** An unguessable capability, the same shape the API mints (token_urlsafe(24)). */
function mintToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64url');
}

const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** Mirrors _clean_unit in aibos-api/hospitality.py. Throws on bad input. */
function cleanUnit(raw: UnitInput, index: number) {
  const name = String(raw.unit_name ?? '').trim();
  if (!name) throw new Error(`Unit ${index + 1} needs a name.`);

  const bedrooms = Math.trunc(num(raw.bedrooms, 0));
  const maxGuests = Math.trunc(num(raw.max_guests, 1));
  const bathrooms = num(raw.bathrooms, 0);
  const rate = num(raw.base_nightly_rate, 0);

  if (bedrooms < 0 || bathrooms < 0 || rate < 0) {
    throw new Error(`${name}: bedrooms, bathrooms and the rate cannot be negative.`);
  }
  if (maxGuests < 1) throw new Error(`${name}: it has to sleep at least one person.`);

  const slug = slugFrom(String(raw.public_slug ?? '') || name);
  if (!slug) throw new Error(`${name}: that name has no letters or numbers to make a web address from.`);

  return {
    unit_name: name,
    bedrooms,
    bathrooms,
    max_guests: maxGuests,
    base_nightly_rate: rate,
    currency: String(raw.currency ?? 'ZMW').trim().toUpperCase() || 'ZMW',
    public_slug: slug,
  };
}

async function readState(admin: Admin, userId: string) {
  const { data: profile, error } = await admin
    .from('profiles')
    .select('id, email, business_name, tier')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile) return null;

  const { data: properties } = await admin
    .from('properties')
    .select('id, name, address, status, public_site_token')
    .eq('user_id', userId)
    .order('created_at');

  const property = (properties ?? [])[0] ?? null;

  const { data: units } = property
    ? await admin
        .from('units')
        .select('id, unit_name, bedrooms, bathrooms, max_guests, base_nightly_rate, currency, public_slug')
        .eq('user_id', userId)
        .eq('property_id', property.id)
        .order('unit_name')
    : { data: [] };

  const tier: Tier = isTier(profile.tier) ? profile.tier : 'free';

  return {
    profile,
    tier,
    // The customer's plan is the gate, here as everywhere. An admin can set the
    // rows up, but if the plan does not include hospitality the customer opens
    // an empty locked screen and the website key answers nothing.
    entitled: canAccess(tier, 'hospitality'),
    needsTier: TIERS[requiredTier('hospitality')].name,
    property,
    units: units ?? [],
  };
}

async function audit(admin: Admin, email: string | undefined, userId: string, action: string, detail: unknown) {
  await admin.from('admin_audit').insert({
    admin_email: email ?? 'unknown',
    target_user_id: userId,
    action,
    detail,
  });
}

export async function GET(_req: NextRequest, { params }: { params: { userId: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const state = await readState(createServiceClient(), params.userId);
    if (!state) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    return NextResponse.json(state);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { userId: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { userId } = params;
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    property?: { name?: unknown; address?: unknown };
    units?: UnitInput[];
  };
  const action = body.action ?? 'setup';

  try {
    const admin = createServiceClient();
    const state = await readState(admin, userId);
    if (!state) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });

    // ── Take the website offline ───────────────────────────────────────────
    if (action === 'clear') {
      if (!state.property) return NextResponse.json({ error: 'This account has no property.' }, { status: 404 });
      const { error } = await admin
        .from('properties')
        .update({ public_site_token: null })
        .eq('id', state.property.id)
        .eq('user_id', userId);
      if (error) throw new Error(error.message);
      await audit(admin, auth.user.email, userId, 'hospitality_site_token', { result: 'cleared' });
      return NextResponse.json(await readState(admin, userId));
    }

    // ── Mint or rotate the website key ─────────────────────────────────────
    if (action === 'mint') {
      if (!state.property) return NextResponse.json({ error: 'This account has no property.' }, { status: 404 });
      const token = mintToken();
      const { error } = await admin
        .from('properties')
        .update({ public_site_token: token })
        .eq('id', state.property.id)
        .eq('user_id', userId);
      if (error) throw new Error(error.message);
      // The token itself is NOT written to the audit log. It is a key, and an
      // audit trail is the wrong place to keep one: what happened is the fact
      // worth recording, not the secret it produced.
      await audit(admin, auth.user.email, userId, 'hospitality_site_token', {
        result: state.property.public_site_token ? 'rotated' : 'minted',
      });
      return NextResponse.json(await readState(admin, userId));
    }

    // ── First-time setup ───────────────────────────────────────────────────
    if (action !== 'setup') {
      return NextResponse.json({ error: `Unknown action "${action}".` }, { status: 400 });
    }

    if (!state.entitled) {
      return NextResponse.json(
        {
          error:
            `This account is on ${TIERS[state.tier].name}, which does not include the ` +
            `hospitality module. Grant it ${state.needsTier} first, or the customer will ` +
            `open a locked screen and their website key will answer nothing.`,
        },
        { status: 409 },
      );
    }
    if (state.property) {
      return NextResponse.json(
        { error: `This account already has a property ("${state.property.name}"). Add units from their own dashboard, or mint a key here.` },
        { status: 409 },
      );
    }

    const propertyName = String(body.property?.name ?? '').trim();
    if (!propertyName) return NextResponse.json({ error: 'The property needs a name.' }, { status: 400 });

    const rawUnits = Array.isArray(body.units) ? body.units : [];
    if (rawUnits.length === 0) {
      return NextResponse.json({ error: 'Add at least one unit. A property with none cannot be booked.' }, { status: 400 });
    }
    if (rawUnits.length > MAX_UNITS) {
      return NextResponse.json({ error: `That is more than ${MAX_UNITS} units in one go.` }, { status: 400 });
    }

    let units: ReturnType<typeof cleanUnit>[];
    try {
      units = rawUnits.map(cleanUnit);
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }

    const slugs = units.map((u) => u.public_slug);
    const duplicate = slugs.find((s, i) => slugs.indexOf(s) !== i);
    if (duplicate) {
      return NextResponse.json(
        { error: `Two units would answer to the same web address ("${duplicate}"). Give them different names, or set the web address by hand.` },
        { status: 400 },
      );
    }

    const token = mintToken();
    const { data: property, error: pErr } = await admin
      .from('properties')
      .insert({
        user_id: userId,                       // the CUSTOMER's, never the admin's
        name: propertyName,
        address: String(body.property?.address ?? '').trim() || null,
        status: 'active',
        public_site_token: token,
      })
      .select('id, name, address, status, public_site_token')
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!property) throw new Error('The property was not created.');

    const { error: uErr } = await admin
      .from('units')
      .insert(units.map((u) => ({ user_id: userId, property_id: property.id, ...u })));
    if (uErr) {
      // Do not leave a property with no units behind: it would read as a
      // half-finished setup that nobody can explain later.
      await admin.from('properties').delete().eq('id', property.id).eq('user_id', userId);
      throw new Error(uErr.message);
    }

    await audit(admin, auth.user.email, userId, 'hospitality_setup', {
      property: propertyName,
      units: units.map((u) => u.public_slug),
    });

    return NextResponse.json(await readState(admin, userId));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
