import { describe, expect, it } from "vitest";
import { azMarket } from "@/config/markets/az";
import type { OfferView, ProductWithOffers } from "./offer-view";
import { storeDiscount, summarizeProduct } from "./summary";

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

describe("summarizeProduct with a long history", () => {
  // The store says 40 → 20; for 30 days we have seen 20 every day: the "was" price is never charged.
  const standing = offer({
    priceMinor: 2_000,
    listPriceMinor: 4_000,
    listLandedMinor: 15_000,
    usualLandedMinor: 10_000,
    inStock: true,
    supplier: { id: "s", trustScore: 80 } as OfferView["supplier"],
    delivery: { min: 4, max: 8 },
    verdict: { historyDays: 30, realDiscountPct: 0, isLowest: false } as OfferView["verdict"],
  });
  const entry = { product: {}, offers: [standing] } as unknown as ProductWithOffers;

  it("keeps the store's discount, unverified and ranked lower, while the market keeps store claims", () => {
    const deal = summarizeProduct(entry, { ...azMarket, deals: { ...azMarket.deals, keepStoreClaims: true } })?.deal;
    expect(deal?.verified).toBe(false);
    expect(deal?.discountPct).toBe(33);
  });

  it("drops it when only our history counts", () => {
    expect(summarizeProduct(entry, { ...azMarket, deals: { ...azMarket.deals, keepStoreClaims: false } })?.deal).toBeNull();
  });

  it("prefers our history when it confirms a discount", () => {
    const confirmed = { ...standing, usualLandedMinor: 14_000, verdict: { ...standing.verdict!, realDiscountPct: 30 } };
    const deal = summarizeProduct({ ...entry, offers: [confirmed] }, azMarket)?.deal;
    expect(deal?.verified).toBe(true);
  });
});
