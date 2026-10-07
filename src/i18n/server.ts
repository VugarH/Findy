import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import type { CurrencyCode } from "@/config/currencies";
import type { MarketConfig } from "@/config/markets";
import { loadMarket } from "@/modules/pricing/fx";
import { formatMoney } from "@/lib/money";
import { isLocale, type Locale } from "./config";
import { getDictionary, type Dictionary } from "./dictionaries";
import { localePath } from "./format";

export interface I18n {
  locale: Locale;
  t: Dictionary;
  market: MarketConfig;
  /** Formats minor units; defaults to the market currency. */
  money: (amountMinor: number, currency?: CurrencyCode) => string;
  /** Locale-prefixed href for an app path. */
  href: (path?: string) => string;
}

/** Locale, dictionary and market for the current request. Server Components only. */
export async function getI18n(): Promise<I18n> {
  const locale = await lang();
  if (!isLocale(locale)) notFound();
  const market = await loadMarket();
  return {
    locale,
    t: getDictionary(locale),
    market,
    money: (amountMinor, currency = market.currency) => formatMoney(amountMinor, currency, locale),
    href: (path) => localePath(locale, path),
  };
}
