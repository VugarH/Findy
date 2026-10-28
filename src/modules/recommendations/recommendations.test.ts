import { describe, expect, it } from "vitest";
import { emptyProfile, hasInterests, recordInterest, sanitizeProfile, searchInterest, topKeys } from "./profile";
import { rankForVisitor } from "./rank";

const DAY = 86_400_000;
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

describe("interest profile", () => {
  it("adds what a visitor opens and searches, strongest first", () => {
    let profile = emptyProfile(0);
    expect(hasInterests(profile)).toBe(false);
    profile = recordInterest(profile, { kind: "view", productId: id(1), categorySlug: "shoes", subcategorySlug: "sneakers", brand: "Nike " }, 0);
    profile = recordInterest(profile, { kind: "view", productId: id(2), categorySlug: "shoes", brand: "Adidas" }, 0);
    profile = recordInterest(profile, { kind: "search", categorySlug: "beauty" }, 0);
    expect(hasInterests(profile)).toBe(true);
    expect(topKeys(profile.categories, 2)).toEqual(["shoes", "beauty"]);
    expect(profile.subcategories).toEqual({ "shoes/sneakers": 1 });
    expect(profile.brands).toEqual({ nike: 1, adidas: 1 });
    expect(profile.viewed).toEqual([id(2), id(1)]);
  });

  it("fades old interests: halved after two weeks", () => {
    const old = recordInterest(emptyProfile(0), { kind: "view", productId: id(1), categorySlug: "shoes" }, 0);
    const later = recordInterest(old, { kind: "view", productId: id(2), categorySlug: "beauty" }, 14 * DAY);
    expect(later.categories).toEqual({ beauty: 1, shoes: 0.5 });
  });

  it("tells what a search was about from what most of its results share", () => {
    const result = (categorySlug: string, brand: string | null) => ({ categorySlug, subcategorySlug: "sneakers", brand });
    expect(searchInterest([result("shoes", "Nike"), result("shoes", "NIKE"), result("fashion", "Puma")])).toEqual({
      kind: "search",
      categorySlug: "shoes",
      subcategorySlug: "sneakers",
      brand: "nike",
    });
    expect(searchInterest([result("shoes", "A"), result("beauty", "B"), result("toys", "C")])).toBeNull();
    expect(searchInterest([])).toBeNull();
  });

  it("accepts only a well-formed profile, with its sizes capped", () => {
    expect(sanitizeProfile(null)).toBeNull();
    expect(sanitizeProfile({ v: 2 })).toBeNull();
    const clean = sanitizeProfile({
      v: 1,
      updatedAt: 5,
      categories: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`c${i}`, i + 1])),
      brands: { nike: "a lot", adidas: -1, puma: 3 },
      viewed: [id(1), "not-an-id", 7],
    })!;
    expect(Object.keys(clean.categories)).toHaveLength(12);
    expect(clean.brands).toEqual({ puma: 3 });
    expect(clean.viewed).toEqual([id(1)]);
  });
});

describe("ranking for a visitor", () => {
  const deal = (n: number, categorySlug: string, brand: string | null, supplierId = "s1") => ({
    productId: id(n),
    categorySlug,
    subcategorySlug: "other",
    brand,
    supplierId,
  });

  it("puts deals that fit the visitor's interests first, and leaves out unrelated and already seen ones", () => {
    const profile = { ...recordInterest(emptyProfile(0), { kind: "view", productId: id(9), categorySlug: "shoes", brand: "Nike" }, 0) };
    const ranked = rankForVisitor(
      [deal(1, "beauty", "Fenty"), deal(2, "shoes", "Puma", "s2"), deal(3, "shoes", "Nike", "s3"), deal(9, "shoes", "Nike")],
      profile,
      10,
    );
    expect(ranked.map((c) => c.productId)).toEqual([id(3), id(2)]);
  });

  it("mixes brands and stores", () => {
    const profile = recordInterest(emptyProfile(0), { kind: "view", productId: id(99), categorySlug: "shoes", brand: "Nike" }, 0);
    const nikes = Array.from({ length: 5 }, (_, i) => deal(i + 1, "shoes", "Nike", `s${i}`));
    const sameStore = Array.from({ length: 5 }, (_, i) => deal(i + 10, "shoes", `Brand ${i}`, "one"));
    expect(rankForVisitor(nikes, profile, 10)).toHaveLength(2);
    expect(rankForVisitor(sameStore, profile, 10)).toHaveLength(3);
  });
});
