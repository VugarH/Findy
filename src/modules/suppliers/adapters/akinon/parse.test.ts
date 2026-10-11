import { describe, expect, it } from "vitest";
import { payablePrice, readListingPage, toRawOffer, type AkinonListingProduct } from "./parse";

const store = { origin: "https://www.superstep.com.tr", currency: "TRY" as const, categories: ["shoes" as const, "fashion" as const] };

const product = (patch: Partial<AkinonListingProduct> = {}): AkinonListingProduct => ({
  pk: "708367",
  name: "adidas Superstar II Unisex Kahverengi Spor Ayakkabı",
  sku: "6419709",
  base_code: "JQ3184",
  price: "6999",
  retail_price: "6999",
  in_stock: true,
  absolute_url: "/urun/adidas-superstar-ii-unisex-kahverengi-spor-ayakkabi/jq3184-5/",
  attributes: { integration_model_renk: "JQ3184.-", integration_alt_marka: "ADIDAS" },
  productimage_set: [{ image: "https://cdn.example/a.jpg" }],
  basket_offers: [
    {
      label: "SEPETTE %30 İNDİRİM",
      listing_kwargs: { quantity: "1", discounted_total_price: "4899.3" },
      client_types: [],
    },
  ],
  extra_data: {
    variants: [
      { attribute_key: "integration_renk", options: [{ label: "-", in_stock: true }] },
      { attribute_key: "integration_beden", options: [{ label: "42", in_stock: false }, { label: "43", in_stock: true }] },
    ],
  },
  ...patch,
});

describe("Akinon listing pages", () => {
  it("reads the products embedded in the page's Next.js data", () => {
    const json = JSON.stringify({ products: [product()], pagination: { total_count: "1864" } });
    const html = `<script>self.__next_f.push([1,"${json.replace(/"/g, '\\"')}"])</script>`;
    const page = readListingPage(html);
    expect(page.products.map((p) => p.pk)).toEqual(["708367"]);
    expect(page.totalCount).toBe(1864);
  });

  it("pays the cart price when a one-item offer applies to everyone", () => {
    expect(payablePrice(product())).toBe(4899.3);
    expect(payablePrice(product({ basket_offers: [] }))).toBe(6999);
    // Two-item offers and offers for some shoppers only are not a price anyone pays for one item.
    expect(payablePrice(product({ basket_offers: [{ listing_kwargs: { quantity: 2, discounted_total_price: 4000 }, client_types: [] }] }))).toBe(6999);
    expect(payablePrice(product({ basket_offers: [{ listing_kwargs: { quantity: 1, discounted_total_price: 4000 }, client_types: ["vip"] }] }))).toBe(6999);
  });

  it("makes an offer keyed by model + colour, with the regular price crossed out", () => {
    const offer = toRawOffer(product(), store)!;
    expect(offer).toMatchObject({
      externalId: "JQ3184.-",
      brand: "adidas",
      mpn: "JQ3184",
      categorySlug: "shoes",
      priceMinor: 489930,
      listPriceMinor: 699900,
      inStock: true,
      url: "https://www.superstep.com.tr/urun/adidas-superstar-ii-unisex-kahverengi-spor-ayakkabi/jq3184-5/",
    });
    expect(offer.sizes).toEqual([{ label: "42", inStock: false }, { label: "43", inStock: true }]);
  });

  it("has no crossed-out price when nothing is discounted", () => {
    expect(toRawOffer(product({ basket_offers: [] }), store)!.listPriceMinor).toBeUndefined();
  });
});
