import { describe, expect, it } from "vitest";
import {
  inStockSizeKeys,
  normalizeSizes,
  readEmbeddedSizes,
  sizeKey,
  sizesFromShopify,
  sizesFromStructuredVariants,
  sortSizes,
} from "./sizes";

describe("normalizeSizes", () => {
  it("merges duplicates (in stock if any copy is) and sorts the sizes", () => {
    expect(
      normalizeSizes([
        { label: " 42 ", inStock: false },
        { label: "40", inStock: true },
        { label: "42", inStock: true },
      ]),
    ).toEqual([
      { label: "40", inStock: true },
      { label: "42", inStock: true },
    ]);
  });

  it("drops a lone 'one size'", () => {
    expect(normalizeSizes([{ label: "One Size", inStock: true }])).toBeUndefined();
    expect(normalizeSizes([{ label: "Default Title", inStock: true }])).toBeUndefined();
    expect(normalizeSizes([])).toBeUndefined();
  });
});

describe("sizesFromShopify", () => {
  const variants = [
    { option1: "Black", option2: "S", available: false },
    { option1: "Black", option2: "M", available: true },
    { option1: "White", option2: "S", available: true },
  ];

  it("reads the option named like size, whichever position it has", () => {
    expect(sizesFromShopify([{ name: "Color" }, { name: "Size" }], variants)).toEqual([
      { label: "S", inStock: true },
      { label: "M", inStock: true },
    ]);
  });

  it("returns nothing when no option is a size", () => {
    expect(sizesFromShopify([{ name: "Color" }], variants)).toBeUndefined();
    expect(sizesFromShopify(undefined, variants)).toBeUndefined();
  });
});

describe("sizesFromStructuredVariants", () => {
  it("reads size and availability from ProductGroup variants", () => {
    expect(
      sizesFromStructuredVariants([
        { size: "38", offers: { availability: "https://schema.org/InStock" } },
        { size: { name: "39" }, offers: [{ availability: "https://schema.org/OutOfStock" }] },
      ]),
    ).toEqual([
      { label: "38", inStock: true },
      { label: "39", inStock: false },
    ]);
  });
});

describe("readEmbeddedSizes (Akinon stores)", () => {
  const block = (name: string, key: string, options: string) =>
    `{\\"attribute_key\\":\\"${key}\\",\\"attribute_name\\":\\"${name}\\",\\"options\\":[${options}]}`;
  const option = (label: string, inStock: boolean) =>
    `{\\"is_selected\\":false,\\"in_stock\\":${inStock},\\"label\\":\\"${label}\\",\\"product\\":{\\"pk\\":1,\\"name\\":\\"Shoe {x}\\"}}`;

  it("finds the size block among the variants, skipping colours", () => {
    const html = `self.__next_f.push([1,"{\\"variants\\":[${block("Renk", "integration_renk", option("070", true))},${block(
      "Beden",
      "integration_beden",
      [option("40", false), option("41", true), option("42", true)].join(","),
    )}]}"])`;
    expect(readEmbeddedSizes(html)).toEqual([
      { label: "40", inStock: false },
      { label: "41", inStock: true },
      { label: "42", inStock: true },
    ]);
  });

  it("returns nothing for a page without variants", () => {
    expect(readEmbeddedSizes("<html><body>No variants</body></html>")).toBeUndefined();
  });
});

describe("sortSizes", () => {
  const labels = (list: string[]) => sortSizes(list.map((label) => ({ label, inStock: true }))).map((s) => s.label);

  it("puts letter sizes in size order", () => {
    expect(labels(["XL", "XXL", "L", "M", "XS", "S", "XXS", "3XL"])).toEqual(["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL"]);
  });

  it("puts numbers in order, decimals with a comma or a point", () => {
    expect(labels(["44", "40,5", "38", "8.5", "41"])).toEqual(["8.5", "38", "40,5", "41", "44"]);
  });

  it("keeps a mixed list as the store has it", () => {
    expect(labels(["W30 L32", "W32 L32", "M"])).toEqual(["W30 L32", "W32 L32", "M"]);
  });
});

describe("sizeKey", () => {
  it("spells the same size the same way in every store", () => {
    expect(sizeKey("42,5")).toBe("42.5");
    expect(sizeKey(" m ")).toBe("M");
    expect(sizeKey("2XL")).toBe("XXL");
    expect(sizeKey("W32 L34")).toBe("W32 L34");
  });

  it("keeps only the sizes that can be bought", () => {
    expect(inStockSizeKeys([{ label: "41", inStock: true }, { label: "42", inStock: false }, { label: "42,5", inStock: true }])).toEqual(["41", "42.5"]);
    expect(inStockSizeKeys(null)).toBeNull();
  });
});
