import { usableImage } from "@/config/images";
import { and, arrayOverlaps, asc, count, desc, eq, gte, inArray, lte, max, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { deals, freshDeals, offers, pipelineRuns, products, suppliers } from "@/db/schema";
import type { Audience } from "@/config/audience";
import { isSizedCategory, type CategorySlug } from "@/config/categories";
import type { MarketConfig } from "@/config/markets";
import type { SubcategorySlug } from "@/config/subcategories";
import type { CardFresh, ProductCardData } from "@/modules/catalog/card";
import { freshSince, offerIsLive } from "@/modules/catalog/offer-view";
import { sortSizes } from "@/modules/suppliers/sizes";
import { holdBack, holdBackFor } from "./hold-back";
import type { SupplierScope } from "@/modules/suppliers/types";

export const DEAL_SORTS = ["best", "discount", "savings", "price_asc", "price_desc", "newest", "oldest"] as const;
export type DealSort = (typeof DEAL_SORTS)[number];

export interface DealFilters {
  category?: CategorySlug;
  subcategory?: SubcategorySlug;
  audience?: Audience;
  /** Brand keys (see catalog/brand.ts); a product matches any of them. */
  brands?: string[];
  /** Store (supplier) ids; a deal matches when its best offer is from any of them. */
  stores?: string[];
  /** ISO country the offer ships from. */
  country?: string;
  scope?: SupplierScope;
  minDiscount?: number;
  /** Landed price bounds, in whole units of the market currency. */
  priceMin?: number;
  priceMax?: number;
  badge?: string;
  verifiedOnly?: boolean;
  /** Only "Verified discounts": products with a recent drop by our own checks (fresh_deals). */
  freshOnly?: boolean;
  /** Only these products (e.g. the day's top deals). */
  productIds?: string[];
  /** Size keys (sizeKey): deals whose store has any of them in stock. */
  sizes?: string[];
  sort?: DealSort;
  limit?: number;
  offset?: number;
}

/**
 * "Best deals": the score, with each further deal from the same store counting
 * a little less (market.deals.storeRepeatFactor), so the lists mix stores. A
 * window function, so it follows whatever filters the query has.
 */
function bestOrder(market: MarketConfig): SQL[] {
  const repeat = sql`row_number() over (partition by ${offers.supplierId} order by ${deals.score} desc, ${products.slug}) - 1`;
  return [desc(sql`${deals.score} * power(${market.deals.storeRepeatFactor}::float8, ${repeat})`), desc(deals.score)];
}

const ORDER_BY: Record<Exclude<DealSort, "best">, SQL[]> = {
  // The store's discount: the number every card shows.
  discount: [desc(sql`coalesce(${deals.storeDiscountPct}, 0)`), desc(deals.score)],
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
  return and(eq(deals.marketCode, market.code), offerIsLive(freshSince(market)));
}

/** SQL condition: the deal's product is among the verified discounts (fresh_deals). */
function hasFreshDrop(): SQL {
  return sql`exists (select 1 from ${freshDeals} where ${and(eq(freshDeals.productId, deals.productId), eq(freshDeals.marketCode, deals.marketCode))})`;
}

function whereFor(market: MarketConfig, filters: DealFilters) {
  return and(
    liveDeals(market),
    filters.category ? eq(deals.categorySlug, filters.category) : undefined,
    filters.subcategory ? eq(deals.subcategorySlug, filters.subcategory) : undefined,
    filters.audience ? eq(deals.audience, filters.audience) : undefined,
    filters.brands?.length ? inArray(BRAND_KEY, filters.brands) : undefined,
    filters.stores?.length ? inArray(offers.supplierId, filters.stores) : undefined,
    filters.country ? eq(deals.originCountry, filters.country) : undefined,
    filters.scope ? eq(deals.scope, filters.scope) : undefined,
    filters.minDiscount ? gte(deals.storeDiscountPct, filters.minDiscount) : undefined,
    filters.priceMin ? gte(deals.landedMinor, filters.priceMin * 100) : undefined,
    filters.priceMax ? lte(deals.landedMinor, filters.priceMax * 100) : undefined,
    filters.verifiedOnly ? eq(deals.verified, true) : undefined,
    filters.freshOnly ? hasFreshDrop() : undefined,
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
  const order = [...(!filters.sort || filters.sort === "best" ? bestOrder(market) : ORDER_BY[filters.sort]), asc(products.slug)];
  const limit = filters.limit ?? 20;
  const offset = filters.offset ?? 0;
  const select = () =>
    db
      .select({ deal: deals, product: products, supplierId: suppliers.id, supplierName: suppliers.name })
      .from(deals)
      .innerJoin(products, eq(deals.productId, products.id))
      .innerJoin(offers, eq(deals.offerId, offers.id))
      .innerJoin(suppliers, eq(offers.supplierId, suppliers.id));

  // A category opened with nothing else chosen may hold a type back (Clothing: underwear and socks
  // after the first 100). Then the whole list's order is read cheaply and the page taken from it.
  const rule = holdBackFor(filters);
  const pageRows = async () => {
    if (!rule) return select().where(where).orderBy(...order).limit(limit).offset(offset);
    const ordered = await db
      .select({ id: deals.id, subcategory: deals.subcategorySlug })
      .from(deals)
      .innerJoin(products, eq(deals.productId, products.id))
      .innerJoin(offers, eq(deals.offerId, offers.id))
      .where(where)
      .orderBy(...order);
    const ids = holdBack(ordered, rule).slice(offset, offset + limit).map((row) => row.id);
    if (ids.length === 0) return [];
    const rows = await select().where(inArray(deals.id, ids));
    const position = new Map(ids.map((id, index) => [id, index]));
    return rows.sort((a, b) => position.get(a.deal.id)! - position.get(b.deal.id)!);
  };

  const [rows, [{ total }]] = await Promise.all([
    pageRows(),
    db
      .select({ total: count() })
      .from(deals)
      .innerJoin(offers, eq(deals.offerId, offers.id))
      .innerJoin(products, eq(deals.productId, products.id))
      .where(where),
  ]);

  const fresh = await freshDropsOf(market, rows.map((row) => row.product.id));
  const items = rows.map(
    ({ deal, product, supplierId, supplierName }): ProductCardData => ({
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
      imageUrl: usableImage(product.imageUrl),
      landedMinor: deal.landedMinor,
      usualLandedMinor: deal.storeListLandedMinor,
      discountPct: deal.storeDiscountPct,
      savingsMinor: deal.storeListLandedMinor === null ? null : deal.storeListLandedMinor - deal.landedMinor,
      verified: deal.verified,
      supplierId,
      supplierName,
      scope: deal.scope,
      deliveryMaxDays: deal.deliveryMaxDays,
      badges: deal.badges,
      offerCount: deal.offerCount,
      bestLocalLandedMinor: deal.bestLocalLandedMinor,
      bestGlobalLandedMinor: deal.bestGlobalLandedMinor,
      sizes: deal.sizes,
      fresh: fresh.get(product.id) ?? null,
    }),
  );

  return { items, total };
}

/** The fresh price drops (fresh_deals) of these products, by product id. */
export async function freshDropsOf(market: MarketConfig, productIds: string[]): Promise<Map<string, CardFresh>> {
  if (productIds.length === 0) return new Map();
  const rows = await db
    .select({
      productId: freshDeals.productId,
      dropPct: freshDeals.dropPct,
      fromLandedMinor: freshDeals.fromLandedMinor,
      fromOn: freshDeals.fromOn,
      storeDiscountPct: freshDeals.storeDiscountPct,
    })
    .from(freshDeals)
    .where(and(eq(freshDeals.marketCode, market.code), inArray(freshDeals.productId, productIds)));
  const windowDays = market.deals.freshDrop.windowDays;
  return new Map(rows.map(({ productId, ...drop }) => [productId, { ...drop, windowDays }]));
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
  /** Stores whose offer is the best one, within the selected category, most deals first. */
  stores: StoreFacet[];
  /** Sizes in stock within a sized category (clothes, shoes…), in size order. */
  sizes: SizeFacet[];
  /** Deals in the selected category (and stores) that are verified discounts. */
  fresh: number;
}

export interface SizeFacet {
  key: string;
  total: number;
}

export interface StoreFacet {
  /** Supplier id. */
  key: string;
  name: string;
  total: number;
}

export interface BrandFacet {
  key: string;
  /** The spelling most stores use. */
  name: string;
  total: number;
}

/**
 * What the filter chips can offer: only values that actually have deals.
 * Ticked stores narrow every list except the store list itself, which shows
 * the category's stores so more can be ticked.
 */
export async function getDealFacets(market: MarketConfig, category?: CategorySlug, storeIds?: string[]): Promise<DealFacets> {
  const live = and(liveDeals(market), storeIds?.length ? inArray(offers.supplierId, storeIds) : undefined);
  const inCategory = and(live, category ? eq(deals.categorySlug, category) : undefined);
  const storesInCategory = and(liveDeals(market), category ? eq(deals.categorySlug, category) : undefined);
  const withOffer = eq(deals.offerId, offers.id);
  // Qualified by hand: offers has a sizes column too, and raw columns render unqualified.
  const dealSize = sql<string>`unnest(${sql.raw('"deals"."sizes"')})`;
  const [categories, countries, subcategories, audiences, brands, stores, sizes, [fresh]] = await Promise.all([
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
    db
      .select({ key: suppliers.id, name: suppliers.name, total: count() })
      .from(deals)
      .innerJoin(offers, withOffer)
      .innerJoin(suppliers, eq(offers.supplierId, suppliers.id))
      .where(storesInCategory)
      .groupBy(suppliers.id, suppliers.name)
      .orderBy(desc(count()), suppliers.name),
    isSizedCategory(category)
      ? db
          .select({ key: dealSize, total: count() })
          .from(deals)
          .innerJoin(offers, withOffer)
          .where(inCategory)
          .groupBy(sql`1`)
      : [],
    db.select({ total: count() }).from(deals).innerJoin(offers, withOffer).where(and(inCategory, hasFreshDrop())),
  ]);
  return {
    categories: Object.fromEntries(categories.map((row) => [row.slug, row.total])),
    countries: countries.filter((row) => row.country),
    subcategories: Object.fromEntries(subcategories.map((row) => [row.slug, row.total])),
    audiences: Object.fromEntries(audiences.flatMap((row) => (row.audience ? [[row.audience, row.total]] : []))),
    brands,
    stores,
    sizes: sizeFacets(sizes),
    fresh: fresh?.total ?? 0,
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
        maxDiscountPct: max(deals.storeDiscountPct),
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

/** Products that have a live deal, best first, for the sitemap. */
export async function listSitemapProducts(market: MarketConfig, limit: number): Promise<{ slug: string; updatedAt: Date }[]> {
  return db
    .select({ slug: products.slug, updatedAt: deals.createdAt })
    .from(deals)
    .innerJoin(offers, eq(deals.offerId, offers.id))
    .innerJoin(products, eq(deals.productId, products.id))
    .where(liveDeals(market))
    .orderBy(desc(deals.score))
    .limit(limit);
}
