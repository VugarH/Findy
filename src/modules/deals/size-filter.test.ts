import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));

const { filterQuery, parseDealFilters } = await import("./filters");
const { sizeFacets } = await import("./queries");

describe("size filter in the URL", () => {
  it("reads sizes in one spelling, only in a category sold by size", () => {
    // Keys use a point for half sizes, so a comma always separates sizes.
    expect(parseDealFilters({ sizes: "42.5,m,42.5" }, "shoes").sizes).toEqual(["42.5", "M"]);
    expect(parseDealFilters({ sizes: "M" }, "electronics").sizes).toBeUndefined();
    expect(parseDealFilters({ sizes: "M" }).sizes).toBeUndefined();
  });

  it("drops the sizes when the category changes", () => {
    const current = parseDealFilters({ category: "shoes", sizes: "42" });
    expect(filterQuery(current, true, { category: "fashion" })).toBe("?category=fashion");
    expect(filterQuery(current, true, { sort: "discount" })).toBe("?category=shoes&sizes=42&sort=discount");
  });
});

describe("sizeFacets", () => {
  it("lists sizes in size order", () => {
    expect(sizeFacets([{ key: "L", total: 3 }, { key: "S", total: 9 }, { key: "M", total: 5 }]).map((s) => s.key)).toEqual(["S", "M", "L"]);
  });
});

describe("filters switched off in the admin panel", () => {
  it("ignores their URL parameters", async () => {
    const { DEFAULT_FILTER_SWITCHES } = await import("@/modules/settings/filter-switches");
    const params = { sizes: "42", brand: "adidas", min: "50", category: "shoes" };
    const parsed = parseDealFilters(params, undefined, { ...DEFAULT_FILTER_SWITCHES, brand: false });
    expect(parsed.sizes).toBeUndefined(); // sizes start switched off
    expect(parsed.brands).toBeUndefined();
    expect(parsed.priceMin).toBe(50);
    expect(parsed.category).toBe("shoes");
  });

  it("keeps a category page's own category even with the category filter off", async () => {
    const { DEFAULT_FILTER_SWITCHES } = await import("@/modules/settings/filter-switches");
    const off = { ...DEFAULT_FILTER_SWITCHES, category: false, sizes: true };
    expect(parseDealFilters({}, "shoes", off).category).toBe("shoes");
    expect(parseDealFilters({ category: "shoes" }, undefined, off).category).toBeUndefined();
    expect(parseDealFilters({ sizes: "42" }, "shoes", off).sizes).toEqual(["42"]);
  });

  it("reads stored switches safely", async () => {
    const { toFilterSwitches, DEFAULT_FILTER_SWITCHES } = await import("@/modules/settings/filter-switches");
    expect(toFilterSwitches(null)).toEqual(DEFAULT_FILTER_SWITCHES);
    expect(toFilterSwitches({ sizes: true, brand: "yes", unknown: false })).toEqual({ ...DEFAULT_FILTER_SWITCHES, sizes: true });
  });
});
