import { describe, expect, it } from "vitest";
import { minorToInput, parseAmountToMinor, queryString } from "./forms";
import { parseNewProductForm, parseOfferForm, parseStoreForm, selectedIds } from "./validation";

const form = (entries: Record<string, string | string[]>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(key, item);
  }
  return data;
};

describe("amounts typed by people", () => {
  it.each([
    ["129", 12900],
    ["129.90", 12990],
    ["129,9", 12990],
    ["1 299,90", 129990],
    ["1.299,90", 129990],
    ["1,299.90", 129990],
    ["1.299", 129900],
    ["₼ 45", 4500],
    ["0", null],
    ["abc", null],
    ["12,3,4", null],
    ["", null],
  ] as const)("%s -> %s", (input, expected) => {
    expect(parseAmountToMinor(input)).toBe(expected);
  });

  it("turns minor units back into what a person would type", () => {
    expect(minorToInput(12990)).toBe("129.90");
    expect(minorToInput(12900)).toBe("129");
    expect(minorToInput(null)).toBe("");
  });

  it("builds query strings from the filters that are set", () => {
    expect(queryString({ q: "nike", page: 2, live: "", sort: undefined })).toBe("?q=nike&page=2");
    expect(queryString({ q: "" })).toBe("");
  });
});

describe("store form", () => {
  const base = {
    name: "Nike Türkiye",
    websiteUrl: "https://www.nike.com.tr/some/page",
    originCountry: "tr",
    currency: "TRY",
    reliabilityBasis: "official-brand-store",
    reliabilityNote: "",
    mainCategory: "shoes",
    otherCategories: ["shoes", "fashion"],
  };

  it("reads a structured-data store, keeping only the site's origin and the other categories", () => {
    const parsed = parseStoreForm(
      form({
        ...base,
        "connection.type": "structured-data",
        "connection.sitemap": "https://www.nike.com.tr/sitemap.xml",
        "connection.productUrl": "/urun/",
        "connection.productsPerRun": "120",
        "connection.listPrice": "old-price-json",
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data).toMatchObject({ websiteUrl: "https://www.nike.com.tr", originCountry: "TR", currency: "TRY" });
    expect(parsed.data.config.categories).toEqual(["shoes", "fashion"]);
    expect(parsed.data.config.connection).toMatchObject({
      type: "structured-data",
      productUrl: "/urun/",
      productsPerRun: 120,
      listPrice: "old-price-json",
    });
  });

  it("names the field that is wrong", () => {
    const parsed = parseStoreForm(
      form({
        ...base,
        mainCategory: "",
        websiteUrl: "nike",
        "connection.type": "structured-data",
        "connection.sitemap": "",
        "connection.productUrl": "(",
      }),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors).toMatchObject({
      websiteUrl: "invalidUrl",
      mainCategory: "chooseCategory",
      "connection.sitemap": "invalidUrl",
      "connection.productUrl": "invalidPattern",
    });
  });

  it("needs nothing more for a store with prices by hand", () => {
    const parsed = parseStoreForm(form({ ...base, "connection.type": "manual" }));
    expect(parsed.ok && parsed.data.config.connection).toEqual({ type: "manual" });
  });
});

describe("price entered by hand", () => {
  const offer = {
    supplierId: "local-shop",
    url: "https://shop.az/p/1",
    price: "129,90",
    currency: "AZN",
    inStock: "on",
  };

  it("reads amounts, free delivery and stock", () => {
    const parsed = parseOfferForm(form({ ...offer, listPrice: "199", shipping: "0" }));
    expect(parsed).toEqual({
      ok: true,
      data: {
        supplierId: "local-shop",
        url: "https://shop.az/p/1",
        priceMinor: 12990,
        listPriceMinor: 19900,
        shippingMinor: 0,
        currency: "AZN",
        inStock: true,
        deliveryMinDays: null,
        deliveryMaxDays: null,
      },
    });
  });

  it("refuses an old price below the price and delivery days in the wrong order", () => {
    const parsed = parseOfferForm(form({ ...offer, listPrice: "99", deliveryMin: "10", deliveryMax: "3" }));
    expect(!parsed.ok && parsed.errors).toEqual({ listPrice: "listBelowPrice", deliveryMax: "invalid" });
  });

  it("reads a new product with its first offer under the offer. prefix", () => {
    const parsed = parseNewProductForm(
      form({
        title: "Philips Airfryer XXL",
        brand: "Philips",
        categorySlug: "home",
        subcategory: "auto",
        audience: "auto",
        ...Object.fromEntries(Object.entries(offer).map(([key, value]) => [`offer.${key}`, value])),
      }),
    );
    expect(parsed.ok && parsed.data).toMatchObject({
      title: "Philips Airfryer XXL",
      categorySlug: "home",
      subcategory: "auto",
      offer: { priceMinor: 12990 },
    });
  });

  it("rejects a subcategory of another category", () => {
    const parsed = parseNewProductForm(
      form({ title: "X", categorySlug: "home", subcategory: "sneakers", audience: "auto" }),
    );
    expect(!parsed.ok && parsed.errors.subcategory).toBe("chooseCategory");
  });
});

describe("ticked rows", () => {
  it("keeps only real ids, once", () => {
    const id = "4b61bc69-1b8d-44e3-b275-39cfa3f8e43c";
    expect(selectedIds(form({ ids: [id, id, "'; drop table products; --"] }))).toEqual([id]);
  });
});
