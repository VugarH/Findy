import type { MarketConfig } from "@/config/markets";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";
import { fmt } from "@/i18n/format";
import { sendMessage, TelegramError } from "@/modules/telegram/api";
import { telegramEnabled } from "@/modules/telegram/config";
import { messageContext } from "@/modules/telegram/context";
import { conversationNotice } from "@/modules/telegram/format";
import { disconnectChat } from "@/modules/telegram/link";
import { adminTelegramChats, userTelegramChat } from "./service";
import { log } from "@/modules/logs/logger";

/**
 * Telegram heads-ups about new messages, for people who connected the bot.
 * Optional and best effort: never throws, and without Telegram does nothing.
 */
async function send(chatId: string, html: string): Promise<void> {
  try {
    await sendMessage(chatId, html);
  } catch (error) {
    if (error instanceof TelegramError && error.chatGone) await disconnectChat(chatId);
    else await log.warn("telegram", "message-notice.failed", "A Telegram notice about a message could not be sent", { error });
  }
}

const localeOf = (value: string) => (isLocale(value) ? value : DEFAULT_LOCALE);

/** The team answered: tell the person. */
export async function notifyUserOfReply(
  conversation: { id: string; userId: string; subject: string },
  body: string,
  market: MarketConfig,
): Promise<void> {
  if (!telegramEnabled()) return;
  const chat = await userTelegramChat(conversation.userId);
  if (!chat) return;
  const ctx = messageContext(localeOf(chat.locale), market);
  await send(
    chat.chatId,
    conversationNotice(
      { heading: ctx.t.messages.telegramReply, subject: conversation.subject, body, path: `/messages/${conversation.id}` },
      ctx,
    ),
  );
}

/** A person wrote: tell the admins who connected Telegram. */
export async function notifyAdminsOfMessage(
  conversation: { id: string; subject: string },
  customerName: string,
  body: string,
  market: MarketConfig,
): Promise<void> {
  if (!telegramEnabled()) return;
  for (const chat of await adminTelegramChats()) {
    const ctx = messageContext(localeOf(chat.locale), market);
    await send(
      chat.chatId,
      conversationNotice(
        {
          heading: fmt(ctx.t.messages.telegramNew, { name: customerName }),
          subject: conversation.subject,
          body,
          path: `/admin/messages/${conversation.id}`,
        },
        ctx,
      ),
    );
  }
}
