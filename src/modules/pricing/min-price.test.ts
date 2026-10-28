import { describe, expect, it } from "vitest";
import { azMarket } from "@/config/markets/az";
import { belowMinItemPrice, minItemPriceMinor } from "./min-price";

describe("minimum item price", () => {
  it("uses the market's figure for each currency", () => {
    expect(minItemPriceMinor("TRY", azMarket)).toBe(30_000);
    expect(minItemPriceMinor("AZN", azMarket)).toBe(1_000);
    expect(minItemPriceMinor("EUR", azMarket)).toBe(1_000);
  });

  it("converts the fallback for other currencies", () => {
    // 10 USD = 17 AZN = 7.91 GBP at the fallback rates.
    expect(minItemPriceMinor("GBP", azMarket)).toBe(Math.round((1_000 * 1.7) / 2.15));
  });

  it("leaves out only items below the minimum", () => {
    expect(belowMinItemPrice({ priceMinor: 29_990, currency: "TRY" }, azMarket)).toBe(true);
    expect(belowMinItemPrice({ priceMinor: 30_000, currency: "TRY" }, azMarket)).toBe(false);
    expect(belowMinItemPrice({ priceMinor: 999, currency: "USD" }, azMarket)).toBe(true);
  });
});
