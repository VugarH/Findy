"use client";

import { useSyncExternalStore } from "react";
import { CART_LIMITS, sanitizeCart, type CartItem } from "@/modules/cart/items";

/**
 * The cart, kept in this browser's localStorage: no account needed, and
 * adding an item never reloads the page. Every component reads it through
 * useCartItems(), so all of them update together (also across tabs).
 */

const KEY = "serfeli:cart";
const CHANGED = "serfeli:cart-changed";
/** Fired after an add / a removal by a product's cart button, for the "Added" / "Removed" message. */
export const CART_ADDED = "serfeli:cart-added";
export const CART_REMOVED = "serfeli:cart-removed";

const EMPTY: CartItem[] = [];
let cached: { raw: string | null; items: CartItem[] } = { raw: null, items: EMPTY };

function read(): CartItem[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // Storage blocked: the cart is simply empty.
  }
  if (raw !== cached.raw) {
    let parsed: unknown = [];
    try {
      parsed = raw ? JSON.parse(raw) : [];
    } catch {
      // A damaged value starts a new cart.
    }
    cached = { raw, items: sanitizeCart(parsed) };
  }
  return cached.items;
}

function write(items: CartItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    return;
  }
  window.dispatchEvent(new Event(CHANGED));
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => event.key === KEY && onChange();
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGED, onChange);
  };
}

/** The cart's lines. Empty on the server and during hydration, then the saved cart. */
export function useCartItems(): CartItem[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

const noop = () => () => {};
/** False on the server and during hydration: lets the cart page wait instead of flashing "empty". */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

export const cart = {
  /** Adds one more of an offer. "full" when the cart already has the most lines it may hold. */
  add(offerId: string): "added" | "full" {
    const items = read();
    const existing = items.find((item) => item.offerId === offerId);
    if (existing) {
      write(items.map((item) => (item === existing ? { ...item, quantity: Math.min(CART_LIMITS.quantity, item.quantity + 1) } : item)));
    } else {
      if (items.length >= CART_LIMITS.lines) return "full";
      write([...items, { offerId, quantity: 1 }]);
    }
    window.dispatchEvent(new Event(CART_ADDED));
    return "added";
  },
  setQuantity(offerId: string, quantity: number) {
    write(sanitizeCart(read().map((item) => (item.offerId === offerId ? { ...item, quantity } : item))));
  },
  remove(...offerIds: string[]) {
    write(read().filter((item) => !offerIds.includes(item.offerId)));
  },
  /** Taken out with the product's own button (a misclick undone), announced with a short message. */
  undoAdd(offerId: string) {
    cart.remove(offerId);
    window.dispatchEvent(new Event(CART_REMOVED));
  },
  /** Swaps a listing for another (the same product, now cheaper or in stock elsewhere). */
  replace(offerId: string, withOfferId: string) {
    const items = read();
    const merged = items.some((item) => item.offerId === withOfferId)
      ? items.filter((item) => item.offerId !== offerId)
      : items.map((item) => (item.offerId === offerId ? { ...item, offerId: withOfferId } : item));
    write(merged);
  },
  clear() {
    write([]);
  },
};
