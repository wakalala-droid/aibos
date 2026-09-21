'use client';

/**
 * Paddle's own payment links land here.
 *
 * Paddle sends some checkouts by link rather than through our checkout page: a
 * card that needs updating, or a payment link made in the Paddle dashboard.
 * Each link is the account's "default payment link" (set in Paddle to
 * https://ai-bos.website/pricing) with ?_ptxn=txn_... on the end. Paddle.js,
 * once started on the page, sees that and opens the card form by itself.
 *
 * Nothing is loaded for anyone else: an ordinary visit to the pricing page
 * never fetches Paddle.js.
 */
import { useEffect } from 'react';
import { getCardConfig } from '@/lib/api';
import { ensurePaddle } from '@/lib/paddle';

export default function PaddleLinkHandler() {
  useEffect(() => {
    let txn: string | null = null;
    try { txn = new URL(window.location.href).searchParams.get('_ptxn'); } catch { /* no URL */ }
    if (!txn) return;
    void (async () => {
      const cfg = await getCardConfig();
      if (!cfg.enabled || !cfg.client_token) return;
      try {
        await ensurePaddle(cfg.client_token, cfg.environment);
      } catch { /* Paddle.js blocked or offline: the page still shows the plans */ }
    })();
  }, []);
  return null;
}
