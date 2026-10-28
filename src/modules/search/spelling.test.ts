import { describe, expect, it } from "vitest";
import { bestCorrection, correctedQuery, typoDistance, wordsToCheck } from "./spelling";

describe("spelling fixes", () => {
  it("checks only real words long enough to judge", () => {
    expect(wordsToCheck("Adidsa S24 tv Çanta çanta")).toEqual(["adidsa", "canta"]);
  });

  it("counts a swap of two neighbouring letters as one typo", () => {
    expect(typoDistance("iphnoe", "iphone")).toBe(1);
    expect(typoDistance("nkie", "nike")).toBe(1);
    expect(typoDistance("samsng", "samsung")).toBe(1);
    expect(typoDistance("adidsa", "adidas")).toBe(1);
    expect(typoDistance("kitten", "sitting")).toBe(3);
  });

  it("picks the word with the fewest typos, the more common one among equals", () => {
    const candidates = [
      { folded: "nike", weight: 900 },
      { folded: "nice", weight: 30 },
      { folded: "nikon", weight: 50 },
    ];
    expect(bestCorrection("nkie", candidates)).toBe("nike");
    expect(bestCorrection("nikr", candidates)).toBe("nike");
    // Two typos are allowed only in long words.
    expect(bestCorrection("cerave", [{ folded: "create", weight: 80 }])).toBeNull();
    expect(bestCorrection("samsnug galxy", [{ folded: "samsung galaxy", weight: 80 }])).toBe("samsung galaxy");
  });

  it("leaves a word alone when nothing is close enough, or when it is already known", () => {
    expect(bestCorrection("xqzv", [{ folded: "xbox", weight: 10 }])).toBeNull();
    expect(
      bestCorrection("canta", [
        { folded: "canta", weight: 40 },
        { folded: "cantas", weight: 400 },
      ]),
    ).toBeNull();
  });

  it("rebuilds the query around the corrections, keeping the other words as typed", () => {
    expect(correctedQuery("Adidsa  krossovka", new Map([["adidsa", "adidas"]]))).toBe("adidas  krossovka");
    expect(correctedQuery("adidas", new Map())).toBeNull();
  });
});
