import { describe, expect, it } from "vitest";
import { detectAudience } from "./audience";

describe("detectAudience", () => {
  it.each([
    ["Puma Skyrocket Lite 2 Kadın Siyah Spor Ayakkabı", "women"],
    ["NIKE WMNS AIR RIFT - BLACK", "women"],
    ["Allbirds Women's Tree Runner Go", "women"],
    ["adidas Own the Run Colorblock Erkek Yeşil Ceket", "men"],
    ["Steve Madden Men's Shoes", "men"],
    ["Nike Force 1 Low Easyon (TD) Çocuk Ayakkabı", "kids"],
    ["Erkek Çocuk Mont", "kids"],
    ["Converse Chuck Taylor All Star Unisex Mavi Sneaker", "unisex"],
    ["Kadın ve Erkek Çorap Seti", "unisex"],
    ["Apple iPhone 17 Pro 256GB", null],
    ["Lacivert Slim Fit Takım Elbise", null],
  ] as const)("%s -> %s", (title, expected) => {
    expect(detectAudience(title)).toBe(expected);
  });
});

describe("brands whose line is for one audience", () => {
  it("Good American is women's, even a \"baby tee\"", () => {
    expect(detectAudience("Good American THE RIB BABY TEE | WHITE", "Good American")).toBe("women");
    expect(detectAudience("Good American GOOD 90s JEANS | INDIGO", "Good American")).toBe("women");
  });

  it("Kith's main line is menswear unless the title says otherwise", () => {
    expect(detectAudience("Kith Curtis Short - Cyclone", "Kith")).toBe("men");
    expect(detectAudience("Kith Kids Hoodie", "Kith")).toBe("kids");
    expect(detectAudience("Kith Women Nelson Hoodie", "Kith Women")).toBe("women");
  });

  it("leaves other brands to their titles", () => {
    expect(detectAudience("Nike Air Force 1", "Nike")).toBeNull();
  });
});
