/**
 * What the cart holds: store listings (offers) and how many of each. The cart
 * lives in the visitor's browser (components/cart/cart-store.ts), so this file
 * is client-safe: no database, no server code.
 */

export interface CartItem {
  offerId: string;
  quantity: number;
}

export const CART_LIMITS = { lines: 30, quantity: 10 } as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whatever arrives (localStorage, a request) as a valid cart: known shape, no duplicates, within the limits. */
export function sanitizeCart(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const items: CartItem[] = [];
  for (const entry of value) {
    if (items.length >= CART_LIMITS.lines) break;
    const { offerId, quantity } = (entry ?? {}) as Partial<CartItem>;
    if (typeof offerId !== "string" || !UUID.test(offerId) || seen.has(offerId)) continue;
    seen.add(offerId);
    const count = Math.floor(Number(quantity));
    items.push({ offerId, quantity: Math.min(CART_LIMITS.quantity, Math.max(1, Number.isFinite(count) ? count : 1)) });
  }
  return items;
}
