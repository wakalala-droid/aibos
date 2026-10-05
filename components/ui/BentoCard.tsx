'use client';

// BentoCard: the owner's monochrome bento (5 Oct 2026), in AIBOS's sizes.
// A hairline card with a soft shadow and one faint wash of light from its
// top-left corner; a round outlined icon; a spaced-capitals title with a
// small tag on the right; plain words under it; anything else (buttons,
// figures) at the foot. Hover lifts it and wakes the icon, so it answers the
// hand without moving on its own. Sits in a .bento-grid with span-2/3/4/6
// and rows-2 to make the modular layout.
//
// Text follows the AIBOS floor: the title is spaced capitals at 18px, the tag
// 16px, the words 18px (the reference used 10 to 14px).

import Link from 'next/link';

type Motion = 'float' | 'pulse' | 'tilt';

/** Grid placement for n cards in a .bento-grid, so the grid never leaves a
 *  hole: one card spans the row, two split it, three use the reference's
 *  big card with two beside it, four pair up and five use the full reference
 *  layout (4+2 tall, then 2, then 3 and 3). Past five they pair up, and an odd
 *  last card spans the row. */
export function bentoSpans(n: number): string[] {
  if (n <= 0) return [];
  if (n === 1) return ['span-6'];
  if (n === 2) return ['span-3', 'span-3'];
  if (n === 3) return ['span-4 rows-2', 'span-2', 'span-2'];
  if (n === 4) return ['span-3', 'span-3', 'span-3', 'span-3'];
  const out = ['span-4 rows-2', 'span-2', 'span-2', 'span-3', 'span-3'];
  const rest = n - 5;
  for (let i = 0; i < rest; i++) out.push(i === rest - 1 && rest % 2 === 1 ? 'span-6' : 'span-3');
  return out;
}

export default function BentoCard({
  icon, title, tag, text, children, foot, href, onClick, className = '', motion = 'float',
  titleAs: Title = 'h3', style, explainId,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  tag?: React.ReactNode;
  text?: React.ReactNode;
  children?: React.ReactNode;
  /** Buttons or a figure along the bottom. */
  foot?: React.ReactNode;
  /** The whole card opens this page. */
  href?: string;
  onClick?: () => void;
  /** Grid placement: 'span-4 rows-2', 'span-2', ... */
  className?: string;
  motion?: Motion;
  titleAs?: 'h2' | 'h3' | 'h4';
  style?: React.CSSProperties;
  explainId?: string;
}) {
  const cls = `bento${motion === 'float' ? '' : ` motion-${motion}`} ${className}`.trim();
  const body = (
    <>
      <div className="bento-head">
        {icon && <span className="bento-icon" aria-hidden="true">{icon}</span>}
        <div className="bento-main">
          <div className="bento-titlerow">
            <Title className="bento-title">{title}</Title>
            {tag && <span className="bento-tag">{tag}</span>}
          </div>
          {text && <div className="bento-text">{text}</div>}
          {children}
        </div>
      </div>
      {foot && <div className="bento-foot">{foot}</div>}
    </>
  );
  if (href) {
    return <Link href={href} className={cls} style={style} data-ai-explain={explainId}>{body}</Link>;
  }
  if (onClick) {
    return <button type="button" onClick={onClick} className={cls} style={{ textAlign: 'left', font: 'inherit', ...style }} data-ai-explain={explainId}>{body}</button>;
  }
  return <article className={cls} style={style} data-ai-explain={explainId}>{body}</article>;
}
