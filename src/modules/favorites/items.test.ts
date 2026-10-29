import { describe, expect, it } from "vitest";
import { FAVORITES_LIMIT, sanitizeFavorites } from "./items";

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

describe("favorites", () => {
  it("keeps only valid product ids, once each, within the limit", () => {
    expect(sanitizeFavorites(null)).toEqual([]);
    expect(sanitizeFavorites([id(1), "nope", 7, id(1).toUpperCase(), id(2)])).toEqual([id(1), id(2)]);
    expect(sanitizeFavorites(Array.from({ length: 150 }, (_, i) => id(i)))).toHaveLength(FAVORITES_LIMIT);
  });
});
