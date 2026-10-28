import { isCategorySlug, type CategorySlug } from "@/config/categories";
import { isSubcategoryOf, type SubcategorySlug } from "@/config/subcategories";
import type { MarketConfig } from "@/config/markets";
import type { ProductCardData } from "@/modules/catalog/card";
import { listDeals } from "@/modules/deals/queries";
import { hasInterests, topKeys, type InterestProfile } from "./profile";
import { rankForVisitor } from "./rank";

/**
 * The recommender: deals picked for one visitor's interests. This function is
 * the feature's only server entry point (POST /api/recommendations calls it),
 * so it can move behind its own service later: same profile in, cards out.
 */

export interface RecommendationRequest {
  profile: InterestProfile;
  /** Only within this category (a category page), else across the site. */
  category?: CategorySlug;
  limit: number;
}

/** Deals read per interest: enough to rank from, small enough to stay cheap. */
const CANDIDATES_PER_INTEREST = 24;
const TOP_CATEGORIES = 2;
const TOP_SUBCATEGORIES = 2;
const TOP_BRANDS = 3;

export async function recommendDeals(market: MarketConfig, request: RecommendationRequest): Promise<ProductCardData[]> {
  const { profile, category, limit } = request;
  if (!hasInterests(profile)) return [];

  // A few small queries, one per strongest interest, each the best deals there.
  const base = { sort: "best" as const, limit: CANDIDATES_PER_INTEREST };
  // Keys come from the browser: only real categories and types are queried.
  const categories = category ? [category] : topKeys(profile.categories, TOP_CATEGORIES).filter(isCategorySlug);
  const subcategories = topKeys(profile.subcategories, TOP_SUBCATEGORIES).flatMap((key): [CategorySlug, SubcategorySlug][] => {
    const [cat, subcategory = ""] = key.split("/");
    return isCategorySlug(cat) && isSubcategoryOf(cat, subcategory) && (!category || cat === category) ? [[cat, subcategory]] : [];
  });
  const brands = topKeys(profile.brands, TOP_BRANDS);
  const lists = await Promise.all([
    ...subcategories.map(([cat, subcategory]) => listDeals(market, { ...base, category: cat, subcategory })),
    ...brands.map((brand) => listDeals(market, { ...base, category, brands: [brand] })),
    ...categories.map((cat) => listDeals(market, { ...base, category: cat })),
  ]);

  // Each product once, keeping its best place among the lists.
  const candidates = new Map<string, ProductCardData>();
  const rounds = Math.max(0, ...lists.map((list) => list.items.length));
  for (let i = 0; i < rounds; i++) {
    for (const list of lists) {
      const card = list.items[i];
      if (card && !candidates.has(card.productId)) candidates.set(card.productId, card);
    }
  }
  return rankForVisitor([...candidates.values()], profile, limit);
}
