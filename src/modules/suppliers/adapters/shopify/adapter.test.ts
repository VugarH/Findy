import { describe, expect, it } from "vitest";
import { toRawOffer, type ShopifyProduct, type ShopifyStore } from "./adapter";

const store: ShopifyStore = {
  id: "keychron",
  name: "Keychron",
  domain: "keychron.com",
  originCountry: "US",
  currency: "USD",
  category: "electronics",
  shipsToMarket: false,
  reliability: { basis: "official-brand-store", note: "Official online store of the Keychron brand" },
  brand: "Keychron",
};

const product: ShopifyProduct = {
  id: 42,
  title: "Keychron K8 HE Wireless Keyboard",
  handle: "keychron-k8-he",
  vendor: "Keychron",
  product_type: "Keyboard",
  variants: [
    { price: "139.00", compare_at_price: "159.00", available: false, grams: 900 },
    { price: "149.00", compare_at_price: "159.00", available: true, grams: 900 },
  ],
  images: [{ src: "https://cdn.shopify.com/k8.jpg?v=1" }],
};

describe("Shopify adapter", () => {
  it("makes one offer from the cheapest variant that is in stock", () => {
    expect(toRawOffer(product, store)).toMatchObject({
      externalId: "42",
      url: "https://keychron.com/products/keychron-k8-he",
      brand: "Keychron",
      model: "K8 HE Wireless Keyboard",
      priceMinor: 14_900,
      listPriceMinor: 15_900,
      currency: "USD",
      shippingMinor: null,
      weightKg: 0.9,
      inStock: true,
      imageUrl: "https://cdn.shopify.com/k8.jpg?v=1&width=600",
    });
  });

  it("falls back to the cheapest variant when nothing is in stock", () => {
    const soldOut = { ...product, variants: product.variants.map((v) => ({ ...v, available: false })) };
    expect(toRawOffer(soldOut, store)).toMatchObject({ priceMinor: 13_900, inStock: false });
  });

  it("skips things that are not goods", () => {
    for (const title of ["$150 Gift Card", "2-Year Extended Warranty", "Certified Refurbished K8", "Free Gift | Keycap"]) {
      expect(toRawOffer({ ...product, title }, store)).toBeNull();
    }
    expect(toRawOffer({ ...product, variants: [{ ...product.variants[1], price: "1.00" }] }, store)).toBeNull();
  });

  it("uses the vendor as brand in multi-brand stores", () => {
    const retailer = { ...store, brand: undefined, name: "Clove Technology" };
    expect(toRawOffer({ ...product, vendor: "Logitech", title: "Logitech MX Keys" }, retailer)).toMatchObject({
      brand: "Logitech",
      model: "MX Keys",
    });
  });
});

describe("served currency", () => {
  it("reads the currency the response is priced in, from its cart_currency cookie", async () => {
    const { servedCurrency } = await import("./adapter");
    const headers = (cookie: string) => new Headers([["set-cookie", cookie], ["set-cookie", "_shopify_essential=abc; path=/"]]);
    expect(servedCurrency(headers("cart_currency=AZN; path=/; SameSite=Lax"), "USD")).toBe("AZN");
    expect(servedCurrency(new Headers(), "EUR")).toBe("EUR");
    expect(() => servedCurrency(headers("cart_currency=JPY; path=/"), "USD")).toThrow(/JPY/);
  });
});
