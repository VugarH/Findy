import { describe, expect, it } from "vitest";
import { orderedBrands, orderedCategorySlugs, orderedSubcategories, sortByOrder, toDisplayOrder } from "./display-order";

describe("toDisplayOrder", () => {
  it("drops unknown, repeated and misplaced entries", () => {
    const order = toDisplayOrder({
      categories: ["beauty", "nope", "beauty", "shoes"],
      subcategories: { shoes: ["sneakers", "lipstick", "sneakers"], nope: ["x"] },
      brands: [" Adidas", "adidas", "", "Nike"],
    });
    expect(order.categories).toEqual(["beauty", "shoes"]);
    expect(order.subcategories).toEqual({ shoes: ["sneakers"] });
    expect(order.brands).toEqual(["adidas", "nike"]);
  });

  it("reads nothing stored as the code order", () => {
    expect(toDisplayOrder(undefined)).toEqual({ categories: [], subcategories: {}, brands: [] });
  });
});

describe("ordering", () => {
  it("puts listed items first and keeps the rest in place", () => {
    expect(sortByOrder(["a", "b", "c", "d"], ["c", "a"], (x) => x)).toEqual(["c", "a", "b", "d"]);
  });

  it("orders categories, types and brands", () => {
    const order = toDisplayOrder({ categories: ["beauty", "shoes"], subcategories: { shoes: ["boots"] }, brands: ["puma"] });
    expect(orderedCategorySlugs(order).slice(0, 3)).toEqual(["beauty", "shoes", "electronics"]);
    expect(orderedCategorySlugs(order)).toHaveLength(11);
    expect(orderedSubcategories(order, "shoes")[0]).toBe("boots");
    const brands = [{ key: "nike" }, { key: "adidas" }, { key: "puma" }];
    expect(orderedBrands(order, brands).map((b) => b.key)).toEqual(["puma", "nike", "adidas"]);
  });
});
