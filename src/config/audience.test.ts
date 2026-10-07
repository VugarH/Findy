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
