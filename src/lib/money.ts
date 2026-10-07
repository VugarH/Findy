import { CURRENCIES, type CurrencyCode } from "@/config/currencies";
import { LOCALE_TAGS, type Locale } from "@/i18n/config";

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
  const number = new Intl.NumberFormat(LOCALE_TAGS[locale], {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
  const { symbol, symbolFirst } = CURRENCIES[currency];
  return symbolFirst ? `${symbol}${number}` : `${number}\u00a0${symbol}`;
}
