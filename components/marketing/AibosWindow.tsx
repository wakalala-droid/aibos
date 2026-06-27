import type { ReactNode } from 'react';

// Clean panel frame for genuine product components on the marketing site.
// data-theme="dark" scopes the product's real dark tokens to this subtree.
// No fabricated browser chrome or URL bar — it matches the hero surface.
export default function AibosWindow({ children }: { children: ReactNode }) {
  return (
    <div className="aibos-window" data-theme="dark">
      <div className="aibos-window-body">{children}</div>
    </div>
  );
}
