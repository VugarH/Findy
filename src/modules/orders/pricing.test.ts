import { describe, expect, it } from "vitest";
import { azMarket } from "@/config/markets/az";
import type { MarketConfig } from "@/config/markets";
import { estimateAssistedOrder } from "./pricing";

const market: MarketConfig = { ...azMarket, assistedOrder: { enabled: true, feeRate: 0.1, minFee: 5, maxQuantity: 5 } };
const unit = { priceMinor: 10_000, currency: "USD" as const, shippingMinor: 0, weightKg: 0.5, scope: "global" as const, originCountry: "US" };

describe("estimateAssistedOrder", () => {
  it("adds the service fee to the landed total", () => {
    const estimate = estimateAssistedOrder(unit, market, 1);
    // $100 = 170 AZN, no customs, 1% card fee = 171.70; fee 10% = 17.17
    expect(estimate.landed.totalMinor).toBe(17_170);
    expect(estimate.feeMinor).toBe(1_717);
    expect(estimate.totalMinor).toBe(18_887);
  });

  it("never charges less than the minimum fee", () => {
    const cheap = estimateAssistedOrder({ ...unit, priceMinor: 1_000 }, market, 1);
    expect(cheap.feeMinor).toBe(500);
  });

  it("prices several items as one parcel, so customs can start to apply", () => {
    const one = estimateAssistedOrder({ ...unit, priceMinor: 20_000 }, market, 1);
    const two = estimateAssistedOrder({ ...unit, priceMinor: 20_000 }, market, 2);
    expect(one.landed.dutyMinor).toBe(0); // $200 is under the $300 limit
    expect(two.landed.dutyMinor).toBeGreaterThan(0); // $400 is over it
    expect(two.totalMinor).toBeGreaterThan(one.totalMinor * 2);
  });

  it("clamps the quantity to the allowed range", () => {
    expect(estimateAssistedOrder(unit, market, 0).quantity).toBe(1);
    expect(estimateAssistedOrder(unit, market, 99).quantity).toBe(5);
    expect(estimateAssistedOrder(unit, market, Number.NaN).quantity).toBe(1);
  });
});
