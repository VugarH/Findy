import type { DailyDigest } from "@/db/schema";
import type { MarketConfig } from "@/config/markets";
import { formatDay } from "@/modules/digest/pick";
import { markDigestFailed, markDigestPosted } from "@/modules/digest/service";
import { sendMessage } from "./api";
import { channelId, channelLocale } from "./config";
import { canLinkButton, messageContext } from "./context";
import { digestPost, type DigestPost } from "./format";

/** The daily post in the Telegram channel: the day's top deals (modules/digest). */

export function digestMessage(digest: DailyDigest, market: MarketConfig): DigestPost {
  const locale = channelLocale(market);
  return digestPost(
    digest.items,
    { key: digest.day, label: formatDay(digest.day, locale, { day: "numeric", month: "long", weekday: "long" }) },
    messageContext(locale, market),
  );
}

export type PostResult =
  | { status: "posted"; messageId: number }
  /** Already posted earlier; not repeated unless forced. */
  | { status: "already" }
  /** No channel configured. */
  | { status: "off" }
  | { status: "failed"; error: string };

/** Posts a digest to the channel, once per day unless `force` (the admin's "Post again"). */
export async function postDigest(
  digest: DailyDigest,
  market: MarketConfig,
  { force = false }: { force?: boolean } = {},
): Promise<PostResult> {
  const channel = channelId();
  if (!channel) return { status: "off" };
  if (digest.telegramPostedAt && !force) return { status: "already" };

  try {
    const post = digestMessage(digest, market);
    const messageId = await sendMessage(channel, post.html, {
      previewUrl: post.previewUrl,
      buttons: canLinkButton(post.button.url) ? [post.button] : [],
    });
    await markDigestPosted(digest.id, messageId);
    return { status: "posted", messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markDigestFailed(digest.id, message);
    return { status: "failed", error: message };
  }
}
