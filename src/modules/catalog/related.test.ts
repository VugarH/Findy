import { describe, expect, it } from "vitest";
import { rankRelated } from "./related-rank";

const source = { productId: "p0", title: "Nike Air Max 90 Erkek Spor Ayakkabı", brand: "Nike", landedMinor: 20_000 };
const card = (productId: string, title: string, brand: string | null, landedMinor: number, supplierId = productId) => ({
  productId,
  title,
  brand,
  landedMinor,
  supplierId,
});

describe("similar items", () => {
  it("prefers similar names and prices, and leaves out the product and the same item elsewhere", () => {
    const ranked = rankRelated(
      source,
      [
        card("p0", "Nike Air Max 90 Erkek Spor Ayakkabı", "Nike", 20_000),
        card("same", "NIKE Air Max 90 Erkek Spor Ayakkabi", "NIKE", 19_000),
        card("far", "Puma Basket Classic Kadın", "Puma", 39_000),
        card("close", "adidas Air Runner Erkek Spor Ayakkabı", "adidas", 21_000),
        card("brand", "Nike Air Max 270 Erkek Spor Ayakkabı", "Nike", 22_000),
      ],
      10,
    );
    expect(ranked.map((c) => c.productId)).toEqual(["brand", "close", "far"]);
  });

  it("mixes brands and stores", () => {
    const nikes = Array.from({ length: 5 }, (_, i) => card(`n${i}`, `Nike Air Zoom ${i}`, "Nike", 20_000));
    expect(rankRelated(source, nikes, 10)).toHaveLength(2);
    const oneStore = Array.from({ length: 5 }, (_, i) => card(`s${i}`, `Brand${i} Sneaker`, `Brand${i}`, 20_000, "store"));
    expect(rankRelated(source, oneStore, 10)).toHaveLength(3);
  });
});
