import { and, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { dailyDigests, type DailyDigest, type DigestItem } from "@/db/schema";
import type { MarketConfig } from "@/config/markets";
import type { ProductCardData } from "@/modules/catalog/card";
import { listDeals } from "@/modules/deals/queries";
import { marketDay, pickTopDeals } from "./pick";

/**
 * The day's top deals ("digest"). Picked once a day, at the end of the daily
 * job, from the freshly built deals; then shown on /top, announced by the
 * notification bell and posted to the Telegram channel (modules/telegram/channel.ts).
 */

/** How many of the best deals the pick chooses from. */
const CANDIDATES = 120;

function toItem(card: ProductCardData): DigestItem {
  return {
    productId: card.productId,
    slug: card.slug,
    title: card.title,
    brand: card.brand,
    categorySlug: card.categorySlug,
    imageUrl: card.imageUrl,
    originCountry: card.originCountry,
    scope: card.scope,
    supplierName: card.supplierName,
    landedMinor: card.landedMinor,
    usualLandedMinor: card.usualLandedMinor,
    discountPct: card.discountPct,
    savingsMinor: card.savingsMinor,
    verified: card.verified,
  };
}

/**
 * Picks today's top deals, once: a digest that exists is returned as it is.
 * `replace` picks again — unless the digest was already posted, so the site
 * and the channel never show different lists for the same day.
 * Null when there are no deals to pick from.
 */
export async function buildDailyDigest(
  market: MarketConfig,
  now = new Date(),
  { replace = false }: { replace?: boolean } = {},
): Promise<DailyDigest | null> {
  const day = marketDay(now, market.timeZone);
  const existing = await getDigest(market.code, day);
  if (existing && (!replace || existing.telegramPostedAt)) return existing;

  const since = marketDay(new Date(now.getTime() - market.digest.repeatAfterDays * 86_400_000), market.timeZone);
  const recent = await db
    .select({ items: dailyDigests.items })
    .from(dailyDigests)
    .where(and(eq(dailyDigests.marketCode, market.code), gte(dailyDigests.day, since), lt(dailyDigests.day, day)));
  const recentlyPicked = new Set(recent.flatMap((row) => row.items.map((item) => item.productId)));

  const { items: candidates } = await listDeals(market, { sort: "best", limit: CANDIDATES });
  const picked = pickTopDeals(candidates, market.digest, recentlyPicked);
  if (picked.length === 0) return null;

  const items = picked.map(toItem);
  const [row] = await db
    .insert(dailyDigests)
    .values({ marketCode: market.code, day, items, createdAt: now })
    .onConflictDoUpdate({
      target: [dailyDigests.marketCode, dailyDigests.day],
      set: { items, createdAt: now, telegramError: null },
    })
    .returning();
  return row;
}

export async function getDigest(marketCode: string, day: string): Promise<DailyDigest | null> {
  const [row] = await db
    .select()
    .from(dailyDigests)
    .where(and(eq(dailyDigests.marketCode, marketCode), eq(dailyDigests.day, day)))
    .limit(1);
  return row ?? null;
}

export async function latestDigest(marketCode: string): Promise<DailyDigest | null> {
  const [row] = await listDigests(marketCode, 1);
  return row ?? null;
}

export async function listDigests(marketCode: string, limit = 14): Promise<DailyDigest[]> {
  return db
    .select()
    .from(dailyDigests)
    .where(eq(dailyDigests.marketCode, marketCode))
    .orderBy(desc(dailyDigests.day))
    .limit(limit);
}

export async function markDigestPosted(id: string, messageId: number, at = new Date()): Promise<void> {
  await db
    .update(dailyDigests)
    .set({ telegramMessageId: messageId, telegramPostedAt: at, telegramError: null })
    .where(eq(dailyDigests.id, id));
}

export async function markDigestFailed(id: string, error: string): Promise<void> {
  await db.update(dailyDigests).set({ telegramError: error.slice(0, 500) }).where(eq(dailyDigests.id, id));
}

/**
 * The digest's deals with today's prices, in the digest's order. Deals that
 * have ended since (sold out, price back up) are left out and counted.
 */
export async function digestCards(
  market: MarketConfig,
  digest: DailyDigest,
): Promise<{ cards: ProductCardData[]; ended: number }> {
  const ids = digest.items.map((item) => item.productId);
  const { items } = await listDeals(market, { productIds: ids, limit: ids.length });
  const byId = new Map(items.map((card) => [card.productId, card]));
  const cards = ids.flatMap((id) => byId.get(id) ?? []);
  return { cards, ended: ids.length - cards.length };
}
