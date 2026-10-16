import { CURRENCIES, type CurrencyCode } from "@/config/currencies";
import type { Locale } from "@/i18n/config";
import { formatNumber } from "@/i18n/format";

/**
 * All amounts in the system are integers in minor units (qəpik, cents).
 * `rates` maps a currency to how many units of the market currency it buys.
 */
export function convertMinor(
  amountMinor: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: Record<CurrencyCode, number>,
): number {
  if (from === to) return amountMinor;
  return Math.round((amountMinor * rates[from]) / rates[to]);
}

export function toMinor(amount: number): number {
  return Math.round(amount * 100);
}

export function formatMoney(amountMinor: number, currency: CurrencyCode, locale: Locale): string {
  const whole = amountMinor % 100 === 0;
  // Not Intl: browsers lack full Azerbaijani data, and server and browser must agree.
  const number = formatNumber(amountMinor / 100, locale, { minFraction: whole ? 0 : 2, maxFraction: 2 });
  const { symbol, symbolFirst } = CURRENCIES[currency];
  return symbolFirst ? `${symbol}${number}` : `${number}\u00a0${symbol}`;
}
