import type { DailyDigest } from "@/db/schema";
import type { MarketConfig } from "@/config/markets";
import { marketDay } from "@/modules/digest/pick";
import { listDigests } from "@/modules/digest/service";
import { callTelegram, getBot, type TelegramChat } from "@/modules/telegram/api";
import { digestMessage } from "@/modules/telegram/channel";
import { channelId, channelUrl, telegramEnabled, usesWebhook } from "@/modules/telegram/config";
import { countConnectedUsers } from "@/modules/telegram/link";

/** What the admin panel's Telegram page shows: the setup's health and the daily lists. */

export type Check<T> = { ok: true; value: T } | { ok: false; error: string };

async function check<T>(run: () => Promise<T>): Promise<Check<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export interface TelegramOverview {
  enabled: boolean;
  bot: Check<string> | null;
  channel: { id: string; url: string | null; title: Check<string> } | null;
  webhook: boolean;
  connected: number;
  today: DailyDigest | null;
  /** Today's channel post as it is (or would be) sent; HTML with every value escaped (modules/telegram/format.ts). */
  preview: string | null;
  earlier: DailyDigest[];
}

export async function telegramOverview(market: MarketConfig): Promise<TelegramOverview> {
  const day = marketDay(new Date(), market.timeZone);
  const enabled = telegramEnabled();
  const id = channelId();
  const [bot, title, connected, digests] = await Promise.all([
    enabled ? check(async () => `@${(await getBot()).username}`) : null,
    id ? check(async () => (await callTelegram<TelegramChat>("getChat", { chat_id: id })).title ?? id) : null,
    countConnectedUsers(),
    listDigests(market.code, 15),
  ]);
  const today = digests[0]?.day === day ? digests[0] : null;
  return {
    enabled,
    bot,
    channel: id && title ? { id, url: channelUrl(), title } : null,
    webhook: usesWebhook(),
    connected,
    today,
    preview: today ? digestMessage(today, market).html : null,
    earlier: digests.filter((digest) => digest.id !== today?.id),
  };
}
