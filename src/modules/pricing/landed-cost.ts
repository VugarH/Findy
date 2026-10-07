import type { CurrencyCode } from "@/config/currencies";
import type { MarketConfig } from "@/config/markets";
import { convertMinor, toMinor } from "@/lib/money";
import type { SupplierScope } from "@/modules/suppliers/types";

export interface LandedCostInput {
  priceMinor: number;
  currency: CurrencyCode;
  /** Shipping to the market in the offer currency; null = estimate via forwarder. */
  shippingMinor: number | null;
  weightKg: number;
  scope: SupplierScope;
  originCountry: string;
}

/** What the buyer really pays, in the market currency (minor units). */
export interface LandedCost {
  itemMinor: number;
  shippingMinor: number;
  dutyMinor: number;
  vatMinor: number;
  feeMinor: number;
  totalMinor: number;
  /** True when shipping is our forwarder estimate rather than the store's price. */
  shippingEstimated: boolean;
}

/**
 * The core promise of the product: item + shipping + customs + fees.
 * Pure function of the offer and the market rules, so it is trivially testable
 * and gives the same answer in the daily job, live search and the product page.
 */
export function computeLandedCost(input: LandedCostInput, market: MarketConfig): LandedCost {
  return computeParcelCost([{ input, quantity: 1 }], market);
}

/** One product in a parcel: its unit price inputs and how many. */
export interface ParcelLine {
  input: LandedCostInput;
  quantity: number;
}

/**
 * What several items from one store cost when ordered together and delivered
 * as one parcel. This is where combining pays off or does not:
 *   - one delivery charge: the forwarder bills the parcel's total weight (with
 *     its minimum charge once), and a store that ships itself charges once per order;
 *   - customs is assessed on the parcel's total value, so items that are each
 *     under the duty-free limit can cross it together.
 * All lines are assumed to come from the same store (same scope and origin).
 */
export function computeParcelCost(lines: ParcelLine[], market: MarketConfig): LandedCost {
  const rates = market.fxRates;
  const first = lines[0]?.input;
  if (!first) {
    return { itemMinor: 0, shippingMinor: 0, dutyMinor: 0, vatMinor: 0, feeMinor: 0, totalMinor: 0, shippingEstimated: false };
  }
  const itemMinor = lines.reduce(
    (sum, { input, quantity }) => sum + convertMinor(input.priceMinor * quantity, input.currency, market.currency, rates),
    0,
  );
  // A store's own delivery price is per order: the parcel pays the highest one once.
  const storeShippingMinor = () =>
    Math.max(...lines.map(({ input }) => convertMinor(input.shippingMinor ?? 0, input.currency, market.currency, rates)));

  if (first.scope === "local") {
    const shippingMinor = storeShippingMinor();
    return {
      itemMinor,
      shippingMinor,
      dutyMinor: 0,
      vatMinor: 0,
      feeMinor: 0,
      totalMinor: itemMinor + shippingMinor,
      shippingEstimated: false,
    };
  }

  const shippingEstimated = lines.some(({ input }) => input.shippingMinor === null);
  const weightKg = lines.reduce((sum, { input, quantity }) => sum + input.weightKg * quantity, 0);
  const shippingMinor = shippingEstimated
    ? estimateForwardingMinor(weightKg, first.originCountry, market)
    : storeShippingMinor();

  // Customs is assessed on goods + shipping above the duty-free threshold.
  const { dutyRate, vatRate } = market.customs;
  const excessMinor = Math.max(0, itemMinor + shippingMinor - dutyFreeLimitMinor(market));
  const dutyMinor = Math.round(excessMinor * dutyRate);
  const vatMinor = Math.round((excessMinor + dutyMinor) * vatRate);

  const paidAbroadMinor = itemMinor + (shippingEstimated ? 0 : shippingMinor);
  const feeMinor = Math.round(paidAbroadMinor * market.foreignPaymentFeeRate);

  return {
    itemMinor,
    shippingMinor,
    dutyMinor,
    vatMinor,
    feeMinor,
    totalMinor: itemMinor + shippingMinor + dutyMinor + vatMinor + feeMinor,
    shippingEstimated,
  };
}

/** The duty-free limit in the market currency (minor units). */
export function dutyFreeLimitMinor(market: MarketConfig): number {
  const { dutyFreeThreshold } = market.customs;
  return convertMinor(toMinor(dutyFreeThreshold.amount), dutyFreeThreshold.currency, market.currency, market.fxRates);
}

function estimateForwardingMinor(weightKg: number, originCountry: string, market: MarketConfig): number {
  const { forwarding } = market;
  const perKg = forwarding.perKgByOrigin[originCountry] ?? forwarding.defaultPerKg;
  const charge = Math.max(forwarding.minCharge, perKg * weightKg);
  return convertMinor(toMinor(charge), forwarding.currency, market.currency, market.fxRates);
}

export function resolveDeliveryDays(
  offer: { deliveryMinDays: number | null; deliveryMaxDays: number | null },
  originCountry: string,
  market: MarketConfig,
): { min: number; max: number } {
  if (offer.deliveryMinDays !== null && offer.deliveryMaxDays !== null) {
    return { min: offer.deliveryMinDays, max: offer.deliveryMaxDays };
  }
  return market.forwarding.deliveryDaysByOrigin[originCountry] ?? market.forwarding.defaultDeliveryDays;
}
