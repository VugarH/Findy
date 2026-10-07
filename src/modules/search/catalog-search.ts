import { and, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { products, searchQueries } from "@/db/schema";
import type { MarketConfig } from "@/config/markets";
import { toCard, type ProductCardData } from "@/modules/catalog/card";
import { hasFreshOffer, loadProductsWithOffers } from "@/modules/catalog/offer-view";
import { summarizeProduct } from "@/modules/catalog/summary";
import { isSizedCategory, type CategorySlug } from "@/config/categories";
import { sizeFacets, type BrandFacet, type DealFacets, type DealFilters } from "@/modules/deals/queries";
import { brandKey } from "@/modules/catalog/brand";
import type { SupplierScope } from "@/modules/suppliers/types";
import { expandQuery } from "./synonyms";

const MAX_RESULTS = 200;

export const SEARCH_SORTS = ["relevance", "price_asc", "price_desc", "discount", "newest", "oldest"] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

export function parseSearchSort(value: string | undefined): SearchSort {
  return (SEARCH_SORTS as readonly string[]).includes(value ?? "") ? (value as SearchSort) : "relevance";
}

/** Orders result cards. "relevance" keeps the order they came in. */
export function sortCards(cards: ProductCardData[], sort: SearchSort): ProductCardData[] {
  const sorted = [...cards];
  if (sort === "price_asc") sorted.sort((a, b) => a.landedMinor - b.landedMinor);
  if (sort === "price_desc") sorted.sort((a, b) => b.landedMinor - a.landedMinor);
  // ISO timestamps sort correctly as text; a stable sort keeps the deal-first order for ties.
  if (sort === "newest") sorted.sort((a, b) => (a.addedAt < b.addedAt ? 1 : a.addedAt > b.addedAt ? -1 : 0));
  if (sort === "oldest") sorted.sort((a, b) => (a.addedAt < b.addedAt ? -1 : a.addedAt > b.addedAt ? 1 : 0));
  if (sort === "discount") sorted.sort((a, b) => (b.discountPct ?? 0) - (a.discountPct ?? 0) || a.landedMinor - b.landedMinor);
  return sorted;
}

/** Turns stored products into cards, best deals first, then cheapest. */
export async function cardsForProducts(
  productIds: string[],
  market: MarketConfig,
  scope?: SupplierScope,
): Promise<ProductCardData[]> {
  const entries = await loadProductsWithOffers(market, new Date(), productIds);
  return entries
    .flatMap((entry) => {
      // With a market selected, a product is judged only on its offers from that market,
      // so the price and store on the card are the best ones *there*.
      const offers = scope ? entry.offers.filter((offer) => offer.supplier.scope === scope) : entry.offers;
      const summary = summarizeProduct({ product: entry.product, offers }, market);
      return summary ? [toCard(entry.product, summary)] : [];
    })
    .sort((a, b) => (b.discountPct ?? 0) - (a.discountPct ?? 0) || a.landedMinor - b.landedMinor);
}

/**
 * Title and brand folded like foldForMatching (Turkish letters as ASCII), so
 * "canta" finds "Çanta". Padded with spaces so a synonym can ask for a whole
 * word (" ring" must not match "earring").
 */
const FOLDED_TEXT = sql`' ' || translate(lower(translate(${products.title} || ' ' || coalesce(${products.brand}, ''), 'İ', 'i')), 'çşğöüıə', 'csgouie') || ' '`;

const like = (text: string) => `%${text.replace(/[\\%_]/g, "\\$&")}%`;

/** Step one of every search: what we already know. Instant and free. */
export async function searchCatalog(
  query: string,
  market: MarketConfig,
  scope?: SupplierScope,
): Promise<ProductCardData[]> {
  const terms = expandQuery(query);
  if (terms.length === 0) return [];

  const matches = await db
    .select({ id: products.id })
    .from(products)
    .where(
      and(
        // Only products a store still sells: expired ones would use up the result limit.
        hasFreshOffer(market),
        ...terms.map((term) =>
          or(
            ...term.alternatives.map((alternative) => ilike(FOLDED_TEXT, like(alternative))),
            // Unisex fits "women" and "men", not "kids".
            term.audience
              ? inArray(products.audience, term.audience === "kids" ? ["kids"] : [term.audience, "unisex"])
              : undefined,
          ),
        ),
      ),
    )
    .limit(MAX_RESULTS);

  return cardsForProducts(matches.map((m) => m.id), market, scope);
}

/** The sidebar filters, applied to a result list that is already in memory. */
export function filterCards(cards: ProductCardData[], filters: DealFilters): ProductCardData[] {
  return cards.filter(
    (card) =>
      (!filters.category || card.categorySlug === filters.category) &&
      (!filters.subcategory || card.subcategorySlug === filters.subcategory) &&
      (!filters.audience || card.audience === filters.audience) &&
      (!filters.brands?.length || (card.brand !== null && filters.brands.includes(brandKey(card.brand)))) &&
      (!filters.country || card.originCountry === filters.country) &&
      (!filters.minDiscount || (card.discountPct ?? 0) >= filters.minDiscount) &&
      (!filters.priceMin || card.landedMinor >= filters.priceMin * 100) &&
      (!filters.priceMax || card.landedMinor <= filters.priceMax * 100) &&
      (!filters.sizes?.length || (card.sizes ?? []).some((size) => filters.sizes!.includes(size))),
  );
}

/** Counts for the filter sidebar, from the results themselves. */
export function facetsOfCards(cards: ProductCardData[], category?: CategorySlug): DealFacets {
  const tally = (values: string[]) => {
    const counts: Record<string, number> = {};
    for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  };
  const inCategory = category ? cards.filter((card) => card.categorySlug === category) : cards;
  return {
    categories: tally(cards.map((card) => card.categorySlug)),
    countries: Object.entries(tally(inCategory.map((card) => card.originCountry)))
      .map(([country, total]) => ({ country, total }))
      .sort((a, b) => b.total - a.total),
    subcategories: category ? tally(inCategory.map((card) => card.subcategorySlug)) : {},
    audiences: tally(inCategory.flatMap((card) => (card.audience ? [card.audience] : []))),
    brands: category ? brandFacets(inCategory) : [],
    sizes: isSizedCategory(category)
      ? sizeFacets(Object.entries(tally(inCategory.flatMap((card) => card.sizes ?? []))).map(([key, total]) => ({ key, total })))
      : [],
  };
}

/** Brands among the results, most first, each under the spelling most stores use. */
function brandFacets(cards: ProductCardData[]): BrandFacet[] {
  const byKey = new Map<string, { total: number; spellings: Map<string, number> }>();
  for (const card of cards) {
    if (!card.brand?.trim()) continue;
    const entry = byKey.get(brandKey(card.brand)) ?? { total: 0, spellings: new Map() };
    entry.total++;
    entry.spellings.set(card.brand, (entry.spellings.get(card.brand) ?? 0) + 1);
    byKey.set(brandKey(card.brand), entry);
  }
  return [...byKey.entries()]
    .map(([key, { total, spellings }]) => ({
      key,
      name: [...spellings.entries()].sort((a, b) => b[1] - a[1])[0][0],
      total,
    }))
    .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
}

/** Records demand. Live searches are what the daily job later keeps fresh. */
export async function recordSearch(
  query: string,
  market: MarketConfig,
  resultCount: number,
  live: boolean,
): Promise<void> {
  const liveIncrement = live ? 1 : 0;
  await db
    .insert(searchQueries)
    .values({
      marketCode: market.code,
      query: query.toLowerCase(),
      count: 1,
      liveCount: liveIncrement,
      lastResultCount: resultCount,
    })
    .onConflictDoUpdate({
      target: [searchQueries.marketCode, searchQueries.query],
      set: {
        count: sql`${searchQueries.count} + 1`,
        liveCount: sql`${searchQueries.liveCount} + ${liveIncrement}`,
        lastResultCount: resultCount,
        lastSearchedAt: sql`now()`,
      },
    });
}
