import { and, asc, count, desc, eq, inArray, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { freshDeals, offers, products } from "@/db/schema";
import type { CategorySlug } from "@/config/categories";
import type { MarketConfig } from "@/config/markets";
import { toCard, type ProductCardData } from "@/modules/catalog/card";
import { freshSince, loadProductsWithOffers, offerIsLive } from "@/modules/catalog/offer-view";
import { summarizeProduct } from "@/modules/catalog/summary";
import { productMatchesQuery } from "@/modules/search/catalog-search";

export const FRESH_SORTS = ["drop", "store_discount", "price_asc", "price_desc", "newest"] as const;
export type FreshSort = (typeof FRESH_SORTS)[number];

/** Each order breaks ties by the bigger drop, then the product id, so pages never overlap. */
const FRESH_ORDER: Record<FreshSort, SQL[]> = {
  drop: [desc(freshDeals.dropPct), desc(freshDeals.fromOn)],
  store_discount: [desc(freshDeals.storeDiscountPct), desc(freshDeals.dropPct)],
  price_asc: [asc(freshDeals.landedMinor), desc(freshDeals.dropPct)],
  price_desc: [desc(freshDeals.landedMinor), desc(freshDeals.dropPct)],
  // The price compared with was seen most recently: the drop is the newest.
  newest: [desc(freshDeals.fromOn), desc(freshDeals.dropPct)],
};

/** Live fresh drops of a market (their offer still confirmed by the store), optionally in some categories and matching a search. */
function liveFresh(market: MarketConfig, categories?: CategorySlug[], query?: string) {
  return and(
    eq(freshDeals.marketCode, market.code),
    offerIsLive(freshSince(market)),
    categories?.length ? inArray(freshDeals.categorySlug, categories) : undefined,
    (query && productMatchesQuery(query)) || undefined,
  );
}

/**
 * Verified discounts ("fresh" drops, modules/deals/fresh-drop.ts), biggest drop
 * first unless another order is chosen. Cards are built from current offers, like
 * the product page, since many of these are not in the deals table.
 */
export async function listFreshDeals(
  market: MarketConfig,
  options: { categories?: CategorySlug[]; query?: string; sort?: FreshSort; limit: number; offset?: number },
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
    .innerJoin(products, eq(freshDeals.productId, products.id))
    .where(liveFresh(market, options.categories, options.query))
    .orderBy(...FRESH_ORDER[options.sort ?? "drop"], freshDeals.productId)
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

/** How many verified discounts there are, overall and per category (matching a search, if given). */
export async function countFreshDeals(
  market: MarketConfig,
  query?: string,
): Promise<{ total: number; byCategory: Record<string, number> }> {
  const rows = await db
    .select({ category: freshDeals.categorySlug, total: count() })
    .from(freshDeals)
    .innerJoin(offers, eq(freshDeals.offerId, offers.id))
    .innerJoin(products, eq(freshDeals.productId, products.id))
    .where(liveFresh(market, undefined, query))
    .groupBy(freshDeals.categorySlug);
  return {
    total: rows.reduce((sum, row) => sum + row.total, 0),
    byCategory: Object.fromEntries(rows.map((row) => [row.category, row.total])),
  };
}
