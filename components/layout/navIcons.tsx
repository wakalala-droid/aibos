// Line icons for the side menu, the phone's bottom bar and the bento cards
// that open the same pages (second bento pass, 5 Oct 2026). One family
// (lucide), one weight, so a door looks the same wherever it appears: the
// menu, the phone bar, Home's "Go deeper" cards and the card icons.

import {
  BedDouble, CalendarDays, ChartColumn, CirclePlus, FlaskConical, Globe, History, House,
  IdCard, Layers, LayoutGrid, ListChecks, Lock, Menu, Moon, Package, ReceiptText, Scale,
  ShieldCheck, SlidersHorizontal, Sparkles, Store, Sun, Tag, TrendingUp, TriangleAlert,
  Upload, UserMinus, Users, Wallet, type LucideIcon,
} from 'lucide-react';

/** The icon for each door in lib/nav.ts, and a few controls. */
export const NAV_GLYPH: Record<string, LucideIcon> = {
  overview: House,
  record: CirclePlus,
  cash: Wallet,
  invoice: ReceiptText,
  customers: Users,
  rooms: BedDouble,
  inventory: Package,
  people: IdCard,
  schedule: CalendarDays,
  timeline: History,
  import: Upload,
  brief: ListChecks,
  variance: ChartColumn,
  forecast: TrendingUp,
  anomaly: TriangleAlert,
  breakeven: Scale,
  simulate: FlaskConical,
  churn: UserMinus,
  products: Layers,
  market: Globe,
  pos: Store,
  benchmarks: LayoutGrid,
  advisor: Sparkles,
  admin: ShieldCheck,
  pricing: Tag,
  more: Menu,
  sliders: SlidersHorizontal,
  sun: Sun,
  moon: Moon,
  lock: Lock,
};

export const IC: Record<string, JSX.Element> = Object.fromEntries(
  Object.entries(NAV_GLYPH).map(([key, Icon]) => [
    key,
    <Icon key={key} size={key === 'lock' ? 16 : 20} strokeWidth={1.75} aria-hidden="true" />,
  ]),
);
