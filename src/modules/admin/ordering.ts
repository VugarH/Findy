import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { deals, offers, products } from "@/db/schema";
import { getMarket } from "@/config/markets";
import { freshSince, offerIsLive } from "@/modules/catalog/offer-view";

/**
 * How many live deals each category, type and brand has, so admins can see
 * what is popular while ordering them (Settings → Order).
 */
export interface OrderingCounts {
  categories: Record<string, number>;
  /** "category/subcategory" → deals. */
  subcategories: Record<string, number>;
  /** Brands with deals, most first. */
  brands: { key: string; name: string; deals: number }[];
}

/** How many brands the editor offers to pick from. */
const BRAND_CHOICES = 400;

export async function getOrderingCounts(): Promise<OrderingCounts> {
  const market = getMarket();
  const live = and(eq(deals.marketCode, market.code), offerIsLive(freshSince(market)));
  const brandKey = sql<string>`lower(trim(${products.brand}))`;

  const [bySub, brands] = await Promise.all([
    db
      .select({ category: deals.categorySlug, sub: deals.subcategorySlug, total: count() })
      .from(deals)
      .innerJoin(offers, eq(deals.offerId, offers.id))
      .where(live)
      .groupBy(deals.categorySlug, deals.subcategorySlug),
    db
      .select({
        key: brandKey,
        name: sql<string>`mode() within group (order by ${products.brand})`,
        deals: count(),
      })
      .from(deals)
      .innerJoin(offers, eq(deals.offerId, offers.id))
      .innerJoin(products, eq(deals.productId, products.id))
      .where(and(live, sql`${products.brand} is not null and trim(${products.brand}) <> ''`))
      .groupBy(brandKey)
      .orderBy(desc(count()), brandKey)
      .limit(BRAND_CHOICES),
  ]);

  const categories: Record<string, number> = {};
  const subcategories: Record<string, number> = {};
  for (const row of bySub) {
    categories[row.category] = (categories[row.category] ?? 0) + row.total;
    subcategories[`${row.category}/${row.sub}`] = row.total;
  }
  return { categories, subcategories, brands };
}
