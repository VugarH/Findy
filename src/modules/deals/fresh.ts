import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { freshDeals, offers } from "@/db/schema";
import type { CategorySlug } from "@/config/categories";
import type { MarketConfig } from "@/config/markets";
import { toCard, type ProductCardData } from "@/modules/catalog/card";
import { freshSince, loadProductsWithOffers, offerIsLive } from "@/modules/catalog/offer-view";
import { summarizeProduct } from "@/modules/catalog/summary";

/** Live fresh drops of a market (their offer still confirmed by the store). */
function liveFresh(market: MarketConfig, category?: CategorySlug) {
  return and(
    eq(freshDeals.marketCode, market.code),
    offerIsLive(freshSince(market)),
    category ? eq(freshDeals.categorySlug, category) : undefined,
  );
}

/**
 * Verified discounts ("fresh" drops, modules/deals/fresh-drop.ts): biggest drop
 * first, newer drops first on a tie. Cards are built from current offers, like
 * the product page, since many of these are not in the deals table.
 */
export async function listFreshDeals(
  market: MarketConfig,
  options: { category?: CategorySlug; limit: number; offset?: number },
): Promise<ProductCardData[]> {
  const rows = await db
    .select({
      productId: freshDeals.productId,
      dropPct: freshDeals.dropPct,
      fromLandedMinor: freshDeals.fromLandedMinor,
      fromOn: freshDeals.fromOn,
      storeDiscountPct: freshDeals.storeDiscountPct,
    })
    .from(freshDeals)
    .innerJoin(offers, eq(freshDeals.offerId, offers.id))
    .where(liveFresh(market, options.category))
    .orderBy(desc(freshDeals.dropPct), desc(freshDeals.fromOn), freshDeals.productId)
    .limit(options.limit)
    .offset(options.offset ?? 0);
  if (rows.length === 0) return [];

  const entries = await loadProductsWithOffers(market, new Date(), rows.map((row) => row.productId));
  const byId = new Map(entries.map((entry) => [entry.product.id, entry]));
  const windowDays = market.deals.freshDrop.windowDays;
  return rows.flatMap(({ productId, ...fresh }) => {
    const entry = byId.get(productId);
    const summary = entry && summarizeProduct(entry, market);
    return entry && summary ? [{ ...toCard(entry.product, summary), fresh: { ...fresh, windowDays } }] : [];
  });
}

/** How many verified discounts there are, overall and per category. */
export async function countFreshDeals(market: MarketConfig): Promise<{ total: number; byCategory: Record<string, number> }> {
  const rows = await db
    .select({ category: freshDeals.categorySlug, total: count() })
    .from(freshDeals)
    .innerJoin(offers, eq(freshDeals.offerId, offers.id))
    .where(liveFresh(market))
    .groupBy(freshDeals.categorySlug);
  return {
    total: rows.reduce((sum, row) => sum + row.total, 0),
    byCategory: Object.fromEntries(rows.map((row) => [row.category, row.total])),
  };
}
