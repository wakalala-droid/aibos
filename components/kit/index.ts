/**
 * AI-BOS UI kit: the AIBOS x Mercury pieces every screen, notice and email is
 * built from (owner, 7 Oct 2026). Import from here, never build a one-off.
 * The guide is docs/AIBOS_UI_KIT.md.
 */

// Brand: the mark, and the splash art strip (tiles, money line, the mark in
// its rings in the middle, the rising double arrow on the right).
export { BrandMark, NoticeArt } from '@/components/ui/Notice';

// Anything that interrupts the owner: updates, reminders, low money, plan.
export { default as Notice } from '@/components/ui/Notice';

// Cards: the bento card and its gap-free grid spans, the panel, the section.
export { default as BentoCard, bentoSpans } from '@/components/ui/BentoCard';
export { default as Panel } from '@/components/home/Panel';
export { default as SectionCard } from '@/components/ui/SectionCard';

// Figures: one ink colour; red only for a figure that went the wrong way.
export { default as BigMoney } from '@/components/home/BigMoney';
export { default as Stat } from '@/components/ui/Stat';
export { INK, BAD, trendTone, signTone, CHART_RAMP, severityWord } from '@/lib/tone';

// Charts: the key under a chart title.
export { default as ChartKey } from '@/components/ui/ChartKey';
