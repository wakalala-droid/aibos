/**
 * AIBOS — Hospitality (short-let PMS) API client.
 *
 * Thin typed wrappers over the FastAPI `/hospitality/*` routes, called through the
 * same `/api/proxy` server hop as the rest of the app (no CORS). Every call carries
 * the Supabase JWT via authHeaders(); the backend is tenant-scoped and gated on the
 * `hospitality` entitlement, so a Free user gets a clean 403 here.
 *
 * The whole point of this module living inside AIBOS: a confirmed booking and an
 * expense already post Sale/Expense events to the spine on the server, so the
 * numbers below also show up in Cash Intel, Timeline and the P&L with no extra work.
 */

import { authHeaders } from '@/lib/api';

const PROXY = '/api/proxy';

async function hfetch(path: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  const headers = { ...(init.headers as Record<string, string>), ...(await authHeaders()) };
  const res = await fetch(`${PROXY}${path}`, { ...init, headers });
  const raw = await res.text();
  let data: Record<string, unknown> = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON (e.g. an .ics feed) */ }
  if (!res.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : `Request failed (${res.status})`;
    throw new HospitalityError(detail, res.status);
  }
  return data;
}

/**
 * An error that still knows what the server answered.
 *
 * Every failure used to arrive as a bare Error carrying only a sentence, so a
 * caller wanting to react to a date clash had to pattern-match English prose.
 * The calendar did exactly that, and the list of words it looked for did not
 * include the word the server actually uses, so a genuine 409 would have shown
 * the raw sentence instead of the plain one. Prose is for people; code should
 * branch on the status.
 */
export class HospitalityError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'HospitalityError';
    this.status = status;
  }
}

/** True when the server said those nights are gone (HTTP 409). */
export function isDatesTaken(e: unknown): boolean {
  return e instanceof HospitalityError && e.status === 409;
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

// ─── Types (mirror migration 0015 / hospitality.py) ─────────────────────────

export type PropertyStatus = 'active' | 'inactive' | 'maintenance';

export interface Property {
  id: string;
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  description?: string | null;
  status: PropertyStatus;
  /** Token the property's own website uses to read availability and send
   *  booking requests (migration 0027). Null until the owner mints one. */
  public_site_token?: string | null;
}
export type PropertyInput = Partial<Omit<Property, 'id'>> & { name: string };

export interface Unit {
  id: string;
  property_id: string;
  unit_name: string;
  bedrooms: number;
  bathrooms: number;
  max_guests: number;
  amenities: string[];
  base_nightly_rate: number;
  currency: string;
  photos: string[];
  /** The handle the property's own website uses for this unit in a URL.
   *  Kept apart from unit_name because a slug lives in links people have
   *  already shared: renaming a unit must not break the public site. */
  public_slug?: string | null;
}
export type UnitInput = Partial<Omit<Unit, 'id' | 'property_id'>> & { unit_name: string; property_id: string };

/** Keep in lock-step with BOOKING_STATUSES in aibos-api/hospitality.py and the
 *  bookings_status_chk constraint in migration 0029. All three are asserted
 *  equal by test_booking_engine.py, because a status one side accepts and
 *  another rejects loses a real booking at the moment somebody presses the
 *  button. This union was the side that got missed when 'declined' was added. */
export type BookingStatus =
  | 'confirmed'
  | 'pending'
  | 'cancelled'
  | 'completed'
  | 'no_show'
  /** A request that was never agreed to. Distinct from 'cancelled', which is an
   *  agreed stay called off. Both free the dates, only one is ever a refund. */
  | 'declined';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded';

export interface Booking {
  id: string;
  unit_id: string;
  guest_id?: string | null;
  channel_id?: string | null;
  check_in: string;   // YYYY-MM-DD
  check_out: string;  // YYYY-MM-DD (exclusive — the free turnover day)
  guests_count: number;
  status: BookingStatus;
  total_amount: number;
  currency: string;
  deposit_amount?: number | null;
  payment_status: PaymentStatus;
  source_notes?: string | null;
  linked_event_id?: string | null;
  external_uid?: string | null;

  /** What the guest actually told us (migration 0029). All of this used to be
   *  one English sentence in source_notes that nothing read back. */
  reference?: string | null;
  source?: BookingSource | null;
  guest_name?: string | null;
  guest_email?: string | null;
  guest_phone?: string | null;
  organisation?: string | null;
  purpose?: string | null;
  arrival_time?: string | null;
  payment_method?: string | null;
  guest_notes?: string | null;
  quoted_total?: number | null;

  /** When the answer was given, and why. */
  confirmed_at?: string | null;
  declined_at?: string | null;
  cancelled_at?: string | null;
  decline_reason?: string | null;
  created_at?: string | null;

  /** The guest record, attached by the server on every list read. Null when the
   *  booking has no guest (an availability block pulled from an OTA feed). */
  guest?: Guest | null;

  /** Is this booking still standing in the way of a paying guest? The server
   *  answers it, because an unanswered WEBSITE request stops holding its nights
   *  after PENDING_HOLD_HOURS and nothing in a status can say so. Screens that
   *  worked it out from the status alone kept a night sold-out here while the
   *  property's own website was busy selling it. Undefined on an older reply,
   *  so test it as `!== false`, never as `=== true`. */
  holding?: boolean;
}

export type BookingSource = 'direct' | 'website' | 'ota' | 'phone' | 'walk_in';

/** How a booking reached us, in the words an owner would use. */
export const SOURCE_LABEL: Record<BookingSource, string> = {
  website: 'Your website',
  direct: 'Added here',
  ota: 'Booking channel',
  phone: 'Phone',
  walk_in: 'Walk-in',
};

/** Nights between arrival and departure. The stay is half-open, so a Friday to
 *  Sunday booking is two nights and Sunday is free for the next guest. */
export function nights(b: Pick<Booking, 'check_in' | 'check_out'>): number {
  const ms = new Date(`${b.check_out}T00:00:00`).getTime() - new Date(`${b.check_in}T00:00:00`).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** A booking's own currency symbol. The calendar used to label every amount
 *  with the FIRST unit's symbol, which is wrong the moment two units differ. */
export function bookingSymbol(b: Pick<Booking, 'currency'>): string {
  return ({ ZMW: 'K', USD: '$', EUR: '\u20ac', GBP: '\u00a3' } as Record<string, string>)[b.currency] ?? b.currency ?? 'K';
}
export type BookingInput =
  Partial<Omit<Booking, 'id' | 'linked_event_id' | 'external_uid'>> &
  { unit_id: string; check_in: string; check_out: string };

export interface Guest {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  id_document_type?: 'passport' | 'national_id' | 'other' | null;
  /** Never the raw number in a list/get — sealed server-side. */
  id_document_on_file?: boolean;
  id_document_masked?: string | null;
  /** Only present on a single-guest read with ?reveal=true. */
  id_document_number?: string | null;
  nationality?: string | null;
  is_repeat_guest?: boolean;
  stay_count?: number;
  notes?: string | null;
  vip_flag?: boolean;
}
export type GuestInput = Partial<Omit<Guest, 'id'>> & { full_name: string };

export type ChannelType = 'direct' | 'booking_com' | 'airbnb' | 'ical_generic';
export type SyncStatus = 'ok' | 'error' | 'unconfigured';

export interface Channel {
  id: string;
  unit_id: string;
  channel_type: ChannelType;
  external_listing_id?: string | null;
  ical_import_url?: string | null;
  ical_export_token?: string | null;
  sync_status: SyncStatus;
  last_synced_at?: string | null;
  last_sync_note?: string | null;
}
export type ChannelInput = { channel_type?: ChannelType; external_listing_id?: string; ical_import_url?: string };

export type ExpenseCategory =
  | 'utilities' | 'staff' | 'security' | 'cleaning_supplies'
  | 'maintenance' | 'marketing' | 'ota_commission' | 'other';

export interface HospitalityExpense {
  id: string;
  property_id?: string | null;
  unit_id?: string | null;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  date_incurred?: string | null;
  description?: string | null;
  receipt_url?: string | null;
  linked_event_id?: string | null;
}
export type ExpenseInput = Partial<Omit<HospitalityExpense, 'id' | 'linked_event_id'>> & { amount: number; category: ExpenseCategory };

export interface AvailabilityBlock {
  booking_id: string;
  check_in: string;
  check_out: string;
  status: BookingStatus;
  channel_id?: string | null;
  guest_id?: string | null;
}
export interface Availability {
  unit_id: string;
  from?: string | null;
  to?: string | null;
  blocks: AvailabilityBlock[];
}

export interface SyncResult {
  ok: boolean;
  status: SyncStatus;
  note: string;
  imported?: number;
  updated?: number;
  cancelled?: number;
  skipped_own?: number;
}

// ─── Properties ─────────────────────────────────────────────────────────────

export async function listProperties(): Promise<Property[]> {
  return ((await hfetch('/hospitality/properties')).properties as Property[]) ?? [];
}
export async function createProperty(input: PropertyInput): Promise<Property> {
  return (await hfetch('/hospitality/properties', jsonInit('POST', input))).property as Property;
}
export async function updateProperty(id: string, patch: Partial<PropertyInput>): Promise<Property> {
  return (await hfetch(`/hospitality/properties/${id}`, jsonInit('PATCH', patch))).property as Property;
}
export async function deleteProperty(id: string): Promise<void> {
  await hfetch(`/hospitality/properties/${id}`, { method: 'DELETE' });
}

/** Mint the token the property's own website uses, or replace the one it has.
 *  Rotating is the revoke: whoever holds the old one is cut off at once. */
export async function mintSiteToken(propertyId: string): Promise<Property> {
  return (await hfetch(`/hospitality/properties/${propertyId}/site-token`, { method: 'POST' })).property as Property;
}
/** Take the public website offline. */
export async function clearSiteToken(propertyId: string): Promise<Property> {
  return (await hfetch(`/hospitality/properties/${propertyId}/site-token`, { method: 'DELETE' })).property as Property;
}

// ─── Units (single source of truth) ─────────────────────────────────────────

export async function listUnits(propertyId?: string): Promise<Unit[]> {
  const q = propertyId ? `?property_id=${encodeURIComponent(propertyId)}` : '';
  return ((await hfetch(`/hospitality/units${q}`)).units as Unit[]) ?? [];
}
export async function createUnit(input: UnitInput): Promise<Unit> {
  return (await hfetch('/hospitality/units', jsonInit('POST', input))).unit as Unit;
}
export async function updateUnit(id: string, patch: Partial<UnitInput>): Promise<Unit> {
  return (await hfetch(`/hospitality/units/${id}`, jsonInit('PATCH', patch))).unit as Unit;
}
export async function deleteUnit(id: string): Promise<void> {
  await hfetch(`/hospitality/units/${id}`, { method: 'DELETE' });
}

// ─── Bookings + availability (the P0 core loop) ─────────────────────────────

export async function listBookings(params: {
  unit_id?: string; status?: BookingStatus; from?: string; to?: string;
  /** A SET of statuses. The question an owner asks is "what is pending OR
   *  confirmed", which one status cannot express. */
  statuses?: BookingStatus[];
  source?: BookingSource;
  /** Matches a guest name, a reference, a phone number or a company. */
  search?: string;
  order?: 'check_in' | 'check_out' | 'created_at';
  limit?: number;
} = {}): Promise<Booking[]> {
  const q = new URLSearchParams();
  if (params.unit_id) q.set('unit_id', params.unit_id);
  if (params.status) q.set('status', params.status);
  if (params.statuses?.length) q.set('statuses', params.statuses.join(','));
  if (params.source) q.set('source', params.source);
  if (params.search) q.set('search', params.search);
  if (params.order) q.set('order', params.order);
  if (params.limit) q.set('limit', String(params.limit));
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  const qs = q.toString();
  return ((await hfetch(`/hospitality/bookings${qs ? `?${qs}` : ''}`)).bookings as Booking[]) ?? [];
}

/** One booking, refetched after a write without re-listing everything. */
export async function getBooking(id: string): Promise<Booking> {
  return (await hfetch(`/hospitality/bookings/${id}`)).booking as Booking;
}

/** Everything this guest has ever booked. The route has existed on the server
 *  since the module shipped and had no client function, so the stay history was
 *  built and unreachable. */
export async function listGuestBookings(guestId: string): Promise<Booking[]> {
  return ((await hfetch(`/hospitality/guests/${guestId}/bookings`)).bookings as Booking[]) ?? [];
}

/** Say yes. This is what puts the stay in the books. */
export async function confirmBooking(id: string): Promise<Booking> {
  return (await hfetch(`/hospitality/bookings/${id}/confirm`, { method: 'POST' })).booking as Booking;
}

/** Turn down a request that was never agreed to. Frees the dates, records why,
 *  and touches nothing in the books because nothing was ever posted. */
export async function declineBooking(id: string, reason?: string): Promise<Booking> {
  return (await hfetch(`/hospitality/bookings/${id}/decline`, jsonInit('POST', { reason }))).booking as Booking;
}
export async function createBooking(input: BookingInput): Promise<Booking> {
  return (await hfetch('/hospitality/bookings', jsonInit('POST', input))).booking as Booking;
}
export async function updateBooking(id: string, patch: Partial<BookingInput>): Promise<Booking> {
  return (await hfetch(`/hospitality/bookings/${id}`, jsonInit('PATCH', patch))).booking as Booking;
}
export async function cancelBooking(id: string): Promise<Booking> {
  return (await hfetch(`/hospitality/bookings/${id}/cancel`, { method: 'POST' })).booking as Booking;
}
export async function getAvailability(unitId: string, from?: string, to?: string): Promise<Availability> {
  const q = new URLSearchParams({ unit_id: unitId });
  if (from) q.set('from', from);
  if (to) q.set('to', to);
  return (await hfetch(`/hospitality/availability?${q.toString()}`)) as unknown as Availability;
}

// ─── Guests ─────────────────────────────────────────────────────────────────

export async function listGuests(search?: string): Promise<Guest[]> {
  const q = search ? `?search=${encodeURIComponent(search)}` : '';
  return ((await hfetch(`/hospitality/guests${q}`)).guests as Guest[]) ?? [];
}
export async function getGuest(id: string, reveal = false): Promise<Guest> {
  return (await hfetch(`/hospitality/guests/${id}${reveal ? '?reveal=true' : ''}`)).guest as Guest;
}
export async function createGuest(input: GuestInput): Promise<Guest> {
  return (await hfetch('/hospitality/guests', jsonInit('POST', input))).guest as Guest;
}
export async function updateGuest(id: string, patch: Partial<GuestInput>): Promise<Guest> {
  return (await hfetch(`/hospitality/guests/${id}`, jsonInit('PATCH', patch))).guest as Guest;
}
export async function deleteGuest(id: string): Promise<void> {
  await hfetch(`/hospitality/guests/${id}`, { method: 'DELETE' });
}

// ─── Channels + iCal sync ───────────────────────────────────────────────────

export async function listChannels(unitId: string): Promise<Channel[]> {
  return ((await hfetch(`/hospitality/units/${unitId}/channels`)).channels as Channel[]) ?? [];
}
export async function createChannel(unitId: string, input: ChannelInput): Promise<Channel> {
  return (await hfetch(`/hospitality/units/${unitId}/channels`, jsonInit('POST', input))).channel as Channel;
}
export async function updateChannel(id: string, patch: ChannelInput): Promise<Channel> {
  return (await hfetch(`/hospitality/channels/${id}`, jsonInit('PATCH', patch))).channel as Channel;
}
export async function deleteChannel(id: string): Promise<void> {
  await hfetch(`/hospitality/channels/${id}`, { method: 'DELETE' });
}
export async function syncChannel(id: string): Promise<SyncResult> {
  return (await hfetch(`/hospitality/channels/${id}/sync`, { method: 'POST' })).result as SyncResult;
}
export async function rotateExportToken(id: string): Promise<Channel> {
  return (await hfetch(`/hospitality/channels/${id}/rotate-token`, { method: 'POST' })).channel as Channel;
}
/** The public feed URL an OTA imports — built from the export token. */
export function icalFeedUrl(token: string): string {
  if (typeof window === 'undefined') return `/api/proxy/hospitality/ical/${token}.ics`;
  return `${window.location.origin}/api/proxy/hospitality/ical/${token}.ics`;
}

/** The address a property's own website calls. This is what goes into the
 *  site's NEXT_PUBLIC_AIBOS_API_URL, so it must be the API itself and NOT the
 *  /api/proxy hop: the proxy attaches this browser's session, and a public
 *  website has none. */
export function publicSiteBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? '';
}

// ─── Expenses (feed the spine → engine.py) ──────────────────────────────────

export async function listExpenses(params: { property_id?: string; unit_id?: string; from?: string; to?: string; category?: ExpenseCategory } = {}): Promise<HospitalityExpense[]> {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, String(v)); });
  const qs = q.toString();
  return ((await hfetch(`/hospitality/expenses${qs ? `?${qs}` : ''}`)).expenses as HospitalityExpense[]) ?? [];
}
export async function createExpense(input: ExpenseInput): Promise<HospitalityExpense> {
  return (await hfetch('/hospitality/expenses', jsonInit('POST', input))).expense as HospitalityExpense;
}
export async function updateExpense(id: string, patch: Partial<ExpenseInput>): Promise<HospitalityExpense> {
  return (await hfetch(`/hospitality/expenses/${id}`, jsonInit('PATCH', patch))).expense as HospitalityExpense;
}
export async function deleteExpense(id: string): Promise<void> {
  await hfetch(`/hospitality/expenses/${id}`, { method: 'DELETE' });
}

// ─── Derived metrics (client-side rollups for the dashboard) ────────────────

/** Nights sold ÷ nights available across a set of units, over [from,to). 0–1. */
export function occupancyRate(units: Unit[], bookings: Booking[], from: Date, to: Date): number {
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000));
  const capacity = units.length * days;
  if (capacity === 0) return 0;
  let sold = 0;
  for (const b of bookings) {
    // The status list was written before `declined` existed and before a hold
    // could lapse, so it counted both as occupancy.
    if (b.status === 'cancelled' || b.status === 'no_show' || b.status === 'declined') continue;
    if (b.holding === false) continue;
    const ci = new Date(b.check_in + 'T00:00:00');
    const co = new Date(b.check_out + 'T00:00:00');
    const start = ci < from ? from : ci;
    const end = co > to ? to : co;
    const nights = Math.round((end.getTime() - start.getTime()) / 86_400_000);
    if (nights > 0) sold += nights;
  }
  return Math.min(1, sold / capacity);
}
