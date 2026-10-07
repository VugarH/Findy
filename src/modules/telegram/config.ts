import type { MarketConfig } from "@/config/markets";
import { isLocale, type Locale } from "@/i18n/config";

/**
 * Telegram is optional: without a bot token the site works as before, and
 * the daily job skips the channel post and Telegram alerts. Server only.
 *
 *   TELEGRAM_BOT_TOKEN       from @BotFather
 *   TELEGRAM_CHANNEL_ID      "@channel_name" (or -100… for a private channel); the bot must be its admin
 *   TELEGRAM_CHANNEL_URL     public link, only needed when the channel id is numeric
 *   TELEGRAM_CHANNEL_LOCALE  language of the channel posts; the market's default otherwise
 *   TELEGRAM_WEBHOOK_SECRET  set when Telegram delivers messages to /api/telegram/webhook;
 *                            without it the site fetches them itself (see ./updates.ts)
 */

const env = (name: string): string | null => process.env[name]?.trim() || null;

export const botToken = () => env("TELEGRAM_BOT_TOKEN");

export const telegramEnabled = (): boolean => botToken() !== null;

export const channelId = (): string | null => (telegramEnabled() ? env("TELEGRAM_CHANNEL_ID") : null);

/** Where people can join the channel, or null for none / a private channel without an invite link. */
export function channelUrl(): string | null {
  const id = channelId();
  if (!id) return null;
  return env("TELEGRAM_CHANNEL_URL") ?? (id.startsWith("@") ? `https://t.me/${id.slice(1)}` : null);
}

export function channelLocale(market: MarketConfig): Locale {
  const value = env("TELEGRAM_CHANNEL_LOCALE");
  return value && isLocale(value) ? value : market.defaultLocale;
}

export const webhookSecret = () => env("TELEGRAM_WEBHOOK_SECRET");

/** With a webhook Telegram pushes messages to us; otherwise we ask for them (getUpdates). */
export const usesWebhook = (): boolean => webhookSecret() !== null;
