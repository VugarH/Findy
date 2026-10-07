import { and, arrayOverlaps, asc, count, desc, eq, gte, inArray, lte, max, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { deals, offers, pipelineRuns, products, suppliers } from "@/db/schema";
import type { Audience } from "@/config/audience";
import { isSizedCategory, type CategorySlug } from "@/config/categories";
import type { MarketConfig } from "@/config/markets";
import type { SubcategorySlug } from "@/config/subcategories";
import type { ProductCardData } from "@/modules/catalog/card";
import { freshSince } from "@/modules/catalog/offer-view";
import { sortSizes } from "@/modules/suppliers/sizes";
import type { SupplierScope } from "@/modules/suppliers/types";

export const DEAL_SORTS = ["best", "discount", "savings", "price_asc", "price_desc", "newest", "oldest"] as const;
export type DealSort = (typeof DEAL_SORTS)[number];

export interface DealFilters {
  category?: CategorySlug;
  subcategory?: SubcategorySlug;
  audience?: Audience;
  /** Brand keys (see catalog/brand.ts); a product matches any of them. */
  brands?: string[];
  /** ISO country the offer ships from. */
  country?: string;
  scope?: SupplierScope;
  minDiscount?: number;
  /** Landed price bounds, in whole units of the market currency. */
  priceMin?: number;
  priceMax?: number;
  badge?: string;
  verifiedOnly?: boolean;
  /** Only these products (e.g. the day's top deals). */
  productIds?: string[];
  /** Size keys (sizeKey): deals whose store has any of them in stock. */
  sizes?: string[];
  sort?: DealSort;
  limit?: number;
  offset?: number;
}

const ORDER_BY: Record<DealSort, SQL[]> = {
  best: [desc(deals.score), desc(deals.savingsMinor)],
  discount: [desc(deals.realDiscountPct), desc(deals.score)],
  savings: [desc(deals.savingsMinor)],
  price_asc: [asc(deals.landedMinor)],
  price_desc: [desc(deals.landedMinor)],
  // Products found in the same collection run share a timestamp, so the best deal breaks ties.
  newest: [desc(products.createdAt), desc(deals.score)],
  oldest: [asc(products.createdAt), desc(deals.score)],
};

/**
 * Deals are rebuilt by the daily job, but the prices behind them expire after
 * `staleAfterHours`. If the job has not run, a listed deal would lead to a
 * product page with no price, so every query keeps only deals whose offer is
 * still fresh (and must join `offers` for that).
 */
/** SQL twin of brandKey(). */
const BRAND_KEY = sql<string>`lower(trim(${products.brand}))`;

function liveDeals(market: MarketConfig) {
  return and(eq(deals.marketCode, market.code), gte(offers.lastSeenAt, freshSince(market)));
}

function whereFor(market: MarketConfig, filters: DealFilters) {
  return and(
    liveDeals(market),
    filters.category ? eq(deals.categorySlug, filters.category) : undefined,
    filters.subcategory ? eq(deals.subcategorySlug, filters.subcategory) : undefined,
    filters.audience ? eq(deals.audience, filters.audience) : undefined,
    filters.brands?.length ? inArray(BRAND_KEY, filters.brands) : undefined,
    filters.country ? eq(deals.originCountry, filters.country) : undefined,
    filters.scope ? eq(deals.scope, filters.scope) : undefined,
    filters.minDiscount ? gte(deals.realDiscountPct, filters.minDiscount) : undefined,
    filters.priceMin ? gte(deals.landedMinor, filters.priceMin * 100) : undefined,
    filters.priceMax ? lte(deals.landedMinor, filters.priceMax * 100) : undefined,
    filters.verifiedOnly ? eq(deals.verified, true) : undefined,
    filters.productIds ? inArray(deals.productId, filters.productIds) : undefined,
    filters.sizes?.length ? arrayOverlaps(deals.sizes, filters.sizes) : undefined,
    filters.badge ? sql`${deals.badges} @> ${JSON.stringify([filters.badge])}::jsonb` : undefined,
  );
}

export async function listDeals(
  market: MarketConfig,
  filters: DealFilters = {},
): Promise<{ items: ProductCardData[]; total: number }> {
  const where = whereFor(market, filters);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({ deal: deals, product: products, supplierName: suppliers.name })
      .from(deals)
      .innerJoin(products, eq(deals.productId, products.id))
      .innerJoin(offers, eq(deals.offerId, offers.id))
      .innerJoin(suppliers, eq(offers.supplierId, suppliers.id))
      .where(where)
      .orderBy(...ORDER_BY[filters.sort ?? "best"], asc(products.slug))
      .limit(filters.limit ?? 20)
      .offset(filters.offset ?? 0),
    db
      .select({ total: count() })
      .from(deals)
      .innerJoin(offers, eq(deals.offerId, offers.id))
      .innerJoin(products, eq(deals.productId, products.id))
      .where(where),
  ]);

  const items = rows.map(
    ({ deal, product, supplierName }): ProductCardData => ({
      productId: product.id,
      offerId: deal.offerId,
      slug: product.slug,
      title: product.title,
      brand: product.brand,
      categorySlug: product.categorySlug as CategorySlug,
      subcategorySlug: deal.subcategorySlug,
      audience: deal.audience as Audience | null,
      addedAt: product.createdAt.toISOString(),
      originCountry: deal.originCountry,
      imageUrl: product.imageUrl,
      landedMinor: deal.landedMinor,
      usualLandedMinor: deal.usualLandedMinor,
      discountPct: Math.round(deal.realDiscountPct),
      savingsMinor: deal.savingsMinor,
      verified: deal.verified,
      supplierName,
      scope: deal.scope,
      deliveryMaxDays: deal.deliveryMaxDays,
      badges: deal.badges,
      offerCount: deal.offerCount,
      bestLocalLandedMinor: deal.bestLocalLandedMinor,
      bestGlobalLandedMinor: deal.bestGlobalLandedMinor,
      sizes: deal.sizes,
    }),
  );

  return { items, total };
}

export interface DealFacets {
  /** Deals per category across the whole market. */
  categories: Record<string, number>;
  /** Deals per origin country, most first. */
  countries: { country: string; total: number }[];
  /** Deals per subcategory within the selected category. */
  subcategories: Record<string, number>;
  /** Deals per audience (women, men…) within the selected category. */
  audiences: Record<string, number>;
  /** Brands within the selected category, most deals first. */
  brands: BrandFacet[];
  /** Sizes in stock within a sized category (clothes, shoes…), in size order. */
  sizes: SizeFacet[];
}

export interface SizeFacet {
  key: string;
  total: number;
}

export interface BrandFacet {
  key: string;
  /** The spelling most stores use. */
  name: string;
  total: number;
}

/** What the filter chips can offer: only values that actually have deals. */
export async function getDealFacets(market: MarketConfig, category?: CategorySlug): Promise<DealFacets> {
  const live = liveDeals(market);
  const inCategory = and(live, category ? eq(deals.categorySlug, category) : undefined);
  const withOffer = eq(deals.offerId, offers.id);
  // Qualified by hand: offers has a sizes column too, and raw columns render unqualified.
  const dealSize = sql<string>`unnest(${sql.raw('"deals"."sizes"')})`;
  const [categories, countries, subcategories, audiences, brands, sizes] = await Promise.all([
    db
      .select({ slug: deals.categorySlug, total: count() })
      .from(deals)
      .innerJoin(offers, withOffer)
      .where(live)
      .groupBy(deals.categorySlug),
    db
      .select({ country: deals.originCountry, total: count() })
      .from(deals)
      .innerJoin(offers, withOffer)
      .where(inCategory)
      .groupBy(deals.originCountry)
      .orderBy(desc(count())),
    category
      ? db
          .select({ slug: deals.subcategorySlug, total: count() })
          .from(deals)
          .innerJoin(offers, withOffer)
          .where(inCategory)
          .groupBy(deals.subcategorySlug)
      : [],
    db
      .select({ audience: deals.audience, total: count() })
      .from(deals)
      .innerJoin(offers, withOffer)
      .where(inCategory)
      .groupBy(deals.audience),
    // Brands only make sense inside a category: "all brands of everything" is too long to scan.
    category
      ? db
          .select({
            key: BRAND_KEY,
            name: sql<string>`mode() within group (order by ${products.brand})`,
            total: count(),
          })
          .from(deals)
          .innerJoin(offers, withOffer)
          .innerJoin(products, eq(deals.productId, products.id))
          .where(and(inCategory, sql`${products.brand} is not null and trim(${products.brand}) <> ''`))
          .groupBy(BRAND_KEY)
          .orderBy(desc(count()), BRAND_KEY)
      : [],
    isSizedCategory(category)
      ? db
          .select({ key: dealSize, total: count() })
          .from(deals)
          .innerJoin(offers, withOffer)
          .where(inCategory)
          .groupBy(sql`1`)
      : [],
  ]);
  return {
    categories: Object.fromEntries(categories.map((row) => [row.slug, row.total])),
    countries: countries.filter((row) => row.country),
    subcategories: Object.fromEntries(subcategories.map((row) => [row.slug, row.total])),
    audiences: Object.fromEntries(audiences.flatMap((row) => (row.audience ? [[row.audience, row.total]] : []))),
    brands,
    sizes: sizeFacets(sizes),
  };
}

/** Sizes in size order; rare ones (one or two deals) only when the list is short. */
export function sizeFacets(rows: SizeFacet[]): SizeFacet[] {
  const totals = new Map(rows.map((row) => [row.key, row.total]));
  const ordered = sortSizes(rows.map((row) => ({ label: row.key, inStock: true }))).map((size) => ({
    key: size.label,
    total: totals.get(size.label) ?? 0,
  }));
  return ordered.length > 40 ? ordered.filter((size) => size.total > 2) : ordered;
}

export interface DealStats {
  dealCount: number;
  verifiedDealCount: number;
  storeCount: number;
  productCount: number;
  maxDiscountPct: number;
  totalSavingsMinor: number;
  byCategory: Record<string, number>;
  lastRunAt: Date | null;
}

export async function getDealStats(market: MarketConfig): Promise<DealStats> {
  const [[totals], perCategory, [stores], [catalog], [lastRun]] = await Promise.all([
    db
      .select({
        dealCount: count(),
        verifiedDealCount: sql<number>`count(*) filter (where ${deals.verified})::int`,
        maxDiscountPct: max(deals.realDiscountPct),
        totalSavingsMinor: sql<number>`coalesce(sum(${deals.savingsMinor}), 0)::int`,
      })
      .from(deals)
      .innerJoin(offers, eq(deals.offerId, offers.id))
      .where(liveDeals(market)),
    db
      .select({ categorySlug: deals.categorySlug, total: count() })
      .from(deals)
      .innerJoin(offers, eq(deals.offerId, offers.id))
      .where(liveDeals(market))
      .groupBy(deals.categorySlug),
    db.select({ total: count() }).from(suppliers).where(eq(suppliers.active, true)),
    db.select({ total: count() }).from(products),
    db
      .select({ finishedAt: pipelineRuns.finishedAt })
      .from(pipelineRuns)
      .where(and(eq(pipelineRuns.marketCode, market.code), sql`${pipelineRuns.finishedAt} is not null`))
      .orderBy(desc(pipelineRuns.finishedAt))
      .limit(1),
  ]);

  return {
    dealCount: totals.dealCount,
    verifiedDealCount: totals.verifiedDealCount,
    storeCount: stores.total,
    productCount: catalog.total,
    maxDiscountPct: Math.round(totals.maxDiscountPct ?? 0),
    totalSavingsMinor: totals.totalSavingsMinor,
    byCategory: Object.fromEntries(perCategory.map((row) => [row.categorySlug, row.total])),
    lastRunAt: lastRun?.finishedAt ?? null,
  };
}
