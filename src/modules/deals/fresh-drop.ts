import type { MarketConfig } from "@/config/markets";
import type { OfferView, PricePoint } from "@/modules/catalog/offer-view";
import { computeLandedCost } from "@/modules/pricing/landed-cost";

/**
 * "Fresh real deals": a store-discounted item whose price, by our own daily
 * checks, fell within the last few days. Pure: the daily job, the product page
 * and the tests share it.
 */
export interface FreshDropRule {
  /** The drop must be against a price seen in this many days before the latest check. */
  windowDays: number;
  /** With no check inside the window, the latest one before it counts, if no older than this. */
  lookbackDays: number;
  /** At least this much cheaper than the price it is compared with. */
  minDropPct: number;
}

export interface FreshDrop {
  /** The price compared with: the highest we saw in the window (store currency). */
  fromMinor: number;
  /** The day we saw it (YYYY-MM-DD). */
  fromOn: string;
  dropPct: number;
}

/**
 * The drop of the latest price against the highest price we recorded in the
 * `windowDays` before it (plus the last check before the window, for days a
 * store was not read). A raise followed by a cut counts too: the price chart
 * on the product page shows the whole story. `history` is oldest first and
 * ends with the latest check.
 */
export function freshDrop(history: PricePoint[], rule: FreshDropRule): FreshDrop | null {
  if (history.length < 2) return null;
  const latest = history[history.length - 1];
  const windowStart = addDays(latest.date, -rule.windowDays);
  const lookbackStart = addDays(latest.date, -rule.lookbackDays);

  const earlier = history.slice(0, -1);
  const inWindow = earlier.filter((point) => point.date >= windowStart);
  const beforeWindow = earlier.filter((point) => point.date < windowStart && point.date >= lookbackStart).at(-1);
  const compared = beforeWindow ? [beforeWindow, ...inWindow] : inWindow;
  if (compared.length === 0) return null;

  // The highest price; on a tie, the latest day it was seen.
  const from = compared.reduce((high, point) => (point.priceMinor >= high.priceMinor ? point : high));
  const dropPct = ((from.priceMinor - latest.priceMinor) / from.priceMinor) * 100;
  return dropPct >= rule.minDropPct ? { fromMinor: from.priceMinor, fromOn: from.date, dropPct: Math.round(dropPct) } : null;
}

export interface OfferFreshDrop extends FreshDrop {
  /**
   * Replaces the store-price drop: the drop of the landed total, like every
   * other discount on the site, so it matches the crossed-out total.
   */
  dropPct: number;
  /** The landed total at the compared price, in the market currency. */
  fromLandedMinor: number;
  /** The store's own advertised discount, in whole percent. */
  storeDiscountPct: number;
}

/**
 * The fresh drop of an offer, if it has one. Only offers the store marks as
 * discounted are considered; our history then decides.
 */
export function offerFreshDrop(offer: OfferView, market: MarketConfig): OfferFreshDrop | null {
  if (!offer.inStock || offer.listPriceMinor === null || offer.listPriceMinor <= offer.priceMinor) return null;
  const drop = freshDrop(offer.history, market.deals.freshDrop);
  if (!drop) return null;
  const fromLandedMinor = computeLandedCost({ ...offer.costInput, priceMinor: drop.fromMinor }, market).totalMinor;
  if (fromLandedMinor <= offer.landed.totalMinor) return null;
  return {
    ...drop,
    dropPct: Math.round(((fromLandedMinor - offer.landed.totalMinor) / fromLandedMinor) * 100),
    fromLandedMinor,
    storeDiscountPct: Math.round(((offer.listPriceMinor - offer.priceMinor) / offer.listPriceMinor) * 100),
  };
}

function addDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
