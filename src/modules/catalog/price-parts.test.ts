import { describe, expect, it } from "vitest";
import { shownPrice, usualItemMinor } from "./price-parts";

describe("shown price", () => {
  it("shows the store's price big, its own saving, and what is added", () => {
    expect(shownPrice({ totalMinor: 4520, itemMinor: 3500, usualItemMinor: 5000, usualTotalMinor: 6100 })).toEqual({
      mainMinor: 3500,
      wasMinor: 5000,
      savingMinor: 1500,
      extraMinor: 1020,
    });
  });

  it("adds nothing for a store whose price is the total", () => {
    expect(shownPrice({ totalMinor: 3500, itemMinor: 3500 })).toMatchObject({ mainMinor: 3500, extraMinor: null, wasMinor: null });
  });

  it("falls back to the total when the store's price is unknown", () => {
    expect(shownPrice({ totalMinor: 4520, usualTotalMinor: 6000 })).toEqual({ mainMinor: 4520, wasMinor: 6000, savingMinor: 1480, extraMinor: null });
  });

  it("converts the crossed-out price at the item's own rate", () => {
    expect(usualItemMinor(3500, 70000, 100000)).toBe(5000);
    expect(usualItemMinor(3500, 70000, null)).toBeNull();
    expect(usualItemMinor(3500, 70000, 70000)).toBeNull();
  });
});
