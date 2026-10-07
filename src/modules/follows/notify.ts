import { and, desc, eq, gt, gte, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { deals, followRuns, follows, notifications, offers, products, suppliers, users } from "@/db/schema";
import type { CategorySlug } from "@/config/categories";
import type { MarketConfig } from "@/config/markets";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { freshSince } from "@/modules/catalog/offer-view";
import { sendMessage, TelegramError } from "@/modules/telegram/api";
import { telegramEnabled } from "@/modules/telegram/config";
import { messageContext } from "@/modules/telegram/context";
import { newDealsMessage } from "@/modules/telegram/format";
import { disconnectChat } from "@/modules/telegram/link";
import { matchNewDeals, type FollowRef, type NewDeal } from "./match";

/**
 * The daily "new deals from what you follow" job (npm run follows:notify,
 * meant for 10:00). It looks at the deals that started since its previous run
 * (deals.deal_since), matches them to follows, and tells each person once:
 * notifications under the bell, and one Telegram message when connected.
 * Running it twice in a row sends nothing new: the second window is empty.
 */

export interface FollowRunResult {
  windowStart: Date | null;
  windowEnd: Date;
  follows: number;
  newDeals: number;
  people: number;
  notifications: number;
  telegram: number;
}

interface Follower extends FollowRef {
  locale: string;
  telegramChatId: string | null;
}

const TELEGRAM_GAP_MS = 60;

export async function notifyFollowers(market: MarketConfig, now = new Date()): Promise<FollowRunResult> {
  const [previous] = await db
    .select({ windowEnd: followRuns.windowEnd })
    .from(followRuns)
    .where(and(eq(followRuns.marketCode, market.code), isNotNull(followRuns.finishedAt)))
    .orderBy(desc(followRuns.windowEnd))
    .limit(1);
  const [run] = await db
    .insert(followRuns)
    .values({ marketCode: market.code, windowEnd: now, startedAt: now })
    .returning({ id: followRuns.id });

  const followers: Follower[] = await db
    .select({
      userId: follows.userId,
      kind: follows.kind,
      key: follows.key,
      label: follows.label,
      createdAt: follows.createdAt,
      locale: users.locale,
      telegramChatId: users.telegramChatId,
    })
    .from(follows)
    .innerJoin(users, eq(follows.userId, users.id))
    .orderBy(follows.userId, follows.createdAt);

  // The first run has no previous window: nothing older than the oldest follow can be new anyway.
  const windowStart =
    previous?.windowEnd ??
    (followers.length ? new Date(Math.min(...followers.map((f) => f.createdAt.getTime()))) : null);
  const newDeals = followers.length && windowStart ? await loadNewDeals(market, windowStart, now) : [];
  const byUser = matchNewDeals(followers, newDeals);

  let notificationCount = 0;
  let telegram = 0;
  for (const groups of byUser.values()) {
    const person = groups[0].follow;
    const locale: Locale = isLocale(person.locale) ? person.locale : market.defaultLocale;
    const t = getDictionary(locale);
    const label = (follow: Follower) =>
      follow.kind === "category" ? (t.categories[follow.key as CategorySlug]?.name ?? follow.key) : follow.label;

    const rows = groups.flatMap(({ follow, deals: list }) =>
      list.map((deal) => ({
        userId: follow.userId,
        type: "new_deal" as const,
        productId: deal.productId,
        productTitle: deal.title,
        productSlug: deal.slug,
        supplierName: deal.storeName,
        oldPriceMinor: deal.usualLandedMinor,
        newPriceMinor: deal.landedMinor,
        followLabel: label(follow),
        createdAt: now,
      })),
    );
    await db.insert(notifications).values(rows);
    notificationCount += rows.length;

    if (person.telegramChatId && telegramEnabled()) {
      const html = newDealsMessage(
        groups.map(({ follow, deals: list }) => ({
          label: label(follow),
          deals: list.map((deal) => ({
            title: deal.title,
            slug: deal.slug,
            storeName: deal.storeName,
            landedMinor: deal.landedMinor,
            usualLandedMinor: deal.usualLandedMinor,
            discountPct: deal.discountPct,
          })),
        })),
        messageContext(locale, market),
      );
      try {
        await sendMessage(person.telegramChatId, html);
        telegram++;
      } catch (error) {
        if (error instanceof TelegramError && error.chatGone) await disconnectChat(person.telegramChatId);
        else console.error("Telegram new-deals message failed", error instanceof Error ? error.message : error);
      }
      await new Promise((resolve) => setTimeout(resolve, TELEGRAM_GAP_MS));
    }
  }

  const result: FollowRunResult = {
    windowStart,
    windowEnd: now,
    follows: followers.length,
    newDeals: newDeals.length,
    people: byUser.size,
    notifications: notificationCount,
    telegram,
  };
  await db
    .update(followRuns)
    .set({
      finishedAt: new Date(),
      stats: { follows: result.follows, people: result.people, notifications: result.notifications, telegram },
    })
    .where(eq(followRuns.id, run.id));
  return result;
}

/** Live deals that started inside the window. */
async function loadNewDeals(market: MarketConfig, from: Date, to: Date): Promise<NewDeal[]> {
  const rows = await db
    .select({
      productId: deals.productId,
      title: products.title,
      slug: products.slug,
      brandKey: sql<string | null>`lower(trim(${products.brand}))`,
      storeId: suppliers.id,
      storeName: suppliers.name,
      categorySlug: deals.categorySlug,
      landedMinor: deals.landedMinor,
      usualLandedMinor: deals.usualLandedMinor,
      discountPct: deals.realDiscountPct,
      score: deals.score,
      dealSince: deals.dealSince,
    })
    .from(deals)
    .innerJoin(products, eq(deals.productId, products.id))
    .innerJoin(offers, eq(deals.offerId, offers.id))
    .innerJoin(suppliers, eq(offers.supplierId, suppliers.id))
    .where(
      and(
        eq(deals.marketCode, market.code),
        gt(deals.dealSince, from),
        lte(deals.dealSince, to),
        gte(offers.lastSeenAt, freshSince(market, to)),
      ),
    );
  return rows.map((row) => ({ ...row, brandKey: row.brandKey || null, discountPct: Math.round(row.discountPct) }));
}
