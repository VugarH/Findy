import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { deals, notifications, offers, orderRequests, priceWatches, products } from "@/db/schema";

/**
 * Merging duplicates: when two product rows are really the same item (stores
 * named it too differently for the matcher), the duplicate's offers move to
 * the product that stays. The duplicate is kept, switched off, with a pointer
 * to the product it went into, so that
 *   - the daily job keeps sending that store's listing to the right product
 *     (ingest follows the pointer), and
 *   - old links to the duplicate's page redirect instead of breaking.
 */

const MAX_HOPS = 8;

/** Follows "merged into" pointers from `id` to the product that stays. */
export function followMergeChain(id: string, mergedInto: ReadonlyMap<string, string>): string {
  let current = id;
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const next = mergedInto.get(current);
    if (!next || next === id) return current;
    current = next;
  }
  return current;
}

/** Maps each product id to the product it was merged into (itself when it was not). */
export async function resolveMergedProducts(ids: readonly string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  const pointers = new Map<string, string>();
  let frontier = unique;
  for (let hop = 0; hop < MAX_HOPS && frontier.length > 0; hop++) {
    const rows = await db
      .select({ id: products.id, mergedIntoId: products.mergedIntoId })
      .from(products)
      .where(and(inArray(products.id, frontier), isNotNull(products.mergedIntoId)));
    frontier = [];
    for (const row of rows) {
      pointers.set(row.id, row.mergedIntoId!);
      if (!pointers.has(row.mergedIntoId!)) frontier.push(row.mergedIntoId!);
    }
  }
  return new Map(unique.map((id) => [id, followMergeChain(id, pointers)]));
}

/** For a merged product's page address: the address of the product it went into. */
export async function findMergeTargetSlug(slug: string): Promise<string | null> {
  const target = alias(products, "target");
  const [row] = await db
    .select({ slug: target.slug, active: target.active })
    .from(products)
    .innerJoin(target, eq(products.mergedIntoId, target.id))
    .where(eq(products.slug, slug))
    .limit(1);
  return row?.active ? row.slug : null;
}

export type MergeError = "same" | "notFound" | "targetMerged";

/**
 * Moves everything of `sourceId` to `targetId` and retires the source.
 * Watches, order requests and notifications follow the offers. The target's
 * deal reflects the extra offers once deals are published again.
 */
export async function mergeProducts(
  sourceId: string,
  targetId: string,
): Promise<{ ok: true; movedOffers: number } | { ok: false; error: MergeError }> {
  if (sourceId === targetId) return { ok: false, error: "same" };

  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: products.id,
        mergedIntoId: products.mergedIntoId,
        imageUrl: products.imageUrl,
        gtin: products.gtin,
      })
      .from(products)
      .where(inArray(products.id, [sourceId, targetId]));
    const source = rows.find((row) => row.id === sourceId);
    const target = rows.find((row) => row.id === targetId);
    if (!source || !target) return { ok: false, error: "notFound" } as const;
    if (target.mergedIntoId) return { ok: false, error: "targetMerged" } as const;

    const moved = await tx
      .update(offers)
      .set({ productId: targetId })
      .where(eq(offers.productId, sourceId))
      .returning({ id: offers.id });

    // A person watching both keeps one watch (the target's).
    await tx.execute(sql`
      insert into ${priceWatches} (user_id, product_id, market_code, start_price_minor, last_price_minor, created_at, last_notified_at)
      select user_id, ${targetId}::uuid, market_code, start_price_minor, last_price_minor, created_at, last_notified_at
      from ${priceWatches} where product_id = ${sourceId}::uuid
      on conflict do nothing`);
    await tx.delete(priceWatches).where(eq(priceWatches.productId, sourceId));
    await tx.update(orderRequests).set({ productId: targetId }).where(eq(orderRequests.productId, sourceId));
    await tx.update(notifications).set({ productId: targetId }).where(eq(notifications.productId, sourceId));
    await tx.delete(deals).where(eq(deals.productId, sourceId));

    // Earlier duplicates of the source now point straight at the target.
    await tx.update(products).set({ mergedIntoId: targetId }).where(eq(products.mergedIntoId, sourceId));
    await tx
      .update(products)
      .set({ active: false, mergedIntoId: targetId, updatedAt: new Date() })
      .where(eq(products.id, sourceId));
    if ((!target.imageUrl && source.imageUrl) || (!target.gtin && source.gtin)) {
      await tx
        .update(products)
        .set({ imageUrl: target.imageUrl ?? source.imageUrl, gtin: target.gtin ?? source.gtin, updatedAt: new Date() })
        .where(eq(products.id, targetId));
    }
    return { ok: true, movedOffers: moved.length } as const;
  });
}
