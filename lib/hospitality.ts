/**
 * AI-BOS — Hospitality (short-let PMS) API client.
 *
 * Thin typed wrappers over the FastAPI `/hospitality/*` routes, called through the
 * same `/api/proxy` server hop as the rest of the app (no CORS). Every call carries
 * the Supabase JWT via authHeaders(); the backend is tenant-scoped and gated on the
 * `hospitality` entitlement, so a Free user gets a clean 403 here.
 *
 * The whole point of this module living inside AI-BOS: a confirmed booking and an
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
    throw new Error(detail);
  }
  return data;
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
}
export type UnitInput = Partial<Omit<Unit, 'id' | 'property_id'>> & { unit_name: string; property_id: string };

export type BookingStatus = 'confirmed' | 'pending' | 'cancelled' | 'completed' | 'no_show';
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

export async function listBookings(params: { unit_id?: string; status?: BookingStatus; from?: string; to?: string } = {}): Promise<Booking[]> {
  const q = new URLSearchParams();
  if (params.unit_id) q.set('unit_id', params.unit_id);
  if (params.status) q.set('status', params.status);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  const qs = q.toString();
  return ((await hfetch(`/hospitality/bookings${qs ? `?${qs}` : ''}`)).bookings as Booking[]) ?? [];
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
    if (b.status === 'cancelled' || b.status === 'no_show') continue;
    const ci = new Date(b.check_in + 'T00:00:00');
    const co = new Date(b.check_out + 'T00:00:00');
    const start = ci < from ? from : ci;
    const end = co > to ? to : co;
    const nights = Math.round((end.getTime() - start.getTime()) / 86_400_000);
    if (nights > 0) sold += nights;
  }
  return Math.min(1, sold / capacity);
}
