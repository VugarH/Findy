import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { deals, offers, products } from "@/db/schema";
import { CATEGORY_SLUGS, type CategorySlug } from "@/config/categories";
import { getMarket } from "@/config/markets";
import { OTHER_SUBCATEGORY, subcategoriesOf, type SubcategorySlug } from "@/config/subcategories";
import { freshSince } from "@/modules/catalog/offer-view";

/**
 * The category tree with how many products sit in each branch. Categories
 * and subcategories are defined in code (config/categories.ts and
 * config/subcategories.ts) because each needs names in three languages, an
 * icon and sorting rules; the panel shows them and moves products between them.
 */
export interface BranchCounts {
  /** Switched-on products. */
  products: number;
  /** …that a store listed recently enough to be shown on the site. */
  live: number;
  /** …published as deals. */
  deals: number;
  /** …placed here by hand. */
  locked: number;
}

export interface CategoryBranch extends BranchCounts {
  slug: CategorySlug;
  subcategories: ({ slug: SubcategorySlug } & BranchCounts)[];
  /** Products whose subcategory is no longer one of the category's (rules changed). */
  stray: number;
}

const ZERO: BranchCounts = { products: 0, live: 0, deals: 0, locked: 0 };

export async function getCategoryTree(): Promise<CategoryBranch[]> {
  const since = freshSince(getMarket());
  const rows = await db
    .select({
      category: products.categorySlug,
      subcategory: products.subcategorySlug,
      products: sql<number>`count(*)::int`,
      live: sql<number>`(count(*) filter (where exists (select 1 from ${offers} where ${eq(offers.productId, products.id)} and ${gte(offers.lastSeenAt, since)})))::int`,
      deals: sql<number>`(count(*) filter (where exists (select 1 from ${deals} where ${eq(deals.productId, products.id)})))::int`,
      locked: sql<number>`(count(*) filter (where 'subcategorySlug' = any(${products.lockedFields})))::int`,
    })
    .from(products)
    .where(and(eq(products.active, true), isNull(products.mergedIntoId)))
    .groupBy(products.categorySlug, products.subcategorySlug);

  return CATEGORY_SLUGS.map((slug) => {
    const own = rows.filter((row) => row.category === slug);
    const known = subcategoriesOf(slug);
    const counts = (subcategory: string): BranchCounts => {
      const row = own.find((r) => r.subcategory === subcategory);
      return row ? { products: row.products, live: row.live, deals: row.deals, locked: row.locked } : ZERO;
    };
    const sum = (key: keyof BranchCounts) => own.reduce((total, row) => total + row[key], 0);
    return {
      slug,
      products: sum("products"),
      live: sum("live"),
      deals: sum("deals"),
      locked: sum("locked"),
      stray: own
        .filter((row) => !(known as string[]).includes(row.subcategory))
        .reduce((total, row) => total + row.products, 0),
      subcategories: known.map((subcategory) => ({ slug: subcategory, ...counts(subcategory) })),
    };
  });
}

/** Products the rules could not place, per category: the work list for sorting by hand. */
export function unsortedCount(tree: CategoryBranch[]): number {
  return tree.reduce(
    (total, branch) => total + (branch.subcategories.find((s) => s.slug === OTHER_SUBCATEGORY)?.products ?? 0),
    0,
  );
}
