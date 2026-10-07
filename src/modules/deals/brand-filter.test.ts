import { describe, expect, it, vi } from "vitest";
import type { ProductCardData } from "@/modules/catalog/card";
import { filterQuery, parseDealFilters } from "./filters";

vi.mock("@/db/client", () => ({ db: {} }));

const { facetsOfCards, filterCards } = await import("@/modules/search/catalog-search");

describe("brand filter", () => {
  it("reads several brands from the URL as lower-case keys", () => {
    const filters = parseDealFilters({ category: "shoes", brand: "ADIDAS,New Balance, adidas ,," });
    expect(filters.brands).toEqual(["adidas", "new balance"]);
    expect(parseDealFilters({}).brands).toBeUndefined();
  });

  it("keeps brands in links but drops them when the category changes", () => {
    const filters = parseDealFilters({ category: "shoes", brand: "adidas,puma" });
    expect(filterQuery(filters, true, { page: 2 })).toContain("brand=adidas%2Cpuma");
    expect(filterQuery(filters, true, { category: "watches" })).not.toContain("brand=");
  });

  const card = (brand: string | null, slug: string) =>
    ({ slug, brand, categorySlug: "shoes", subcategorySlug: "sneakers", audience: null, originCountry: "TR", landedMinor: 100 }) as ProductCardData;
  const cards = [card("ADIDAS", "a"), card("adidas", "b"), card("Puma", "c"), card(null, "d")];

  it("matches any ticked brand, whatever the store's spelling", () => {
    const shown = filterCards(cards, { brands: ["adidas", "nike"] });
    expect(shown.map((c) => c.slug)).toEqual(["a", "b"]);
  });

  it("counts brands under one name, most first", () => {
    expect(facetsOfCards(cards, "shoes").brands).toEqual([
      { key: "adidas", name: "ADIDAS", total: 2 },
      { key: "puma", name: "Puma", total: 1 },
    ]);
  });
});
