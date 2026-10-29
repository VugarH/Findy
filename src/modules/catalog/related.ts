import type { CategorySlug } from "@/config/categories";
import type { Audience } from "@/config/audience";
import type { SubcategorySlug } from "@/config/subcategories";
import type { MarketConfig } from "@/config/markets";
import { listDeals } from "@/modules/deals/queries";
import type { ProductCardData } from "./card";
import { PRICE_BAND, rankRelated } from "./related-rank";

/**
 * "Similar items" under a product: other deals someone looking at it may
 * want instead — same type, same audience, a similar price, a similar name.
 * Not the same item at other stores: that is ./similar.ts ("Find elsewhere").
 */

export interface RelatedSource {
  productId: string;
  title: string;
  brand: string | null;
  categorySlug: CategorySlug;
  subcategorySlug: SubcategorySlug;
  audience: Audience | null;
  /** The product's best landed price, in the market currency. */
  landedMinor: number;
}

/** Deals read to choose from: one small query on the deals table. */
const CANDIDATES = 40;
/** Fewer than this is not worth a section. */
export const MIN_RELATED = 4;

export async function relatedDeals(market: MarketConfig, source: RelatedSource, limit = 8): Promise<ProductCardData[]> {
  const base = {
    sort: "best" as const,
    limit: CANDIDATES,
    category: source.categorySlug,
    audience: source.audience ?? undefined,
    priceMin: Math.floor((source.landedMinor * PRICE_BAND.low) / 100),
    priceMax: Math.ceil((source.landedMinor * PRICE_BAND.high) / 100),
  };
  // The same type first; a rare type falls back to its whole category.
  const sameType =
    source.subcategorySlug !== "other" ? await listDeals(market, { ...base, subcategory: source.subcategorySlug }) : null;
  let ranked = sameType ? rankRelated(source, sameType.items, limit) : [];
  if (ranked.length < MIN_RELATED) ranked = rankRelated(source, (await listDeals(market, base)).items, limit);
  return ranked.length >= MIN_RELATED ? ranked : [];
}
