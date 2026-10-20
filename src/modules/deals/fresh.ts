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
 * "Fresh real deals": biggest drop first, newer drops first on a tie, at most
 * `market.deals.freshDrop.limit`. Cards are built from current offers, like
 * the product page, since many of these are not in the deals table.
 */
export async function listFreshDeals(
  market: MarketConfig,
  options: { category?: CategorySlug; limit?: number } = {},
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
    .limit(Math.min(options.limit ?? market.deals.freshDrop.limit, market.deals.freshDrop.limit));
  if (rows.length === 0) return [];

  const entries = await loadProductsWithOffers(market, new Date(), rows.map((row) => row.productId));
  const byId = new Map(entries.map((entry) => [entry.product.id, entry]));
  return rows.flatMap(({ productId, ...fresh }) => {
    const entry = byId.get(productId);
    const summary = entry && summarizeProduct(entry, market);
    return entry && summary ? [{ ...toCard(entry.product, summary), fresh: { ...fresh, windowDays: market.deals.freshDrop.windowDays } }] : [];
  });
}

/** How many fresh drops there are, overall and per category (capped at the page limit). */
export async function countFreshDeals(market: MarketConfig): Promise<{ total: number; byCategory: Record<string, number> }> {
  const rows = await db
    .select({ category: freshDeals.categorySlug, total: count() })
    .from(freshDeals)
    .innerJoin(offers, eq(freshDeals.offerId, offers.id))
    .where(liveFresh(market))
    .groupBy(freshDeals.categorySlug);
  const byCategory = Object.fromEntries(rows.map((row) => [row.category, row.total]));
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  return { total: Math.min(total, market.deals.freshDrop.limit), byCategory };
}
