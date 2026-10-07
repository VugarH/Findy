import { siteUrl } from "@/config/site";
import type { MarketConfig } from "@/config/markets";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { localePath } from "@/i18n/format";
import { formatMoney } from "@/lib/money";
import type { MessageContext } from "./format";

/** What a message in one language needs: text, money formatting and links to the site. */
export function messageContext(locale: Locale, market: MarketConfig): MessageContext {
  const base = siteUrl();
  return {
    t: getDictionary(locale),
    money: (amountMinor) => formatMoney(amountMinor, market.currency, locale),
    url: (path) => base + localePath(locale, path),
  };
}

/** Telegram only accepts link buttons to public https addresses (not localhost). */
export const canLinkButton = (url: string): boolean => /^https:\/\/(?!localhost|127\.)/.test(url);
