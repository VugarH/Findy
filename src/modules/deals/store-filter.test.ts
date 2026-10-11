import { describe, expect, it, vi } from "vitest";
import type { ProductCardData } from "@/modules/catalog/card";

vi.mock("@/db/client", () => ({ db: {} }));

const { filterQuery, parseDealFilters } = await import("./filters");
const { facetsOfCards, filterCards } = await import("@/modules/search/catalog-search");

const card = (slug: string, supplierId: string, supplierName: string) =>
  ({ slug, supplierId, supplierName, brand: null, categorySlug: "beauty", originCountry: "GB", landedMinor: 100, sizes: null }) as ProductCardData;

describe("store filter", () => {
  it("reads store ids from the URL, dropping junk", () => {
    expect(parseDealFilters({ store: "allbeauty,Boyner,,bad id,allbeauty" }).stores).toEqual(["allbeauty", "boyner"]);
    expect(parseDealFilters({}).stores).toBeUndefined();
  });

  it("keeps the stores when the category changes", () => {
    const filters = parseDealFilters({ store: "allbeauty", brand: "nike" });
    const query = filterQuery(filters, true, { category: "beauty" });
    expect(query).toContain("store=allbeauty");
    expect(query).not.toContain("brand=");
  });

  it("filters search results and counts them per store", () => {
    const cards = [card("a", "allbeauty", "allbeauty"), card("b", "allbeauty", "allbeauty"), card("c", "gratis", "Gratis")];
    expect(filterCards(cards, { stores: ["gratis"] }).map((c) => c.slug)).toEqual(["c"]);
    expect(facetsOfCards(cards).stores).toEqual([
      { key: "allbeauty", name: "allbeauty", total: 2 },
      { key: "gratis", name: "Gratis", total: 1 },
    ]);
  });

  it("narrows the other lists to the ticked stores, but not the store list", () => {
    const shoe = { ...card("d", "superstep", "SuperStep"), categorySlug: "shoes" } as ProductCardData;
    const facets = facetsOfCards([card("a", "allbeauty", "allbeauty"), shoe], undefined, ["superstep"]);
    expect(facets.categories).toEqual({ shoes: 1 });
    expect(facets.stores.map((store) => store.key)).toEqual(["allbeauty", "superstep"]);
  });
});
