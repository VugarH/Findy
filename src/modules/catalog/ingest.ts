import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { GALLERY_MAX } from "@/config/images";
import { db } from "@/db/client";
import { offers, priceObservations, products, soldOutPages as soldOutPagesTable, suppliers } from "@/db/schema";
import { detectAudience } from "@/config/audience";
import { getCategory } from "@/config/categories";
import { classifyProduct } from "@/config/subcategories";
import type { RawOffer, SupplierDefinition } from "@/modules/suppliers/types";
import { canonicalTitle, matchKeysOf } from "./matching";
import { resolveMergedProducts } from "./merge";

export interface IngestResult {
  offerCount: number;
  productIds: string[];
}

/** The suppliers-table columns that describe a store, from its definition. */
export const supplierColumns = (d: SupplierDefinition) => ({
  id: d.id,
  name: d.name,
  scope: d.scope,
  originCountry: d.originCountry,
  currency: d.currency,
  websiteUrl: d.websiteUrl,
  trustScore: d.trustScore,
  integration: d.integration,
  accessMethod: { ...d.access, reliability: d.reliability, shipsToMarket: d.shipsToMarket },
});

const DEFINITION_UPDATE = {
  name: sql`excluded.name`,
  scope: sql`excluded.scope`,
  originCountry: sql`excluded.origin_country`,
  currency: sql`excluded.currency`,
  websiteUrl: sql`excluded.website_url`,
  trustScore: sql`excluded.trust_score`,
  integration: sql`excluded.integration`,
  accessMethod: sql`excluded.access_method`,
  updatedAt: sql`now()`,
};

/**
 * Registers a store in the database. Call only after it has returned real
 * offers: the suppliers table is the list of stores we actually use, together
 * with their link and the method we use to read them.
 */
export async function registerSupplier(definition: SupplierDefinition): Promise<void> {
  await db
    .insert(suppliers)
    .values(supplierColumns(definition))
    .onConflictDoUpdate({ target: suppliers.id, set: DEFINITION_UPDATE });
}

/** Registers the store (if new) and records a successful catalog fetch. */
export async function recordSupplierSuccess(
  definition: SupplierDefinition,
  offerCount: number,
  at: Date,
): Promise<void> {
  await db
    .insert(suppliers)
    .values({ ...supplierColumns(definition), firstVerifiedAt: at, lastSuccessAt: at, lastOfferCount: offerCount })
    .onConflictDoUpdate({
      target: suppliers.id,
      set: { ...DEFINITION_UPDATE, lastSuccessAt: at, lastOfferCount: offerCount, lastError: null, lastErrorAt: null },
    });
}

/** Notes a failed fetch on a store we already use. Unknown stores stay unregistered. */
export async function recordSupplierFailure(supplierId: string, error: string, at: Date): Promise<void> {
  await db.update(suppliers).set({ lastError: error.slice(0, 500), lastErrorAt: at }).where(eq(suppliers.id, supplierId));
}

/**
 * Stores one supplier's listings: matches each to a product (creating it when
 * new), upserts the offer and records today's price observation.
 * Used by both the daily job and live search, so both feed the same catalog.
 */
/**
 * After a successful read of a store's whole listing: its offers this read did
 * not list are gone there (deleted, unpublished), so they stop showing now
 * rather than when they turn stale. Offers entered by hand are never touched.
 * Returns how many were marked.
 */
export async function markUnlistedOffers(supplierId: string, readAt: Date): Promise<number> {
  const marked = await db
    .update(offers)
    .set({ removedAt: readAt })
    .where(
      and(
        eq(offers.supplierId, supplierId),
        eq(offers.manual, false),
        lt(offers.lastSeenAt, readAt),
        isNull(offers.removedAt),
      ),
    )
    .returning({ id: offers.id });
  return marked.length;
}

/**
 * One listing per store id. Some stores show the same SKU on several pages
 * (Desa), and one insert cannot write the same offer twice; the in-stock
 * listing wins, else the first.
 */
/**
 * Rows per insert. PostgreSQL takes at most 65,535 parameters per statement and
 * an offer has 15: one statement for a 5,000-offer store (AliExpress) would fail.
 */
const WRITE_BATCH = 1000;

function* batches<T>(items: T[], size: number): Generator<T[]> {
  for (let i = 0; i < items.length; i += size) yield items.slice(i, i + size);
}

export function uniqueListings(rawOffers: RawOffer[]): RawOffer[] {
  const byId = new Map<string, RawOffer>();
  for (const raw of rawOffers) {
    const kept = byId.get(raw.externalId);
    if (!kept || (!kept.inStock && raw.inStock)) byId.set(raw.externalId, raw);
  }
  return [...byId.values()];
}

/**
 * Drops listings that may only update an offer we already track: update-only
 * listings (RawOffer.updateOnly), and sold-out ones — an item we never saw in
 * stock is of no use to anyone, while one we show must learn it sold out.
 */
async function withoutUntracked(supplierId: string, rawOffers: RawOffer[]): Promise<RawOffer[]> {
  const updateOnly = rawOffers.filter((raw) => raw.updateOnly || !raw.inStock).map((raw) => raw.externalId);
  if (updateOnly.length === 0) return rawOffers;
  const tracked = new Set<string>();
  for (let i = 0; i < updateOnly.length; i += 1000) {
    const rows = await db
      .select({ externalId: offers.externalId })
      .from(offers)
      .where(and(eq(offers.supplierId, supplierId), inArray(offers.externalId, updateOnly.slice(i, i + 1000))));
    for (const row of rows) tracked.add(row.externalId);
  }
  return rawOffers.filter((raw) => !(raw.updateOnly || !raw.inStock) || tracked.has(raw.externalId));
}

/**
 * Sold-out pages we do not save as offers are remembered (sold_out_pages), so
 * a sampling adapter does not spend tomorrow's reads on them again; a page
 * back in stock is forgotten.
 */
async function rememberSoldOutPages(supplierId: string, listed: RawOffer[], kept: RawOffer[], now: Date) {
  const keptIds = new Set(kept.map((raw) => raw.externalId));
  const dropped = [...new Set(listed.filter((raw) => !raw.inStock && !keptIds.has(raw.externalId)).map((raw) => raw.url))];
  for (const batch of batches(dropped, WRITE_BATCH)) {
    await db
      .insert(soldOutPagesTable)
      .values(batch.map((url) => ({ supplierId, url, checkedAt: now })))
      .onConflictDoUpdate({ target: [soldOutPagesTable.supplierId, soldOutPagesTable.url], set: { checkedAt: now } });
  }
  const inStock = [...new Set(listed.filter((raw) => raw.inStock).map((raw) => raw.url))];
  for (const batch of batches(inStock, WRITE_BATCH)) {
    await db
      .delete(soldOutPagesTable)
      .where(and(eq(soldOutPagesTable.supplierId, supplierId), inArray(soldOutPagesTable.url, batch)));
  }
}

/** The store's pages that were sold out when last read, with when that was (AdapterContext.soldOutPages). */
export async function soldOutPages(supplierId: string): Promise<Map<string, Date>> {
  const tracked = await db
    .select({ url: offers.url, checkedAt: offers.lastSeenAt })
    .from(offers)
    .where(and(eq(offers.supplierId, supplierId), eq(offers.inStock, false), isNull(offers.removedAt)));
  const untracked = await db
    .select({ url: soldOutPagesTable.url, checkedAt: soldOutPagesTable.checkedAt })
    .from(soldOutPagesTable)
    .where(eq(soldOutPagesTable.supplierId, supplierId));
  return new Map([...tracked, ...untracked].map((row) => [row.url, row.checkedAt]));
}

export async function ingestOffers(
  supplier: SupplierDefinition,
  listed: RawOffer[],
  now: Date,
): Promise<IngestResult> {
  const unique = uniqueListings(listed);
  const rawOffers = await withoutUntracked(supplier.id, unique);
  // Only page-by-page stores sample their catalog; feed stores read everything anyway.
  if (supplier.integration === "crawler") await rememberSoldOutPages(supplier.id, unique, rawOffers, now);
  if (rawOffers.length === 0) return { offerCount: 0, productIds: [] };

  const allKeyed = rawOffers.map((raw) => ({ raw, keys: matchKeysOf(raw) }));
  // A listing whose product was merged into another (admin panel) goes to the product that stays.
  const matched = await resolveProducts(allKeyed);
  const merged = await resolveMergedProducts(matched);
  const allProductIds = matched.map((id) => merged.get(id) ?? id);

  // Switched-off products (products.active = false): their prices are no longer recorded.
  const inactive = new Set(
    (
      await db
        .select({ id: products.id })
        .from(products)
        .where(and(inArray(products.id, [...new Set(allProductIds)]), eq(products.active, false)))
    ).map((row) => row.id),
  );
  const keyed = allKeyed.filter((_, i) => !inactive.has(allProductIds[i]));
  const productIdByRaw = allProductIds.filter((id) => !inactive.has(id));
  if (keyed.length === 0) return { offerCount: 0, productIds: [] };

  // Remember the store's product type on products that do not have one yet.
  const typed = keyed.flatMap(({ raw }, i) => (raw.productType ? [{ id: productIdByRaw[i], type: raw.productType }] : []));
  if (typed.length > 0) {
    const values = sql.join(typed.map((row) => sql`(${row.id}::uuid, ${row.type})`), sql`, `);
    await db.execute(
      sql`update products set source_type = v.type from (values ${values}) as v(id, type) where products.id = v.id and products.source_type is null`,
    );
  }

  const observedOn = now.toISOString().slice(0, 10);

  const saved: { id: string; priceMinor: number; currency: string }[] = [];
  for (let start = 0; start < keyed.length; start += WRITE_BATCH) {
    const rows = await db
      .insert(offers)
      .values(
        keyed.slice(start, start + WRITE_BATCH).map(({ raw }, j) => ({
          productId: productIdByRaw[start + j],
          supplierId: supplier.id,
          externalId: raw.externalId,
          url: raw.url,
          title: raw.title,
          priceMinor: raw.priceMinor,
          currency: raw.currency,
          listPriceMinor: raw.listPriceMinor ?? null,
          shippingMinor: raw.shippingMinor,
          inStock: raw.inStock,
          sizes: raw.sizes ?? null,
          images: raw.images?.length ? raw.images.slice(0, GALLERY_MAX) : null,
          deliveryMinDays: raw.deliveryDays?.min ?? null,
          deliveryMaxDays: raw.deliveryDays?.max ?? null,
          firstSeenAt: now,
          lastSeenAt: now,
        })),
      )
      .onConflictDoUpdate({
        target: [offers.supplierId, offers.externalId],
        set: {
          productId: sql`excluded.product_id`,
          url: sql`excluded.url`,
          title: sql`excluded.title`,
          priceMinor: sql`excluded.price_minor`,
          currency: sql`excluded.currency`,
          listPriceMinor: sql`excluded.list_price_minor`,
          shippingMinor: sql`excluded.shipping_minor`,
          inStock: sql`excluded.in_stock`,
          sizes: sql`excluded.sizes`,
          images: sql`excluded.images`,
          deliveryMinDays: sql`excluded.delivery_min_days`,
          deliveryMaxDays: sql`excluded.delivery_max_days`,
          lastSeenAt: sql`excluded.last_seen_at`,
          removedAt: null,
        },
      })
      .returning({ id: offers.id, priceMinor: offers.priceMinor, currency: offers.currency });
    saved.push(...rows);
  }

  for (const batch of batches(saved, WRITE_BATCH)) {
    await db
      .insert(priceObservations)
      .values(batch.map((o) => ({ offerId: o.id, observedOn, priceMinor: o.priceMinor, currency: o.currency })))
      .onConflictDoUpdate({
        target: [priceObservations.offerId, priceObservations.observedOn],
        set: { priceMinor: sql`excluded.price_minor`, currency: sql`excluded.currency` },
      });
  }

  return { offerCount: saved.length, productIds: [...new Set(productIdByRaw)] };
}

/** Returns the product id for each raw offer, in order, creating missing products. */
async function resolveProducts(
  keyed: { raw: RawOffer; keys: ReturnType<typeof matchKeysOf> }[],
): Promise<string[]> {
  const gtins = [...new Set(keyed.map((k) => k.keys.gtin).filter((g): g is string => !!g))];
  const modelKeys = [...new Set(keyed.map((k) => k.keys.modelKey))];

  const loadKnown = () =>
    db
      .select({ id: products.id, gtin: products.gtin, modelKey: products.modelKey })
      .from(products)
      .where(or(gtins.length ? inArray(products.gtin, gtins) : undefined, inArray(products.modelKey, modelKeys)));

  const index = (rows: Awaited<ReturnType<typeof loadKnown>>) => {
    const byGtin = new Map<string, string>();
    const byModelKey = new Map<string, string>();
    for (const row of rows) {
      if (row.gtin) byGtin.set(row.gtin, row.id);
      if (row.modelKey) byModelKey.set(row.modelKey, row.id);
    }
    return (keys: { gtin: string | null; modelKey: string }) =>
      (keys.gtin && byGtin.get(keys.gtin)) || byModelKey.get(keys.modelKey);
  };

  let known = await loadKnown();
  let find = index(known);

  const missing = new Map<string, (typeof keyed)[number]>();
  for (const item of keyed) {
    if (!find(item.keys) && !missing.has(item.keys.modelKey)) missing.set(item.keys.modelKey, item);
  }

  if (missing.size > 0) {
    for (const batch of batches([...missing.values()], WRITE_BATCH)) {
      await db
        .insert(products)
        .values(
          batch.map(({ raw, keys }) => ({
            slug: keys.modelKey,
            title: canonicalTitle(raw),
            brand: raw.brand ?? null,
            model: raw.model ?? null,
            gtin: keys.gtin,
            modelKey: keys.modelKey,
            categorySlug: raw.categorySlug,
            subcategorySlug: classifyProduct(raw.categorySlug, canonicalTitle(raw), raw.productType),
            audience: detectAudience(`${canonicalTitle(raw)} ${raw.productType ?? ""}`, raw.brand),
            sourceType: raw.productType ?? null,
            imageUrl: raw.imageUrl ?? null,
            weightKg: raw.weightKg ?? getCategory(raw.categorySlug).defaultWeightKg,
            attributes: raw.attributes ?? {},
          })),
        )
        .onConflictDoNothing({ target: products.slug });
    }
    known = await loadKnown();
    find = index(known);
  }

  // Enrich products first seen without a GTIN once a supplier provides one.
  const gtinByProduct = new Map<string, string>();
  for (const { keys } of keyed) {
    const id = find(keys);
    if (id && keys.gtin && !known.find((row) => row.id === id)?.gtin) gtinByProduct.set(id, keys.gtin);
  }
  for (const [id, gtin] of gtinByProduct) {
    await db.update(products).set({ gtin, updatedAt: new Date() }).where(sql`${products.id} = ${id}`);
  }

  return keyed.map(({ keys, raw }) => {
    const id = find(keys);
    if (!id) throw new Error(`Could not resolve a product for "${raw.title}"`);
    return id;
  });
}
