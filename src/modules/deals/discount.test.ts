import { describe, expect, it } from "vitest";
import { verifyDiscount } from "./discount";
import { scoreDeal } from "./scoring";

describe("verifyDiscount", () => {
  it("measures the discount against the usual (median) price", () => {
    const verdict = verifyDiscount(8_000, [10_000, 10_000, 9_900, 10_100, 10_000])!;
    expect(verdict.usualMinor).toBe(10_000);
    expect(verdict.realDiscountPct).toBe(20);
    expect(verdict.isLowest).toBe(true);
  });

  it("flags a crossed-out price the history does not support", () => {
    // Store claims "was 145, now 100" but it has cost ~100 all along.
    const verdict = verifyDiscount(10_000, [10_000, 10_100, 9_900], 14_500)!;
    expect(verdict.realDiscountPct).toBe(0);
    expect(verdict.claimedDiscountPct).toBe(31);
    expect(verdict.inflatedClaim).toBe(true);
  });

  it("accepts an honest claim", () => {
    const verdict = verifyDiscount(8_000, [10_000, 10_000, 10_000], 10_000)!;
    expect(verdict.inflatedClaim).toBe(false);
  });

  it("returns null without history", () => {
    expect(verifyDiscount(8_000, [])).toBeNull();
  });
});

describe("scoreDeal", () => {
  it("ranks a deeper, verified discount higher", () => {
    const base = { vsNextBestPct: 5, trustScore: 85, deliveryMaxDays: 2, isLowest: false };
    expect(scoreDeal({ ...base, realDiscountPct: 30 })).toBeGreaterThan(scoreDeal({ ...base, realDiscountPct: 10 }));
  });

  it("stays within 0–100", () => {
    const score = scoreDeal({ realDiscountPct: 90, vsNextBestPct: 90, trustScore: 100, deliveryMaxDays: 1, isLowest: true });
    expect(score).toBe(100);
  });
});
