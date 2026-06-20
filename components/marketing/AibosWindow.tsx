import type { ReactNode } from 'react';

// Browser-window frame for genuine product components on the marketing site.
// data-theme="dark" scopes the product's real dark tokens to this subtree.
export default function AibosWindow({ url, children }: { url: string; children: ReactNode }) {
  return (
    <div className="aibos-window" data-theme="dark">
      <div className="aibos-window-bar">
        <span className="aibos-window-dots">
          <i style={{ background: '#ff5f57' }} /><i style={{ background: '#febc2e' }} /><i style={{ background: '#28c840' }} />
        </span>
        <span className="aibos-window-url">{url}</span>
      </div>
      <div className="aibos-window-body">{children}</div>
    </div>
  );
}
