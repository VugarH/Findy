import { describe, expect, it } from "vitest";
import { azMarket } from "@/config/markets/az";
import { computeLandedCost } from "./landed-cost";

describe("computeLandedCost (AZ market)", () => {
  it("adds only local delivery for a local store", () => {
    const cost = computeLandedCost(
      { priceMinor: 100_000, currency: "AZN", shippingMinor: 500, weightKg: 1, scope: "local", originCountry: "AZ" },
      azMarket,
    );
    expect(cost).toMatchObject({ itemMinor: 100_000, shippingMinor: 500, dutyMinor: 0, vatMinor: 0, feeMinor: 0 });
    expect(cost.totalMinor).toBe(100_500);
  });

  it("charges no customs below the duty-free threshold", () => {
    // $100 item + $10 shipping = $110, under the $300 threshold.
    const cost = computeLandedCost(
      { priceMinor: 10_000, currency: "USD", shippingMinor: 1_000, weightKg: 1, scope: "global", originCountry: "US" },
      azMarket,
    );
    expect(cost.itemMinor).toBe(17_000);
    expect(cost.shippingMinor).toBe(1_700);
    expect(cost.dutyMinor).toBe(0);
    expect(cost.vatMinor).toBe(0);
    expect(cost.feeMinor).toBe(187); // 1% of 187.00 AZN paid abroad
    expect(cost.totalMinor).toBe(18_887);
  });

  it("charges duty and VAT only on the value above the threshold", () => {
    // $400 with free shipping: $100 over the threshold = 170 AZN excess.
    const cost = computeLandedCost(
      { priceMinor: 40_000, currency: "USD", shippingMinor: 0, weightKg: 1, scope: "global", originCountry: "US" },
      azMarket,
    );
    expect(cost.dutyMinor).toBe(2_550); // 15% of 170.00
    expect(cost.vatMinor).toBe(3_519); // 18% of (170.00 + 25.50)
  });

  it("estimates forwarder shipping by weight when the store does not ship directly", () => {
    const cost = computeLandedCost(
      { priceMinor: 5_000, currency: "USD", shippingMinor: null, weightKg: 2, scope: "global", originCountry: "US" },
      azMarket,
    );
    expect(cost.shippingEstimated).toBe(true);
    expect(cost.shippingMinor).toBe(2_210); // 2 kg × $6.50 × 1.7
    expect(cost.feeMinor).toBe(85); // fee only on what is paid to the store
  });
});
