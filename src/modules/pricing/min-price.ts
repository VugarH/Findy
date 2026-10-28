import { isCurrencyCode } from "@/config/currencies";
import type { MarketConfig } from "@/config/markets";
import { convertMinor, toMinor } from "@/lib/money";

/**
 * The cheapest item price we collect, in the offer's own currency (minor
 * units): the market's figure for that currency, else the equivalent of its
 * `otherwise` amount. Pure, so the daily job and tests share it.
 */
export function minItemPriceMinor(currency: string, market: Pick<MarketConfig, "deals" | "fxRates">): number {
  const { byCurrency, otherwise } = market.deals.minItemPrice;
  if (!isCurrencyCode(currency)) return 0;
  const own = byCurrency[currency];
  if (own !== undefined) return toMinor(own);
  return convertMinor(toMinor(otherwise.amount), otherwise.currency, currency, market.fxRates);
}

/** Whether an item is cheap enough to leave out (its delivery would cost more than it does). */
export function belowMinItemPrice(offer: { priceMinor: number; currency: string }, market: Pick<MarketConfig, "deals" | "fxRates">): boolean {
  return offer.priceMinor < minItemPriceMinor(offer.currency, market);
}
