import { describe, expect, it } from "vitest";
import type { OfferView } from "./offer-view";
import { storeDiscount } from "./summary";

const offer = (patch: Partial<OfferView>): OfferView =>
  ({
    priceMinor: 2_000,
    listPriceMinor: null,
    landed: { totalMinor: 10_000 },
    usualLandedMinor: null,
    listLandedMinor: null,
    verdict: null,
    ...patch,
  }) as OfferView;

describe("storeDiscount", () => {
  it("is the store's own discount on its price, with the total at its crossed-out price", () => {
    expect(storeDiscount(offer({ listPriceMinor: 4_000, listLandedMinor: 15_000 }))).toEqual({
      pct: 50,
      wasLandedMinor: 15_000,
      savingsMinor: 5_000,
    });
  });

  it("ignores our own usual price, even when the history disagrees", () => {
    const verdict = { historyDays: 60, realDiscountPct: 5 } as OfferView["verdict"];
    expect(storeDiscount(offer({ listPriceMinor: 4_000, listLandedMinor: 15_000, usualLandedMinor: 10_500, verdict }))?.pct).toBe(50);
  });

  it("is null when the store shows no discount", () => {
    expect(storeDiscount(offer({}))).toBeNull();
    expect(storeDiscount(offer({ listPriceMinor: 2_000, listLandedMinor: 10_000 }))).toBeNull();
  });
});
