import { botToken } from "./config";

/**
 * A minimal client for the Telegram Bot API (https://core.telegram.org/bots/api).
 * Only the calls and fields this site uses are typed.
 */

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
  username?: string;
}

export interface TelegramMessage {
  message_id: number;
  chat: TelegramChat;
  from?: TelegramUser;
  text?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  /** The bot's membership in a chat changed: "kicked" = the person blocked it. */
  my_chat_member?: { chat: TelegramChat; from: TelegramUser; new_chat_member: { status: string } };
}

export interface WebhookInfo {
  url: string;
  pending_update_count: number;
  last_error_message?: string;
}

export class TelegramError extends Error {
  constructor(
    readonly method: string,
    /** Telegram's error code (400, 403, 429…), or 0 when Telegram was not reached. */
    readonly code: number,
    description: string,
  ) {
    super(`Telegram ${method}: ${description}`);
    this.name = "TelegramError";
  }

  /** The person blocked the bot or deleted their account: stop writing to them. */
  get chatGone(): boolean {
    return this.code === 403 || /chat not found|user is deactivated/i.test(this.message);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function callTelegram<T>(
  method: string,
  params: Record<string, unknown> = {},
  { timeoutMs = 15_000 }: { timeoutMs?: number } = {},
): Promise<T> {
  const token = botToken();
  if (!token) throw new TelegramError(method, 0, "TELEGRAM_BOT_TOKEN is not set");

  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      // Never include the request URL: it contains the token.
      throw new TelegramError(method, 0, error instanceof Error ? error.message : "request failed");
    }
    const body = (await response.json().catch(() => null)) as {
      ok: boolean;
      result?: T;
      error_code?: number;
      description?: string;
      parameters?: { retry_after?: number };
    } | null;
    if (body?.ok) return body.result as T;

    // Telegram asks us to slow down: wait as long as it says, once.
    const retryAfter = body?.parameters?.retry_after;
    if (response.status === 429 && retryAfter !== undefined && retryAfter <= 30 && attempt === 0) {
      await sleep(retryAfter * 1000);
      continue;
    }
    throw new TelegramError(method, body?.error_code ?? response.status, body?.description ?? response.statusText);
  }
}

export interface SendOptions {
  /** One row of link buttons under the message. */
  buttons?: { text: string; url: string }[];
  /** A URL whose preview (e.g. a product photo) is shown above the text; previews are off otherwise. */
  previewUrl?: string;
}

/** Sends an HTML-formatted message (see ./format.ts). Returns its message id. */
export async function sendMessage(chatId: number | string, html: string, options: SendOptions = {}): Promise<number> {
  const message = await callTelegram<TelegramMessage>("sendMessage", {
    chat_id: chatId,
    text: html,
    parse_mode: "HTML",
    link_preview_options: options.previewUrl
      ? { url: options.previewUrl, prefer_large_media: true, show_above_text: true }
      : { is_disabled: true },
    ...(options.buttons?.length ? { reply_markup: { inline_keyboard: [options.buttons] } } : {}),
  });
  return message.message_id;
}

let me: Promise<TelegramUser> | undefined;

/** The bot's own account (its @username builds the start links). Asked once per process. */
export function getBot(): Promise<TelegramUser> {
  me ??= callTelegram<TelegramUser>("getMe").catch((error) => {
    me = undefined;
    throw error;
  });
  return me;
}
