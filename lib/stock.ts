// lib/stock.ts — what the stock on hand is worth, one rule for every screen.
//
// Each product's count (never below nothing) times its buy price, each line
// rounded half up to the ngwee, then added up: the server's own figure
// (aibos-api products.stock_value), so the Stock page and the assistant agree.
//
// The assistant used to quote the books' inventory_value instead, which adds
// up every delivery ever received and never comes down when stock is sold.

import type { Product } from './api';
import { linesTotal, sumMoney } from './ngwee';

export function stockValue(products: Pick<Product, 'on_hand' | 'opening_stock' | 'buy_price'>[]): number {
  return sumMoney(products.map((p) => linesTotal([{
    qty: Math.max(0, Number(p.on_hand ?? p.opening_stock ?? 0) || 0),
    unit_price: Number(p.buy_price) || 0,
  }])));
}
