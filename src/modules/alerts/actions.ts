"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/modules/auth/session";
import { loadMarket } from "@/modules/pricing/fx";
import { telegramEnabled } from "@/modules/telegram/config";
import { telegramLinkOf } from "@/modules/telegram/link";
import { dropPercent } from "./detect";
import {
  listNotifications,
  markNotificationsRead,
  removePushSubscription,
  savePushSubscription,
  toggleWatch,
} from "./service";

export type WatchActionResult =
  | { watched: boolean }
  | { error: "signIn" | "notFound" | "unavailable" | "limit" };

export async function toggleWatchAction(productId: string): Promise<WatchActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "signIn" };
  if (!z.uuid().safeParse(productId).success) return { error: "notFound" };

  const result = await toggleWatch(user.id, productId, await loadMarket());
  revalidatePath("/[lang]/alerts", "page");
  return result;
}

/** A notification as the header's bell shows it. */
export interface FeedItem {
  id: string;
  type: "price_drop" | "new_deal";
  /** new_deal: the brand, store or category it came from. */
  followLabel: string | null;
  title: string;
  slug: string;
  store: string;
  pct: number;
  oldPriceMinor: number;
  newPriceMinor: number;
  /** ISO time. */
  createdAt: string;
  unread: boolean;
}

export interface NotificationFeed {
  items: FeedItem[];
  /** Offer "Get alerts in Telegram" when the bot is set up and this person has not connected it. */
  suggestTelegram: boolean;
}

/** The bell's list: the latest notifications. Null when signed out. */
export async function notificationFeedAction(): Promise<NotificationFeed | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const [rows, link] = await Promise.all([
    listNotifications(user.id, 8),
    telegramEnabled() ? telegramLinkOf(user.id) : null,
  ]);
  return {
    items: rows.map((row) => ({
      id: row.id,
      type: row.type,
      followLabel: row.followLabel,
      title: row.productTitle,
      slug: row.productSlug,
      store: row.supplierName,
      pct: dropPercent(row.oldPriceMinor, row.newPriceMinor),
      oldPriceMinor: row.oldPriceMinor,
      newPriceMinor: row.newPriceMinor,
      createdAt: row.createdAt.toISOString(),
      unread: row.readAt === null,
    })),
    suggestTelegram: telegramEnabled() && link === null,
  };
}

export async function markNotificationsReadAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  // No revalidation: the page being read keeps its "new" highlights, and the
  // header badge clears on the next navigation.
  await markNotificationsRead(user.id);
}

const subscriptionSchema = z.object({
  endpoint: z.url().max(2000).startsWith("https://"),
  p256dh: z.string().min(1).max(300),
  auth: z.string().min(1).max(100),
});

export async function savePushSubscriptionAction(subscription: unknown): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  const parsed = subscriptionSchema.safeParse(subscription);
  if (!user || !parsed.success) return { ok: false };
  await savePushSubscription(user.id, parsed.data);
  return { ok: true };
}

export async function removePushSubscriptionAction(endpoint: string): Promise<void> {
  const user = await getCurrentUser();
  if (user && typeof endpoint === "string") await removePushSubscription(user.id, endpoint);
}
