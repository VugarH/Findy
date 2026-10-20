import { HELD_BACK_UNFILTERED } from "@/config/categories";
import type { DealFilters } from "./queries";

/**
 * The hold-back rule for a deal list, when it applies: a category is chosen,
 * nothing else is, and the order is the default one (config/categories.ts
 * HELD_BACK_UNFILTERED). Pure.
 */
export function holdBackFor(filters: DealFilters): { subcategory: string; after: number } | null {
  if (!filters.category || (filters.sort && filters.sort !== "best")) return null;
  const narrowed =
    filters.subcategory ||
    filters.audience ||
    filters.brands?.length ||
    filters.stores?.length ||
    filters.sizes?.length ||
    filters.country ||
    filters.scope ||
    filters.minDiscount ||
    filters.priceMin ||
    filters.priceMax ||
    filters.badge ||
    filters.verifiedOnly ||
    filters.freshOnly ||
    filters.productIds;
  return narrowed ? null : (HELD_BACK_UNFILTERED[filters.category] ?? null);
}

/**
 * The list in its order, except that items of the held-back type wait until
 * `after` other items have been shown, and from there are spread evenly
 * through the rest (not bunched up at position `after`). Each group keeps its
 * own order.
 */
export function holdBack<T extends { subcategory: string | null }>(rows: T[], rule: { subcategory: string; after: number }): T[] {
  const first: T[] = [];
  const others: T[] = [];
  const held: T[] = [];
  for (const row of rows) {
    if (row.subcategory === rule.subcategory) held.push(row);
    else if (first.length < rule.after) first.push(row);
    else others.push(row);
  }
  // Merge by relative position: the k-th of n items sits at (k + 0.5) / n of the remaining list.
  const rest: T[] = [];
  let o = 0;
  let h = 0;
  while (o < others.length || h < held.length) {
    const otherAt = o < others.length ? (o + 0.5) / others.length : Infinity;
    const heldAt = h < held.length ? (h + 0.5) / held.length : Infinity;
    rest.push(otherAt <= heldAt ? others[o++] : held[h++]);
  }
  return [...first, ...rest];
}
