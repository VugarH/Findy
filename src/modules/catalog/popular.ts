import { and, eq, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db/client";
import { products, siteSettings } from "@/db/schema";
import type { CategorySlug } from "@/config/categories";
import type { MarketConfig } from "@/config/markets";
import { POPULAR_FAMILIES, type PopularFamily } from "@/config/popular";
import { loadProductsWithOffers } from "./offer-view";
import { summarizeProduct } from "./summary";

export interface PopularFamilyCoverage {
  family: PopularFamily;
  /** Distinct products (model + memory variants) we track in this family. */
  variants: number;
  /** Stores with at least one of them in stock. */
  stores: string[];
  /** How many variants are sold by two or more stores, i.e. can actually be compared. */
  comparable: number;
  /** Cheapest landed price in the family, and the product it belongs to. */
  fromMinor: number;
  cheapest: { slug: string; title: string; imageUrl: string | null; categorySlug: CategorySlug };
}

/** Where the daily job keeps the result (site_settings), per market. */
const snapshotKey = (market: MarketConfig) => `popular-coverage:${market.code}`;

/**
 * The home page's "Popular in Azerbaijan" tiles, as the daily job last
 * computed them: one small row, instead of reloading hundreds of products
 * with their price history on every view. Empty until the first run.
 */
export const getPopularCoverage = cache(async (market: MarketConfig): Promise<PopularFamilyCoverage[]> => {
  const [row] = await db
    .select({ value: siteSettings.value })
    .from(siteSettings)
    .where(eq(siteSettings.key, snapshotKey(market)));
  return Array.isArray(row?.value) ? (row.value as PopularFamilyCoverage[]) : [];
});

/** Recomputes the tiles and saves them for the home page. Run by the daily job after the deals. */
export async function savePopularCoverage(market: MarketConfig): Promise<number> {
  const value = await computePopularCoverage(market);
  const key = snapshotKey(market);
  await db
    .insert(siteSettings)
    .values({ key, value, updatedBy: "daily job" })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: new Date(), updatedBy: "daily job" } });
  return value.length;
}

/**
 * For each popular family: how many variants we have, in which stores, and
 * from what price. Families we have nothing for are left out.
 */
async function computePopularCoverage(market: MarketConfig): Promise<PopularFamilyCoverage[]> {
  const result: PopularFamilyCoverage[] = [];
  for (const family of POPULAR_FAMILIES) {
    const matches = await db
      .select({ id: products.id })
      .from(products)
      .where(
        and(
          family.subcategory ? eq(products.subcategorySlug, family.subcategory) : undefined,
          family.category ? eq(products.categorySlug, family.category) : undefined,
          sql`lower(${products.brand}) = lower(${family.brand})`,
          sql`${products.title} ~* ${family.pattern}`,
        ),
      )
      .limit(400);
    if (matches.length === 0) continue;

    const entries = await loadProductsWithOffers(market, new Date(), matches.map((m) => m.id));
    const stores = new Set<string>();
    let variants = 0;
    let comparable = 0;
    let cheapest: { minor: number; entry: (typeof entries)[number] } | null = null;

    for (const entry of entries) {
      const summary = summarizeProduct(entry, market);
      if (!summary) continue;
      variants++;
      const sellers = new Set(entry.offers.filter((offer) => offer.inStock).map((offer) => offer.supplier.name));
      sellers.forEach((name) => stores.add(name));
      if (sellers.size > 1) comparable++;
      const price = summary.best.landed.totalMinor;
      if (!cheapest || price < cheapest.minor) cheapest = { minor: price, entry };
    }
    if (!cheapest) continue;

    const { product } = cheapest.entry;
    result.push({
      family,
      variants,
      stores: [...stores].sort(),
      comparable,
      fromMinor: cheapest.minor,
      cheapest: {
        slug: product.slug,
        title: product.title,
        imageUrl: product.imageUrl,
        categorySlug: product.categorySlug as CategorySlug,
      },
    });
  }

  return result;
}
