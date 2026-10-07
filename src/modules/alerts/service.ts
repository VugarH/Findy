import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { notifications, priceWatches, products, pushSubscriptions, type Notification } from "@/db/schema";
import type { MarketConfig } from "@/config/markets";
import { toCard, type ProductCardData } from "@/modules/catalog/card";
import { loadProductsWithOffers } from "@/modules/catalog/offer-view";
import { summarizeProduct } from "@/modules/catalog/summary";

export type ToggleResult = { watched: boolean } | { error: "notFound" | "unavailable" | "limit" };

/** Turns the price alert for a product on or off. */
export async function toggleWatch(userId: string, productId: string, market: MarketConfig): Promise<ToggleResult> {
  const removed = await db
    .delete(priceWatches)
    .where(and(eq(priceWatches.userId, userId), eq(priceWatches.productId, productId)))
    .returning({ id: priceWatches.id });
  if (removed.length > 0) return { watched: false };

  const [{ total }] = await db.select({ total: count() }).from(priceWatches).where(eq(priceWatches.userId, userId));
  if (total >= market.alerts.maxWatches) return { error: "limit" };

  const [entry] = await loadProductsWithOffers(market, new Date(), [productId]);
  if (!entry) {
    const [exists] = await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1);
    return { error: exists ? "unavailable" : "notFound" };
  }
  // The price being watched is the one the person sees: the best landed price right now.
  const price = summarizeProduct(entry, market)?.best.landed.totalMinor;
  if (price === undefined) return { error: "unavailable" };

  await db
    .insert(priceWatches)
    .values({ userId, productId, marketCode: market.code, startPriceMinor: price, lastPriceMinor: price })
    .onConflictDoNothing();
  return { watched: true };
}

export async function listWatchedProductIds(userId: string): Promise<string[]> {
  const rows = await db.select({ productId: priceWatches.productId }).from(priceWatches).where(eq(priceWatches.userId, userId));
  return rows.map((row) => row.productId);
}

export interface WatchedProduct {
  productId: string;
  title: string;
  slug: string;
  startPriceMinor: number;
  createdAt: Date;
  /** Null when no store has it in stock right now. */
  card: ProductCardData | null;
}

export async function listWatches(userId: string, market: MarketConfig): Promise<WatchedProduct[]> {
  const rows = await db
    .select({ watch: priceWatches, title: products.title, slug: products.slug })
    .from(priceWatches)
    .innerJoin(products, eq(priceWatches.productId, products.id))
    .where(eq(priceWatches.userId, userId))
    .orderBy(desc(priceWatches.createdAt));
  if (rows.length === 0) return [];

  const entries = await loadProductsWithOffers(market, new Date(), rows.map((row) => row.watch.productId));
  const cards = new Map<string, ProductCardData>();
  for (const entry of entries) {
    const summary = summarizeProduct(entry, market);
    if (summary) cards.set(entry.product.id, toCard(entry.product, summary));
  }

  return rows.map(({ watch, title, slug }) => ({
    productId: watch.productId,
    title,
    slug,
    startPriceMinor: watch.startPriceMinor,
    createdAt: watch.createdAt,
    card: cards.get(watch.productId) ?? null,
  }));
}

export async function listNotifications(userId: string, limit = 30): Promise<Notification[]> {
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit);
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const [{ total }] = await db
    .select({ total: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return total;
}

export async function markNotificationsRead(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}

export async function savePushSubscription(
  userId: string,
  subscription: { endpoint: string; p256dh: string; auth: string },
): Promise<void> {
  await db
    .insert(pushSubscriptions)
    .values({ userId, ...subscription })
    // The same browser signing in as someone else moves the subscription to them.
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh: subscription.p256dh, auth: subscription.auth },
    });
}

export async function removePushSubscription(userId: string, endpoint: string): Promise<void> {
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
}
