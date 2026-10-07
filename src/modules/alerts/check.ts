import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { notifications, priceWatches, pushSubscriptions, users } from "@/db/schema";
import type { MarketConfig } from "@/config/markets";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { fmt, localePath } from "@/i18n/format";
import { formatMoney } from "@/lib/money";
import { loadProductsWithOffers } from "@/modules/catalog/offer-view";
import { summarizeProduct } from "@/modules/catalog/summary";
import { sendDropAlerts } from "@/modules/telegram/alerts";
import { telegramEnabled } from "@/modules/telegram/config";
import type { DropAlert } from "@/modules/telegram/format";
import { dropPercent, isNotableDrop } from "./detect";
import { sendPush } from "./push";

export interface AlertCheckResult {
  watches: number;
  notified: number;
  pushed: number;
  /** People who got their drops in Telegram. */
  telegram: number;
}

/** Telegram allows about 30 messages a second across chats; stay well below. */
const TELEGRAM_GAP_MS = 60;

/**
 * Compares every watched product's best price with the price at the last
 * check. A notable drop becomes a notification on the site, a push to the
 * person's browsers and — when they connected Telegram — one Telegram
 * message per person with all of their drops. Runs at the end of the daily
 * job, once prices are fresh.
 */
export async function checkPriceWatches(market: MarketConfig, now = new Date()): Promise<AlertCheckResult> {
  const watches = await db
    .select({ watch: priceWatches, locale: users.locale, telegramChatId: users.telegramChatId })
    .from(priceWatches)
    .innerJoin(users, eq(priceWatches.userId, users.id))
    .where(eq(priceWatches.marketCode, market.code));
  if (watches.length === 0) return { watches: 0, notified: 0, pushed: 0, telegram: 0 };

  const productIds = [...new Set(watches.map(({ watch }) => watch.productId))];
  const entries = await loadProductsWithOffers(market, now, productIds);
  const current = new Map(
    entries.flatMap((entry) => {
      const summary = summarizeProduct(entry, market);
      return summary ? [[entry.product.id, { product: entry.product, best: summary.best }] as const] : [];
    }),
  );

  let notified = 0;
  let pushed = 0;
  const telegramDrops = new Map<string, { locale: Locale; drops: DropAlert[] }>();

  for (const { watch, locale, telegramChatId } of watches) {
    const now_ = current.get(watch.productId);
    // Out of stock everywhere: keep the old reference price and wait.
    if (!now_) continue;
    const price = now_.best.landed.totalMinor;
    if (price === watch.lastPriceMinor) continue;

    const dropped = isNotableDrop(watch.lastPriceMinor, price, market.alerts.minDropPct);
    await db
      .update(priceWatches)
      .set({ lastPriceMinor: price, ...(dropped ? { lastNotifiedAt: now } : {}) })
      .where(eq(priceWatches.id, watch.id));
    if (!dropped) continue;

    await db.insert(notifications).values({
      userId: watch.userId,
      type: "price_drop",
      productId: watch.productId,
      productTitle: now_.product.title,
      productSlug: now_.product.slug,
      supplierName: now_.best.supplier.name,
      oldPriceMinor: watch.lastPriceMinor,
      newPriceMinor: price,
      createdAt: now,
    });
    notified++;

    // Messages are written in the language the person registered in.
    const userLocale = isLocale(locale) ? locale : market.defaultLocale;
    const pct = dropPercent(watch.lastPriceMinor, price);
    const t = getDictionary(userLocale);
    const targets = await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, [watch.userId]));
    pushed += await sendPush(targets, {
      title: fmt(t.alerts.pushTitle, { pct }),
      body: fmt(t.alerts.pushBody, {
        title: now_.product.title,
        price: formatMoney(price, market.currency, userLocale),
        old: formatMoney(watch.lastPriceMinor, market.currency, userLocale),
        store: now_.best.supplier.name,
      }),
      url: localePath(userLocale, `/product/${now_.product.slug}`),
    });

    if (telegramChatId) {
      const entry = telegramDrops.get(telegramChatId) ?? { locale: userLocale, drops: [] };
      entry.drops.push({
        title: now_.product.title,
        slug: now_.product.slug,
        store: now_.best.supplier.name,
        oldPriceMinor: watch.lastPriceMinor,
        newPriceMinor: price,
        pct,
      });
      telegramDrops.set(telegramChatId, entry);
    }
  }

  let telegram = 0;
  if (telegramEnabled()) {
    for (const [chatId, { locale, drops }] of telegramDrops) {
      if (await sendDropAlerts(chatId, locale, market, drops)) telegram++;
      await new Promise((resolve) => setTimeout(resolve, TELEGRAM_GAP_MS));
    }
  }

  return { watches: watches.length, notified, pushed, telegram };
}
