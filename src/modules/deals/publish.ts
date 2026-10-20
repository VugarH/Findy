import { randomUUID } from "node:crypto";
import { eq, inArray, max } from "drizzle-orm";
import { db } from "@/db/client";
import { deals, freshDeals, offers } from "@/db/schema";
import { classifyProducts } from "@/modules/catalog/classify";
import { loadMarket } from "@/modules/pricing/fx";
import { buildDeals } from "./build";

/**
 * Keeping the published deals in step with changes made outside the daily
 * job (the admin panel, the status script).
 *
 * Simple changes are applied to the published rows at once — a product moved
 * to another subcategory, or switched off. Anything that can change which
 * offer wins (a store switched back on, a price entered by hand, a merge)
 * needs the full rebuild: `publishDeals`.
 */

/** Re-sorts products with the current rules and rebuilds the deal list from the offers already saved. */
export async function publishDeals(now = new Date()): Promise<number> {
  const market = await loadMarket();
  await classifyProducts();
  return buildDeals(market, randomUUID(), now);
}

/** When the deal list was last built, or null when it is empty. */
export async function lastPublishedAt(): Promise<Date | null> {
  const [row] = await db.select({ at: max(deals.createdAt) }).from(deals);
  return row?.at ?? null;
}

/** Takes products off the deal pages right away (switched off, merged away). */
export async function withdrawProductDeals(productIds: string[]): Promise<void> {
  if (productIds.length === 0) return;
  await db.delete(deals).where(inArray(deals.productId, productIds));
  await db.delete(freshDeals).where(inArray(freshDeals.productId, productIds));
}

/** Takes a store's offers off the deal pages right away. Its products may return with another store's offer after publishDeals. */
export async function withdrawSupplierDeals(supplierId: string): Promise<void> {
  const storeOffers = db.select({ id: offers.id }).from(offers).where(eq(offers.supplierId, supplierId));
  await db.delete(deals).where(inArray(deals.offerId, storeOffers));
  await db.delete(freshDeals).where(inArray(freshDeals.offerId, storeOffers));
}

/** Copies a product's new placement to its published deal, so filters and category pages agree at once. */
export async function patchProductDeals(
  productIds: string[],
  placement: { categorySlug?: string; subcategorySlug?: string; audience?: string | null },
): Promise<void> {
  if (productIds.length === 0 || Object.keys(placement).length === 0) return;
  await db.update(deals).set(placement).where(inArray(deals.productId, productIds));
  if (placement.categorySlug) {
    await db.update(freshDeals).set({ categorySlug: placement.categorySlug }).where(inArray(freshDeals.productId, productIds));
  }
}
