import { describe, expect, it } from "vitest";
import { azMarket } from "@/config/markets/az";
import type { OfferView } from "./offer-view";
import { priceBeforeDiscount } from "./summary";

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

describe("priceBeforeDiscount", () => {
  it("uses the store's crossed-out price while we have little history", () => {
    const result = priceBeforeDiscount(offer({ listPriceMinor: 4_000, listLandedMinor: 15_000 }), azMarket);
    expect(result).toEqual({ wasMinor: 15_000, discountPct: 33, verified: false });
  });

  it("uses our own usual price once the history is long enough, whatever the store claims", () => {
    const verdict = { historyDays: azMarket.deals.minHistoryDays, realDiscountPct: 20 } as OfferView["verdict"];
    const result = priceBeforeDiscount(offer({ listPriceMinor: 9_000, listLandedMinor: 40_000, usualLandedMinor: 12_500, verdict }), azMarket);
    expect(result).toEqual({ wasMinor: 12_500, discountPct: 20, verified: true });
  });

  it("shows nothing when the offer is not cheaper than before", () => {
    expect(priceBeforeDiscount(offer({}), azMarket)).toBeNull();
    const verdict = { historyDays: 30, realDiscountPct: -5 } as OfferView["verdict"];
    expect(priceBeforeDiscount(offer({ usualLandedMinor: 9_500, verdict }), azMarket)).toBeNull();
  });
});
