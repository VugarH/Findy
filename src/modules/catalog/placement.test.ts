import { describe, expect, it } from "vitest";
import { withLocks, withoutLocks } from "./locks";
import { reclassify, resolvePlacement } from "./placement";

const coat = {
  title: "Tween Slim Fit Siyah Palto",
  brand: null,
  sourceType: null,
  categorySlug: "fashion" as const,
  subcategorySlug: "other",
  audience: null,
  lockedFields: [] as string[],
};

describe("locks", () => {
  it("keeps the list sorted and free of duplicates", () => {
    expect(withLocks(["title"], ["audience", "title"])).toEqual(["audience", "title"]);
    expect(withoutLocks(["audience", "title"], ["title"])).toEqual(["audience"]);
  });
});

describe("reclassify (daily job)", () => {
  it("applies the rules to fields nobody set by hand", () => {
    expect(reclassify({ ...coat, title: "Erkek Mont" })).toEqual({ subcategorySlug: "jackets-coats", audience: "men" });
  });

  it("moves a product whose title clearly names another category", () => {
    const sunglasses = { ...coat, title: "Pilgrim JUNIE sunglasses black", categorySlug: "jewelry" as const };
    expect(reclassify(sunglasses)).toMatchObject({ categorySlug: "bags", subcategorySlug: "sunglasses" });
    expect(reclassify({ ...sunglasses, lockedFields: ["categorySlug"] })).not.toHaveProperty("categorySlug");
  });

  it("leaves locked fields alone, so a correction is never undone overnight", () => {
    const moved = {
      ...coat,
      title: "Erkek Mont",
      subcategorySlug: "suits-formal",
      audience: "unisex",
      lockedFields: ["audience", "subcategorySlug"],
    };
    expect(reclassify(moved)).toEqual({});
  });
});

describe("resolvePlacement (admin panel)", () => {
  it("locks an explicit subcategory and leaves the category unlocked when it did not change", () => {
    const next = resolvePlacement(coat, { categorySlug: "fashion", subcategory: "jackets-coats" });
    expect(next).toMatchObject({
      categorySlug: "fashion",
      subcategorySlug: "jackets-coats",
      lockedFields: ["subcategorySlug"],
    });
  });

  it("lets the rules pick the subcategory of a new category unless one is chosen", () => {
    const next = resolvePlacement(
      { ...coat, title: "Kadın Deri Çanta" },
      { categorySlug: "bags", subcategory: "auto" },
    );
    expect(next.categorySlug).toBe("bags");
    expect(next.subcategorySlug).toBe("handbags");
    expect(next.lockedFields).toEqual(["categorySlug"]);
  });

  it("hands a field back to the rules with “auto”", () => {
    const locked = { ...coat, title: "Erkek Mont", audience: "women", lockedFields: ["audience"] };
    expect(resolvePlacement(locked, { categorySlug: "fashion", audience: "auto" })).toMatchObject({
      audience: "men",
      lockedFields: [],
    });
  });

  it("can say a product is for no one in particular, and keeps that", () => {
    const next = resolvePlacement({ ...coat, audience: "men" }, { categorySlug: "fashion", audience: "none" });
    expect(next).toMatchObject({ audience: null, lockedFields: ["audience"] });
    expect(reclassify({ ...coat, ...next })).not.toHaveProperty("audience");
  });
});
