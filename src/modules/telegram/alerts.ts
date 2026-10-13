import type { MarketConfig } from "@/config/markets";
import type { Locale } from "@/i18n/config";
import { sendMessage, TelegramError } from "./api";
import { messageContext } from "./context";
import { dropAlertMessage, type DropAlert } from "./format";
import { disconnectChat } from "./link";
import { log } from "@/modules/logs/logger";

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
    else await log.warn("telegram", "alert.failed", "A price-drop alert could not be sent on Telegram", { error });
    return false;
  }
}
