import type { MarketConfig } from "@/config/markets";
import { siteConfig } from "@/config/site";
import { isLocale, type Locale } from "@/i18n/config";
import { fmt } from "@/i18n/format";
import { sendMessage, type TelegramUpdate } from "./api";
import { channelUrl } from "./config";
import { messageContext } from "./context";
import { escapeHtml } from "./format";
import { accountOfChat, connectChat, disconnectChat } from "./link";

/**
 * What the bot does with a message. It only talks in private chats and only
 * knows a few commands: /start <token> connects an account, /stop disconnects.
 * Updates arrive through the webhook route or ./updates.ts.
 */

/** "/start abc" → { command: "start", payload: "abc" }; null for anything that is not a command. */
export function parseCommand(text: string | undefined): { command: string; payload: string } | null {
  const match = text?.trim().match(/^\/([a-z_]+)(?:@\w+)?(?:\s+(\S+))?/i);
  return match ? { command: match[1].toLowerCase(), payload: match[2] ?? "" } : null;
}

/** The language for a chat: the connected account's, else Telegram's app language, else the market's. */
function pickLocale(market: MarketConfig, ...candidates: (string | undefined)[]): Locale {
  for (const candidate of candidates) {
    const code = candidate?.slice(0, 2).toLowerCase();
    if (code && isLocale(code)) return code;
  }
  return market.defaultLocale;
}

export async function handleUpdate(update: TelegramUpdate, market: MarketConfig): Promise<void> {
  const membership = update.my_chat_member;
  if (membership) {
    // The person blocked the bot: stop sending them alerts.
    if (membership.chat.type === "private" && membership.new_chat_member.status === "kicked") {
      await disconnectChat(membership.chat.id);
    }
    return;
  }

  const message = update.message;
  if (!message || message.chat.type !== "private") return;
  const chatId = message.chat.id;
  const command = parseCommand(message.text);

  const reply = async (locale: Locale, write: (ctx: ReturnType<typeof messageContext>) => string) => {
    const ctx = messageContext(locale, market);
    const channel = channelUrl();
    const text = write(ctx) + (channel ? `\n\n${escapeHtml(fmt(ctx.t.telegram.channelLine, { url: channel }))}` : "");
    await sendMessage(chatId, text);
  };
  const site = { site: siteConfig.name };

  if (command?.command === "start" && command.payload) {
    const user = await connectChat(command.payload, { id: chatId, username: message.from?.username });
    if (user) {
      await reply(pickLocale(market, user.locale), ({ t }) => escapeHtml(fmt(t.telegram.linked, site)));
    } else {
      await reply(pickLocale(market, message.from?.language_code), ({ t, url }) =>
        escapeHtml(fmt(t.telegram.linkExpired, { url: url("/alerts") })),
      );
    }
    return;
  }

  if (command?.command === "stop") {
    const user = await disconnectChat(chatId);
    const locale = pickLocale(market, user?.locale, message.from?.language_code);
    await reply(locale, ({ t }) => escapeHtml(user ? t.telegram.stopped : t.telegram.notLinked));
    return;
  }

  const account = await accountOfChat(chatId);
  const locale = pickLocale(market, account?.locale, message.from?.language_code);
  await reply(locale, ({ t, url }) =>
    escapeHtml(
      fmt(account ? t.telegram.help : t.telegram.welcome, { ...site, url: url("/alerts") }),
    ),
  );
}
