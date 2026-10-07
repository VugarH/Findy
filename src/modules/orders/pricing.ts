import type { MarketConfig } from "@/config/markets";
import { toMinor } from "@/lib/money";
import { computeLandedCost, type LandedCost, type LandedCostInput } from "@/modules/pricing/landed-cost";

export interface AssistedOrderEstimate {
  quantity: number;
  /** Item, delivery, customs and card fees for the whole quantity. */
  landed: LandedCost;
  /** Our service fee. */
  feeMinor: number;
  totalMinor: number;
}

/**
 * What an assisted order is expected to cost. Pure, so the request form can
 * update the numbers as the quantity changes and the server can recompute the
 * same figures when the request is saved.
 *
 * The quantity is priced as one parcel, because customs looks at the parcel's
 * total value: two items can cross the duty-free limit when one does not.
 */
export function estimateAssistedOrder(
  unit: LandedCostInput,
  market: MarketConfig,
  quantity: number,
): AssistedOrderEstimate {
  const { feeRate, minFee, maxQuantity } = market.assistedOrder;
  const count = Math.min(Math.max(1, Math.floor(quantity) || 1), maxQuantity);

  const landed = computeLandedCost(
    {
      ...unit,
      priceMinor: unit.priceMinor * count,
      shippingMinor: unit.shippingMinor === null ? null : unit.shippingMinor * count,
      weightKg: unit.weightKg * count,
    },
    market,
  );
  const feeMinor = Math.max(toMinor(minFee), Math.round(landed.totalMinor * feeRate));
  return { quantity: count, landed, feeMinor, totalMinor: landed.totalMinor + feeMinor };
}
