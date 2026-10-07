import { describe, expect, it, vi } from "vitest";
import type { ProductCardData } from "@/modules/catalog/card";

vi.mock("@/db/client", () => ({ db: {} }));

const { parseSearchSort, sortCards } = await import("./catalog-search");

const card = (slug: string, addedAt: string, landedMinor = 100): ProductCardData =>
  ({ slug, addedAt, landedMinor, discountPct: null }) as ProductCardData;

describe("search sorting by date added", () => {
  const cards = [
    card("middle", "2026-09-30T13:00:00.000Z"),
    card("newest", "2026-09-30T16:00:00.000Z"),
    card("oldest", "2026-09-30T11:00:00.000Z"),
  ];

  it("puts the most recently added first", () => {
    expect(sortCards(cards, "newest").map((c) => c.slug)).toEqual(["newest", "middle", "oldest"]);
  });

  it("puts the least recently added first", () => {
    expect(sortCards(cards, "oldest").map((c) => c.slug)).toEqual(["oldest", "middle", "newest"]);
  });

  it("keeps the existing order for products added at the same moment", () => {
    const tied = [card("a", "2026-09-30T13:00:00.000Z"), card("b", "2026-09-30T13:00:00.000Z")];
    expect(sortCards(tied, "newest").map((c) => c.slug)).toEqual(["a", "b"]);
  });

  it("accepts the new options from the URL", () => {
    expect(parseSearchSort("newest")).toBe("newest");
    expect(parseSearchSort("oldest")).toBe("oldest");
    expect(parseSearchSort("nonsense")).toBe("relevance");
  });
});
