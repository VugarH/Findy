import { describe, expect, it } from "vitest";
import { matchNewDeals, type FollowRef, type NewDeal } from "./match";

const day = (d: number) => new Date(Date.UTC(2026, 9, d, 8));

const deal = (productId: string, over: Partial<NewDeal> = {}): NewDeal => ({
  productId,
  title: productId,
  slug: productId,
  brandKey: "adidas",
  storeId: "superstep",
  storeName: "SuperStep",
  categorySlug: "shoes",
  landedMinor: 9_000,
  usualLandedMinor: 12_000,
  discountPct: 25,
  score: 50,
  dealSince: day(7),
  ...over,
});

const follow = (userId: string, kind: FollowRef["kind"], key: string, createdAt = day(1)): FollowRef => ({
  userId,
  kind,
  key,
  label: key,
  createdAt,
});

describe("matchNewDeals", () => {
  it("matches by brand, store and category", () => {
    const deals = [deal("a"), deal("b", { brandKey: "nike", storeId: "nike-tr", categorySlug: "fashion" })];
    const result = matchNewDeals(
      [follow("u1", "brand", "nike"), follow("u2", "store", "superstep"), follow("u3", "category", "fashion")],
      deals,
    );
    expect(result.get("u1")![0].deals.map((d) => d.productId)).toEqual(["b"]);
    expect(result.get("u2")![0].deals.map((d) => d.productId)).toEqual(["a"]);
    expect(result.get("u3")![0].deals.map((d) => d.productId)).toEqual(["b"]);
  });

  it("ignores deals that started before the person followed", () => {
    const result = matchNewDeals([follow("u1", "brand", "adidas", day(8))], [deal("a")]);
    expect(result.has("u1")).toBe(false);
  });

  it("sends the best deals first, within the limits, and each product once", () => {
    const deals = [deal("low", { score: 10 }), deal("high", { score: 90 }), deal("mid", { score: 50 })];
    const result = matchNewDeals(
      [follow("u1", "brand", "adidas"), follow("u1", "store", "superstep")],
      deals,
      { perFollow: 2, perPerson: 10 },
    );
    const groups = result.get("u1")!;
    expect(groups[0].deals.map((d) => d.productId)).toEqual(["high", "mid"]);
    expect(groups[1].deals.map((d) => d.productId)).toEqual(["low"]);
  });

  it("stops at the per-person limit", () => {
    const deals = Array.from({ length: 8 }, (_, i) => deal(`p${i}`));
    const result = matchNewDeals(
      [follow("u1", "brand", "adidas"), follow("u1", "category", "shoes")],
      deals,
      { perFollow: 5, perPerson: 6 },
    );
    expect(result.get("u1")!.flatMap((g) => g.deals)).toHaveLength(6);
  });

  it("sends colour variants of one product once", () => {
    const deals = [deal("red", { title: "Ultraboost 22", score: 60 }), deal("blue", { title: "Ultraboost 22 ", score: 70 })];
    const result = matchNewDeals([follow("u1", "brand", "adidas")], deals);
    expect(result.get("u1")![0].deals.map((d) => d.productId)).toEqual(["blue"]);
  });
});
