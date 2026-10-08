import { CATEGORIES, CATEGORY_SLUGS, isCategorySlug, type CategorySlug } from "@/config/categories";
import { isSubcategoryOf, subcategoriesOf, type SubcategorySlug } from "@/config/subcategories";
import { brandKey } from "@/modules/catalog/brand";

/**
 * The order the site lists categories, the types inside each category and
 * brands in, set by admins (Settings → Order) so the most wanted come first.
 * Anything not in a saved list keeps its place after the listed ones, so a
 * category or type added in code later still shows. Client-safe: no database
 * here (see ./service.ts).
 */
export interface DisplayOrder {
  categories: CategorySlug[];
  /** Per category; a category without an entry keeps the code order. */
  subcategories: Partial<Record<CategorySlug, SubcategorySlug[]>>;
  /** Brand keys (lower case) listed first in the brand filter, in this order; other brands follow by deal count. */
  brands: string[];
}

/** At most this many brands can be put on top. */
export const MAX_TOP_BRANDS = 60;

export const DEFAULT_DISPLAY_ORDER: DisplayOrder = { categories: [], subcategories: {}, brands: [] };

/** A stored value as an order: unknown, repeated or misspelled entries dropped. */
export function toDisplayOrder(value: unknown): DisplayOrder {
  const stored = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const strings = (list: unknown): string[] =>
    Array.isArray(list) ? [...new Set(list.filter((item): item is string => typeof item === "string"))] : [];

  const subcategories: DisplayOrder["subcategories"] = {};
  const storedSubs = stored.subcategories && typeof stored.subcategories === "object" ? stored.subcategories : {};
  for (const [category, list] of Object.entries(storedSubs)) {
    if (!isCategorySlug(category)) continue;
    const valid = strings(list).filter((slug): slug is SubcategorySlug => isSubcategoryOf(category, slug));
    if (valid.length > 0) subcategories[category] = valid;
  }

  return {
    categories: strings(stored.categories).filter(isCategorySlug),
    subcategories,
    brands: [...new Set(strings(stored.brands).map(brandKey))]
      .filter((key) => key.length > 0 && key.length <= 60)
      .slice(0, MAX_TOP_BRANDS),
  };
}

/** `items` with those named in `order` first, in that order; the rest after, as they were. */
export function sortByOrder<T>(items: readonly T[], order: readonly string[], keyOf: (item: T) => string): T[] {
  const rank = new Map(order.map((key, index) => [key, index]));
  return items
    .map((item, index) => ({ item, index, rank: rank.get(keyOf(item)) ?? order.length + index }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ item }) => item);
}

export function orderedCategorySlugs(order: DisplayOrder): CategorySlug[] {
  return sortByOrder(CATEGORY_SLUGS, order.categories, (slug) => slug);
}

export function orderedCategories(order: DisplayOrder): (typeof CATEGORIES)[number][] {
  return sortByOrder(CATEGORIES, order.categories, (category) => category.slug);
}

export function orderedSubcategories(order: DisplayOrder, category: CategorySlug): SubcategorySlug[] {
  return sortByOrder(subcategoriesOf(category), order.subcategories[category] ?? [], (slug) => slug);
}

/** Brands with the admins' top brands first; the rest keep their order (most deals first). */
export function orderedBrands<B extends { key: string }>(order: DisplayOrder, brands: readonly B[]): B[] {
  return sortByOrder(brands, order.brands, (brand) => brand.key);
}
