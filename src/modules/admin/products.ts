import { and, asc, count, desc, eq, ilike, inArray, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { deals, offers, products, suppliers, type Product } from "@/db/schema";
import { detectAudience } from "@/config/audience";
import { getCategory, isCategorySlug, type CategorySlug } from "@/config/categories";
import { getMarket } from "@/config/markets";
import { classifyProduct } from "@/config/subcategories";
import { withLocks, type LockableField } from "@/modules/catalog/locks";
import { createManualOffer, type ManualOfferInput } from "@/modules/catalog/manual-offers";
import { matchKeysOf } from "@/modules/catalog/matching";
import { mergeProducts, type MergeError } from "@/modules/catalog/merge";
import { freshSince, offerIsLive } from "@/modules/catalog/offer-view";
import { resolvePlacement, type AudienceChoice, type SubcategoryChoice } from "@/modules/catalog/placement";
import { patchProductDeals, withdrawProductDeals } from "@/modules/deals/publish";

/** Products as the admin panel lists and edits them. */

export const PRODUCT_STATUSES = ["active", "off", "merged", "all"] as const;
export type ProductStatusFilter = (typeof PRODUCT_STATUSES)[number];
export const PRODUCT_SORTS = ["newest", "updated", "title"] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export interface ProductFilters {
  q?: string;
  category?: CategorySlug;
  subcategory?: string;
  store?: string;
  status?: ProductStatusFilter;
  /** Only products a store listed recently enough to be shown on the site. */
  live?: boolean;
  /** Only products with a price entered by hand. */
  manual?: boolean;
  /** Only products with fields set by hand. */
  locked?: boolean;
  sort?: ProductSort;
}

export const PRODUCT_PAGE_SIZE = 50;

export interface AdminProductRow {
  id: string;
  slug: string;
  title: string;
  brand: string | null;
  imageUrl: string | null;
  categorySlug: string;
  subcategorySlug: string;
  audience: string | null;
  active: boolean;
  merged: boolean;
  lockedFields: string[];
  offers: number;
  liveOffers: number;
  stores: string[];
  hasDeal: boolean;
  createdAt: Date;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (ch) => `\\${ch}`);

function productConditions(filters: ProductFilters): SQL[] {
  const since = freshSince(getMarket());
  const conditions: SQL[] = [];
  const q = filters.q?.trim();
  if (q) {
    if (UUID.test(q)) conditions.push(eq(products.id, q));
    else {
      const like = `%${escapeLike(q)}%`;
      conditions.push(
        or(ilike(products.title, like), ilike(products.brand, like), eq(products.slug, q), eq(products.gtin, q))!,
      );
    }
  }
  if (filters.category) conditions.push(eq(products.categorySlug, filters.category));
  if (filters.subcategory) conditions.push(eq(products.subcategorySlug, filters.subcategory));
  if (filters.store) {
    conditions.push(
      sql`exists (select 1 from ${offers} where ${eq(offers.productId, products.id)} and ${eq(offers.supplierId, filters.store)})`,
    );
  }
  switch (filters.status ?? "active") {
    case "active":
      conditions.push(eq(products.active, true));
      break;
    case "off":
      conditions.push(and(eq(products.active, false), isNull(products.mergedIntoId))!);
      break;
    case "merged":
      conditions.push(isNotNull(products.mergedIntoId));
      break;
  }
  if (filters.live) {
    conditions.push(
      sql`exists (select 1 from ${offers} where ${eq(offers.productId, products.id)} and ${offerIsLive(since)})`,
    );
  }
  if (filters.manual) {
    conditions.push(
      sql`exists (select 1 from ${offers} where ${eq(offers.productId, products.id)} and ${eq(offers.manual, true)})`,
    );
  }
  if (filters.locked) conditions.push(sql`cardinality(${products.lockedFields}) > 0`);
  return conditions;
}

const SORTS: Record<ProductSort, SQL[]> = {
  newest: [desc(products.createdAt), asc(products.id)],
  updated: [desc(products.updatedAt), asc(products.id)],
  title: [asc(products.title), asc(products.id)],
};

export async function listAdminProducts(
  filters: ProductFilters,
  page = 1,
  pageSize = PRODUCT_PAGE_SIZE,
): Promise<{ rows: AdminProductRow[]; total: number }> {
  const since = freshSince(getMarket());
  const where = and(...productConditions(filters));

  const stats = db
    .select({
      productId: offers.productId,
      total: sql<number>`count(*)::int`.as("total"),
      live: sql<number>`(count(*) filter (where ${offerIsLive(since)}))::int`.as("live"),
      stores: sql<string[]>`array_agg(distinct ${suppliers.name})`.as("stores"),
    })
    .from(offers)
    .innerJoin(suppliers, eq(offers.supplierId, suppliers.id))
    .groupBy(offers.productId)
    .as("stats");

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        product: products,
        offers: stats.total,
        liveOffers: stats.live,
        stores: stats.stores,
        hasDeal: sql<boolean>`exists (select 1 from ${deals} where ${eq(deals.productId, products.id)})`,
      })
      .from(products)
      .leftJoin(stats, eq(stats.productId, products.id))
      .where(where)
      .orderBy(...SORTS[filters.sort ?? "newest"])
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(products).where(where),
  ]);

  return {
    total,
    rows: rows.map(({ product, ...row }) => ({
      id: product.id,
      slug: product.slug,
      title: product.title,
      brand: product.brand,
      imageUrl: product.imageUrl,
      categorySlug: product.categorySlug,
      subcategorySlug: product.subcategorySlug,
      audience: product.audience,
      active: product.active,
      merged: !!product.mergedIntoId,
      lockedFields: product.lockedFields,
      offers: row.offers ?? 0,
      liveOffers: row.liveOffers ?? 0,
      stores: row.stores ?? [],
      hasDeal: row.hasDeal,
      createdAt: product.createdAt,
    })),
  };
}

export interface AdminOffer {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierActive: boolean;
  url: string;
  title: string;
  priceMinor: number;
  listPriceMinor: number | null;
  shippingMinor: number | null;
  currency: string;
  inStock: boolean;
  manual: boolean;
  deliveryMinDays: number | null;
  deliveryMaxDays: number | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  /** Seen recently enough to be shown on the site. */
  live: boolean;
}

type ProductLink = Pick<Product, "id" | "slug" | "title">;

export interface AdminProductDetail {
  product: Product;
  offers: AdminOffer[];
  deal: { landedMinor: number; realDiscountPct: number; verified: boolean; score: number } | null;
  mergedInto: ProductLink | null;
  duplicates: ProductLink[];
}

export async function getAdminProduct(id: string): Promise<AdminProductDetail | null> {
  if (!UUID.test(id)) return null;
  const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!product) return null;

  const since = freshSince(getMarket());
  const link = { id: products.id, slug: products.slug, title: products.title };
  const [offerRows, [deal], mergedInto, duplicates] = await Promise.all([
    db
      .select({ offer: offers, supplierName: suppliers.name, supplierActive: suppliers.active })
      .from(offers)
      .innerJoin(suppliers, eq(offers.supplierId, suppliers.id))
      .where(eq(offers.productId, id))
      .orderBy(desc(offers.lastSeenAt)),
    db
      .select({
        landedMinor: deals.landedMinor,
        realDiscountPct: deals.realDiscountPct,
        verified: deals.verified,
        score: deals.score,
      })
      .from(deals)
      .where(eq(deals.productId, id))
      .limit(1),
    product.mergedIntoId ? db.select(link).from(products).where(eq(products.id, product.mergedIntoId)).limit(1) : [],
    db.select(link).from(products).where(eq(products.mergedIntoId, id)).orderBy(asc(products.title)),
  ]);

  return {
    product,
    deal: deal ?? null,
    mergedInto: mergedInto[0] ?? null,
    duplicates,
    offers: offerRows.map(({ offer, supplierName, supplierActive }) => ({
      id: offer.id,
      supplierId: offer.supplierId,
      supplierName,
      supplierActive,
      url: offer.url,
      title: offer.title,
      priceMinor: offer.priceMinor,
      listPriceMinor: offer.listPriceMinor,
      shippingMinor: offer.shippingMinor,
      currency: offer.currency,
      inStock: offer.inStock,
      manual: offer.manual,
      deliveryMinDays: offer.deliveryMinDays,
      deliveryMaxDays: offer.deliveryMaxDays,
      firstSeenAt: offer.firstSeenAt,
      lastSeenAt: offer.lastSeenAt,
      live: offer.lastSeenAt >= since && offer.removedAt === null,
    })),
  };
}

export interface ProductEdit {
  title: string;
  brand: string | null;
  gtin: string | null;
  imageUrl: string | null;
  weightKg: number | null;
  categorySlug: CategorySlug;
  subcategory: SubcategoryChoice;
  audience: AudienceChoice;
}

export type ProductEditResult = { ok: true; changed: string[] } | { ok: false; error: "notFound" };

export async function updateProduct(id: string, edit: ProductEdit): Promise<ProductEditResult> {
  const [current] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!current || !isCategorySlug(current.categorySlug)) return { ok: false, error: "notFound" };

  const placement = resolvePlacement(
    { ...current, categorySlug: current.categorySlug },
    { categorySlug: edit.categorySlug, subcategory: edit.subcategory, audience: edit.audience },
  );

  const handSet: LockableField[] = [];
  if (edit.title !== current.title) handSet.push("title");
  if (edit.brand !== current.brand) handSet.push("brand");
  if (edit.imageUrl !== current.imageUrl) handSet.push("imageUrl");

  const next = {
    title: edit.title,
    brand: edit.brand,
    gtin: edit.gtin,
    imageUrl: edit.imageUrl,
    weightKg: edit.weightKg,
    ...placement,
    lockedFields: withLocks(placement.lockedFields, handSet),
  };
  const changed = (Object.keys(next) as (keyof typeof next)[]).filter(
    (key) => key !== "lockedFields" && JSON.stringify(next[key]) !== JSON.stringify(current[key]),
  );
  if (changed.length === 0 && next.lockedFields.join() === current.lockedFields.join()) return { ok: true, changed };

  await db
    .update(products)
    .set({ ...next, updatedAt: new Date() })
    .where(eq(products.id, id));
  await patchProductDeals([id], {
    categorySlug: placement.categorySlug,
    subcategorySlug: placement.subcategorySlug,
    audience: placement.audience,
  });
  return { ok: true, changed };
}

interface ProductBrief {
  id: string;
  title: string;
}

/** Moves products to a category and subcategory (or lets the rules pick the subcategory). */
export async function moveProducts(
  ids: string[],
  categorySlug: CategorySlug,
  subcategory: SubcategoryChoice,
): Promise<ProductBrief[]> {
  const rows = await db.select().from(products).where(inArray(products.id, ids));
  for (const row of rows) {
    if (!isCategorySlug(row.categorySlug)) continue;
    const placement = resolvePlacement({ ...row, categorySlug: row.categorySlug }, { categorySlug, subcategory });
    await db
      .update(products)
      .set({
        categorySlug: placement.categorySlug,
        subcategorySlug: placement.subcategorySlug,
        lockedFields: placement.lockedFields,
        updatedAt: new Date(),
      })
      .where(eq(products.id, row.id));
    await patchProductDeals([row.id], {
      categorySlug: placement.categorySlug,
      subcategorySlug: placement.subcategorySlug,
    });
  }
  return rows.map((row) => ({ id: row.id, title: row.title }));
}

export async function setProductsAudience(ids: string[], audience: AudienceChoice): Promise<ProductBrief[]> {
  const rows = await db.select().from(products).where(inArray(products.id, ids));
  for (const row of rows) {
    if (!isCategorySlug(row.categorySlug)) continue;
    const placement = resolvePlacement(
      { ...row, categorySlug: row.categorySlug },
      { categorySlug: row.categorySlug, audience },
    );
    await db
      .update(products)
      .set({ audience: placement.audience, lockedFields: placement.lockedFields, updatedAt: new Date() })
      .where(eq(products.id, row.id));
    await patchProductDeals([row.id], { audience: placement.audience });
  }
  return rows.map((row) => ({ id: row.id, title: row.title }));
}

/**
 * Switches products on or off. Off takes them off the site at once; on brings
 * them back with the next publish. A merged duplicate stays off.
 */
export async function setProductsActive(ids: string[], active: boolean): Promise<ProductBrief[]> {
  const updated = await db
    .update(products)
    .set({ active, updatedAt: new Date() })
    .where(and(inArray(products.id, ids), isNull(products.mergedIntoId), eq(products.active, !active)))
    .returning({ id: products.id, title: products.title });
  if (!active) await withdrawProductDeals(updated.map((row) => row.id));
  return updated;
}

/** The product a person means by its page address (site or admin panel), slug or id. */
export async function findProductRef(reference: string): Promise<ProductLink | null> {
  const value = reference.trim();
  const slug = /\/products?\/([^/?#]+)/.exec(value)?.[1] ?? value;
  const [row] = await db
    .select({ id: products.id, slug: products.slug, title: products.title })
    .from(products)
    .where(UUID.test(slug) ? eq(products.id, slug) : eq(products.slug, decodeURIComponent(slug)))
    .limit(1);
  return row ?? null;
}

export async function mergeProductInto(
  sourceId: string,
  targetReference: string,
): Promise<{ ok: true; target: ProductLink; movedOffers: number } | { ok: false; error: MergeError }> {
  const target = await findProductRef(targetReference);
  if (!target) return { ok: false, error: "notFound" };
  const result = await mergeProducts(sourceId, target.id);
  return result.ok ? { ok: true, target, movedOffers: result.movedOffers } : result;
}

export interface NewProduct {
  title: string;
  brand: string | null;
  model: string | null;
  gtin: string | null;
  imageUrl: string | null;
  weightKg: number | null;
  categorySlug: CategorySlug;
  subcategory: SubcategoryChoice;
  audience: AudienceChoice;
  offer: Omit<ManualOfferInput, "productId" | "title">;
}

export type CreateProductResult =
  { ok: true; id: string } | { ok: false; error: "productExists"; existing: ProductLink };

/**
 * Adds a product by hand with its first offer. Its match keys are the ones a
 * store listing of the same item would produce, so a store that starts
 * selling it later adds its offer to this product instead of a duplicate.
 */
export async function createProduct(input: NewProduct): Promise<CreateProductResult> {
  const keys = matchKeysOf({
    title: input.title,
    brand: input.brand ?? undefined,
    model: input.model ?? undefined,
    gtin: input.gtin ?? undefined,
  });
  const [existing] = await db
    .select({ id: products.id, slug: products.slug, title: products.title })
    .from(products)
    .where(
      or(
        eq(products.modelKey, keys.modelKey),
        eq(products.slug, keys.modelKey),
        keys.gtin ? eq(products.gtin, keys.gtin) : undefined,
      ),
    )
    .limit(1);
  if (existing) return { ok: false, error: "productExists", existing };

  const placement = resolvePlacement(
    {
      title: input.title,
      brand: input.brand,
      sourceType: null,
      categorySlug: input.categorySlug,
      subcategorySlug: classifyProduct(input.categorySlug, input.title),
      audience: detectAudience(input.title, input.brand),
      lockedFields: ["title", "categorySlug", ...(input.brand ? (["brand"] as const) : [])],
    },
    { categorySlug: input.categorySlug, subcategory: input.subcategory, audience: input.audience },
  );

  const [created] = await db
    .insert(products)
    .values({
      slug: keys.modelKey,
      title: input.title,
      brand: input.brand,
      model: input.model,
      gtin: keys.gtin,
      modelKey: keys.modelKey,
      imageUrl: input.imageUrl,
      weightKg: input.weightKg ?? getCategory(input.categorySlug).defaultWeightKg,
      ...placement,
    })
    .returning({ id: products.id });

  await createManualOffer({ ...input.offer, productId: created.id, title: input.title });
  return { ok: true, id: created.id };
}

export async function productLabels(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: products.id, title: products.title })
    .from(products)
    .where(inArray(products.id, ids));
  return new Map(rows.map((row) => [row.id, row.title]));
}
