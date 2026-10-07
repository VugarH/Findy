import type { MarketConfig } from "@/config/markets";
import type { Locale } from "@/i18n/config";
import { sendMessage, TelegramError } from "./api";
import { messageContext } from "./context";
import { dropAlertMessage, type DropAlert } from "./format";
import { disconnectChat } from "./link";

/**
 * Sends one person their price drops from a daily run, in one message.
 * Never throws: a failed Telegram message must not stop the other alerts.
 * A chat that blocked the bot is disconnected.
 */
export async function sendDropAlerts(
  chatId: string,
  locale: Locale,
  market: MarketConfig,
  drops: DropAlert[],
): Promise<boolean> {
  if (drops.length === 0) return false;
  try {
    await sendMessage(chatId, dropAlertMessage(drops, messageContext(locale, market)));
    return true;
  } catch (error) {
    if (error instanceof TelegramError && error.chatGone) await disconnectChat(chatId);
    else console.error("Telegram alert failed", error instanceof Error ? error.message : error);
    return false;
  }
}
