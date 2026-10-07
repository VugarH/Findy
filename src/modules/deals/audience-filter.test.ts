import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));

const { filterQuery, parseDealFilters } = await import("./filters");

describe("audience (\"For\") filter in the URL", () => {
  it("applies only in clothing and shoes, where titles say who a product is for", () => {
    expect(parseDealFilters({ for: "women" }, "fashion").audience).toBe("women");
    expect(parseDealFilters({ category: "shoes", for: "kids" }).audience).toBe("kids");
    expect(parseDealFilters({ for: "women" }, "bags").audience).toBeUndefined();
    expect(parseDealFilters({ for: "women" }).audience).toBeUndefined();
  });

  it("drops the audience when the category changes", () => {
    const current = parseDealFilters({ category: "shoes", for: "men" });
    expect(filterQuery(current, true, { category: "bags" })).toBe("?category=bags");
    expect(filterQuery(current, true, { category: "fashion" })).toBe("?category=fashion");
  });
});
