import { describe, expect, it } from "vitest";
import { dropPercent, isNotableDrop } from "./detect";

describe("isNotableDrop", () => {
  it("notifies on a real drop", () => {
    expect(isNotableDrop(10_000, 9_000, 2)).toBe(true);
    expect(isNotableDrop(10_000, 9_800, 2)).toBe(true);
  });

  it("ignores rises, no change and drops below the threshold", () => {
    expect(isNotableDrop(10_000, 10_500, 2)).toBe(false);
    expect(isNotableDrop(10_000, 10_000, 2)).toBe(false);
    expect(isNotableDrop(10_000, 9_900, 2)).toBe(false);
    expect(isNotableDrop(0, 9_000, 2)).toBe(false);
  });

  it("rounds the percentage for display", () => {
    expect(dropPercent(10_000, 8_450)).toBe(16);
  });
});
