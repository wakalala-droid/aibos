// The ONE list of places in the product (UI/UX audit 2026-10, A5 to A8, A14).
//
// The side menu, the phone's bottom bar and the search box are all built from
// this file, so a page can never have two names or go missing from one of them
// again. Before this, the search box kept its own hand-typed copy that drifted
// (Stock, Staff, Record and Rooms & Stays were unsearchable), and Simple and Pro
// gave the same page different names.
//
// Names are owner words. Each page's own title matches its label here.

import { canAccess, type Feature, type Tier } from '@/lib/tiers';

export type NavIcon =
  | 'overview' | 'record' | 'cash' | 'invoice' | 'customers' | 'rooms' | 'inventory'
  | 'people' | 'schedule' | 'timeline' | 'import' | 'brief' | 'variance' | 'forecast'
  | 'anomaly' | 'breakeven' | 'simulate' | 'churn' | 'products' | 'market' | 'pos'
  | 'benchmarks';

export interface NavDoor {
  href: string;
  label: string;
  /** Shorter name for the phone's bottom bar, where space is tight. */
  short?: string;
  icon: NavIcon;
  /** Other words an owner might type into search for this page. */
  keywords: string[];
  /** 'main' doors show in both modes; 'reports' only in Pro's Reports group. */
  group: 'main' | 'reports';
  /** Shown only when the plan includes this feature. */
  feature?: Feature;
  /** Needs Engine 2 (customers) or Engine 3 (till) data before it has anything to show. */
  engine?: 'ci' | 'ops';
}

export const DOORS: NavDoor[] = [
  { href: '/dashboard',             label: 'Home',          icon: 'overview',  group: 'main', keywords: ['today', 'overview', 'dashboard', 'start', 'morning brief'] },
  { href: '/dashboard/record',      label: 'Record',        icon: 'record',    group: 'main', keywords: ['add', 'sale', 'sold', 'expense', 'spent', 'enter', 'receipt'] },
  { href: '/dashboard/cash',        label: 'Money',         icon: 'cash',      group: 'main', keywords: ['cash', 'balance', 'bank', 'runway', 'profit', 'spending', 'cash intelligence'] },
  { href: '/dashboard/invoices',    label: 'Get paid',      icon: 'invoice',   group: 'main', keywords: ['invoice', 'invoices', 'bill', 'payment link', 'owed', 'debtors', 'receivables'] },
  { href: '/dashboard/contacts',    label: 'Customers',     icon: 'customers', group: 'main', keywords: ['contacts', 'clients', 'suppliers', 'people', 'who owes'] },
  { href: '/dashboard/hospitality', label: 'Rooms & Stays', short: 'Rooms', icon: 'rooms',     group: 'main', feature: 'hospitality', keywords: ['bookings', 'booking', 'rooms', 'stays', 'guests', 'units', 'calendar', 'hospitality', 'airbnb'] },
  { href: '/dashboard/inventory',   label: 'Stock',         icon: 'inventory', group: 'main', keywords: ['inventory', 'products', 'items', 'reorder', 'catalog'] },
  { href: '/dashboard/employees',   label: 'Staff',         icon: 'people',    group: 'main', keywords: ['employees', 'payroll', 'wages', 'salary', 'paye', 'napsa', 'payslip'] },
  { href: '/dashboard/schedule',    label: 'Schedule',      icon: 'schedule',  group: 'main', keywords: ['calendar', 'reminders', 'meetings', 'deadlines', 'zra', 'pick-up'] },
  { href: '/dashboard/timeline',    label: 'Activity',      icon: 'timeline',  group: 'main', keywords: ['timeline', 'entries', 'history', 'records', 'transactions', 'void', 'remove'] },

  { href: '/dashboard/brief',       label: 'Briefs',              icon: 'brief',      group: 'reports', keywords: ['brief', 'summary', 'recommendations', 'advice', 'advisor'] },
  { href: '/dashboard/variance',    label: 'Month by month',      icon: 'variance',   group: 'reports', keywords: ['variance', 'changes', 'compare months', 'cost spike'] },
  { href: '/dashboard/forecast',    label: 'Forecast',            icon: 'forecast',   group: 'reports', keywords: ['projection', 'future', 'predict', 'next month'] },
  { href: '/dashboard/anomaly',     label: 'Unusual spending',    icon: 'anomaly',    group: 'reports', keywords: ['anomaly', 'anomalies', 'spike', 'outlier', 'strange'] },
  { href: '/dashboard/breakeven',   label: 'Breakeven',           icon: 'breakeven',  group: 'reports', keywords: ['break even', 'cover costs', 'minimum sales'] },
  { href: '/dashboard/simulate',    label: 'What if',             icon: 'simulate',   group: 'reports', keywords: ['simulator', 'scenario', 'what if', 'price change'] },
  { href: '/dashboard/customers',   label: 'Best customers',      icon: 'customers',  group: 'reports', engine: 'ci', keywords: ['customer intelligence', 'rfm', 'loyal', 'top customers', 'lifetime value'] },
  { href: '/dashboard/churn',       label: 'Quiet customers',     icon: 'churn',      group: 'reports', engine: 'ci', keywords: ['churn', 'lost customers', 'drifting', 'inactive'] },
  { href: '/dashboard/products',    label: 'Product performance', icon: 'products',   group: 'reports', engine: 'ci', keywords: ['product matrix', 'best sellers', 'product intelligence'] },
  { href: '/dashboard/market',      label: 'Market',              icon: 'market',     group: 'reports', engine: 'ci', keywords: ['market intelligence', 'segments'] },
  { href: '/dashboard/pos',         label: 'Till sales',          icon: 'pos',        group: 'reports', engine: 'ops', keywords: ['pos', 'till', 'point of sale', 'pos intelligence'] },
  { href: '/dashboard/benchmarks',  label: 'How you compare',     icon: 'benchmarks', group: 'reports', engine: 'ops', keywords: ['benchmarks', 'industry', 'compare'] },
  { href: '/dashboard/import',      label: 'Upload a file',       icon: 'import',     group: 'reports', keywords: ['import', 'excel', 'csv', 'spreadsheet', 'upload'] },
];

/** Account pages: searchable, reached from the account menu, not the side menu. */
export const ACCOUNT_DOORS: { href: string; label: string; keywords: string[] }[] = [
  { href: '/dashboard/profile', label: 'Settings',       keywords: ['profile', 'business profile', 'logo', 'team', 'invite', 'mobile money', 'export', 'currency'] },
  { href: '/dashboard/billing', label: 'Plan & billing', keywords: ['plan', 'billing', 'subscription', 'receipt', 'upgrade', 'cancel'] },
];

/** Things the search box can DO, not just open. */
export const ACTIONS: { href: string; label: string; keywords: string[]; feature?: Feature }[] = [
  { href: '/dashboard/record',              label: 'Record a sale',      keywords: ['sale', 'sold', 'record', 'add'] },
  { href: '/dashboard/record',              label: 'Record an expense',  keywords: ['expense', 'spent', 'paid', 'cost', 'record'] },
  { href: '/dashboard/invoices?new=1',      label: 'New invoice',        keywords: ['invoice', 'bill', 'get paid', 'new'] },
  { href: '/dashboard/hospitality?new=1',   label: 'New booking',        keywords: ['booking', 'guest', 'stay', 'room', 'new'], feature: 'hospitality' },
  { href: '/dashboard/schedule',            label: 'Add a reminder',     keywords: ['reminder', 'schedule', 'meeting', 'deadline', 'new'] },
];

export type TeamRole = 'owner' | 'staff' | 'accountant' | string | null | undefined;

// Staff see the day-to-day (record and plan), not the money pages; accountants
// read everything but the write-only capture pages. Owners see everything.
// Employees/Payroll is owner-only on the server, so its door is hidden rather
// than offered and then refused.
const STAFF_HREFS = new Set([
  '/dashboard', '/dashboard/record', '/dashboard/timeline', '/dashboard/schedule',
  '/dashboard/inventory', '/dashboard/hospitality',
]);
const ACCOUNTANT_HIDE = new Set(['/dashboard/record', '/dashboard/import', '/dashboard/employees']);

export function roleAllows(role: TeamRole, href: string): boolean {
  const path = href.split('?')[0];
  if (role === 'staff') return STAFF_HREFS.has(path);
  if (role === 'accountant') return !ACCOUNTANT_HIDE.has(path);
  return true;
}

/** The doors this person can see on this plan, in menu order. */
export function visibleDoors(tier: Tier, role: TeamRole): NavDoor[] {
  return DOORS.filter((d) => (!d.feature || canAccess(tier, d.feature)) && roleAllows(role, d.href));
}

/** Does `pathname` belong to this door (the door or any page under it)? */
export function isDoorActive(doorHref: string, pathname: string): boolean {
  if (doorHref === '/dashboard') return pathname === '/dashboard';
  return pathname === doorHref || pathname.startsWith(doorHref + '/');
}

/**
 * The phone's bottom bar: the four doors this person uses most, then "More"
 * (which opens the full menu). Built from the same list, so it follows the
 * plan (Rooms & Stays for hospitality) and the team role.
 */
export function tabBarDoors(tier: Tier, role: TeamRole): NavDoor[] {
  const hospitality = canAccess(tier, 'hospitality');
  const order =
    role === 'staff' ? ['/dashboard', '/dashboard/record', '/dashboard/schedule', '/dashboard/inventory']
    : role === 'accountant' ? ['/dashboard', '/dashboard/cash', '/dashboard/invoices', '/dashboard/timeline']
    : hospitality ? ['/dashboard', '/dashboard/hospitality', '/dashboard/record', '/dashboard/cash']
    : ['/dashboard', '/dashboard/record', '/dashboard/cash', '/dashboard/invoices'];
  const doors = visibleDoors(tier, role);
  return order
    .map((href) => doors.find((d) => d.href === href))
    .filter((d): d is NavDoor => !!d)
    .slice(0, 4);
}

/** Search: pages, account pages and actions that match what was typed. */
export interface SearchHit { href: string; label: string; group: string }

export function searchPlaces(query: string, tier: Tier, role: TeamRole): SearchHit[] {
  const q = query.trim().toLowerCase();
  const matches = (label: string, keywords: string[]) =>
    !q || label.toLowerCase().includes(q) || keywords.some((k) => k.includes(q) || (q.length >= 4 && q.includes(k)));

  const doors = visibleDoors(tier, role)
    .filter((d) => matches(d.label, d.keywords))
    .map((d) => ({ href: d.href, label: d.label, group: d.group === 'reports' ? 'Reports' : 'Page' }));
  const account = ACCOUNT_DOORS
    .filter((d) => role !== 'staff' && matches(d.label, d.keywords))
    .map((d) => ({ href: d.href, label: d.label, group: 'Account' }));
  if (!q) return [...doors, ...account];
  const actions = ACTIONS
    .filter((a) => (!a.feature || canAccess(tier, a.feature)) && roleAllows(role, a.href) && matches(a.label, a.keywords))
    .map((a) => ({ href: a.href, label: a.label, group: 'Do' }));
  return [...actions, ...doors, ...account];
}
