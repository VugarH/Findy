import { describe, expect, it } from "vitest";
import { priceParts } from "./price-parts";

describe("price parts", () => {
  it("splits the total into the item price and what is added", () => {
    expect(priceParts(4520, 3500)).toEqual({ itemMinor: 3500, extraMinor: 1020 });
  });

  it("shows nothing when nothing is added or the item price is unknown", () => {
    expect(priceParts(3500, 3500)).toBeNull();
    expect(priceParts(3500, null)).toBeNull();
    expect(priceParts(3500, undefined)).toBeNull();
  });
});
