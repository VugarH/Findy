"use server";

import { loadMarket } from "@/modules/pricing/fx";
import { sanitizeCart } from "./items";
import type { CartView } from "./plan";
import { loadCart } from "./service";

/** Prices the visitor's cart (kept in their browser) with today's offers. Open to everyone: it only reads. */
export async function priceCartAction(items: unknown): Promise<CartView> {
  return loadCart(await loadMarket(), sanitizeCart(items));
}
