import { describe, expect, it } from "vitest";
import { isDay, marketDay, pickTopDeals, type DigestCandidate } from "./pick";

const deal = (productId: string, categorySlug: string, supplierName: string, verified = true): DigestCandidate => ({
  productId,
  categorySlug,
  supplierName,
  verified,
});

const rules = { size: 4, maxPerCategory: 2, maxPerStore: 2 };

describe("pickTopDeals", () => {
  it("keeps the list varied: no more than the cap per category and per store", () => {
    const candidates = [
      deal("a", "shoes", "Nike"),
      deal("b", "shoes", "Nike"),
      deal("c", "shoes", "Adidas"),
      deal("d", "beauty", "Nike"),
      deal("e", "beauty", "Flormar"),
      deal("f", "home", "Karaca"),
    ];
    expect(pickTopDeals(candidates, rules).map((c) => c.productId)).toEqual(["a", "b", "e", "f"]);
  });

  it("prefers verified discounts but keeps the ranking order", () => {
    const candidates = [deal("claim", "shoes", "A", false), deal("v1", "home", "B"), deal("v2", "beauty", "C")];
    expect(pickTopDeals(candidates, { ...rules, size: 2 }).map((c) => c.productId)).toEqual(["v1", "v2"]);
    expect(pickTopDeals(candidates, { ...rules, size: 3 }).map((c) => c.productId)).toEqual(["claim", "v1", "v2"]);
  });

  it("skips products picked recently unless there are too few others", () => {
    const candidates = [deal("old", "shoes", "A"), deal("new", "home", "B")];
    expect(pickTopDeals(candidates, { ...rules, size: 1 }, new Set(["old"])).map((c) => c.productId)).toEqual(["new"]);
    expect(pickTopDeals(candidates, rules, new Set(["old"])).map((c) => c.productId)).toEqual(["old", "new"]);
  });

  it("relaxes the caps rather than posting a short list", () => {
    const candidates = [deal("a", "shoes", "Nike"), deal("b", "shoes", "Nike"), deal("c", "shoes", "Nike")];
    expect(pickTopDeals(candidates, rules)).toHaveLength(3);
  });

  it("never picks a product twice", () => {
    expect(pickTopDeals([deal("a", "shoes", "Nike"), deal("a", "shoes", "Nike")], rules)).toHaveLength(1);
  });
});

describe("marketDay", () => {
  it("uses the market's time zone, not the server's", () => {
    // 21:30 UTC on 5 October is already 6 October in Baku (UTC+4).
    expect(marketDay(new Date("2026-10-05T21:30:00Z"), "Asia/Baku")).toBe("2026-10-06");
    expect(marketDay(new Date("2026-10-05T19:30:00Z"), "Asia/Baku")).toBe("2026-10-05");
  });

  it("recognises a day in the address", () => {
    expect(isDay("2026-10-06")).toBe(true);
    expect(isDay("2026-13-45")).toBe(false);
    expect(isDay("yesterday")).toBe(false);
    expect(isDay(undefined)).toBe(false);
  });
});
