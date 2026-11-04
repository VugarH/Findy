/**
 * The price as cards and product pages show it: the store's own price (in the
 * market currency) as the big number, with its crossed-out price and saving,
 * and below it what delivery, customs and fees add ("+ 10,20 ₼"). Falls back
 * to the total when the store's price is unknown. Pure and client-safe.
 * Sorting, price filters and comparing stores still use the total.
 */
export interface ShownPrice {
  mainMinor: number;
  /** The store's crossed-out price, when it shows one. */
  wasMinor: number | null;
  savingMinor: number | null;
  /** Delivery, customs and fees on top of mainMinor; null when nothing is added. */
  extraMinor: number | null;
}

export function shownPrice(price: {
  totalMinor: number;
  itemMinor?: number | null;
  usualItemMinor?: number | null;
  usualTotalMinor?: number | null;
}): ShownPrice {
  const { totalMinor, itemMinor, usualItemMinor, usualTotalMinor } = price;
  const known = itemMinor != null && itemMinor > 0 && itemMinor <= totalMinor;
  const mainMinor = known ? itemMinor : totalMinor;
  const was = known ? usualItemMinor : usualTotalMinor;
  const wasMinor = was != null && was > mainMinor ? was : null;
  return {
    mainMinor,
    wasMinor,
    savingMinor: wasMinor === null ? null : wasMinor - mainMinor,
    extraMinor: known && totalMinor > itemMinor ? totalMinor - itemMinor : null,
  };
}

/** The store's crossed-out price in the market currency, from its own two prices (same exchange rate as the item price). */
export function usualItemMinor(itemMinor: number, priceMinor: number, listPriceMinor: number | null): number | null {
  if (listPriceMinor === null || priceMinor <= 0 || listPriceMinor <= priceMinor) return null;
  return Math.round((itemMinor * listPriceMinor) / priceMinor);
}
