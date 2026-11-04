import { describe, expect, it } from "vitest";
import { jsonLdText, productJsonLd } from "./structured-data";

const base = { name: "Nike Air Max 90", brand: "Nike", images: ["https://cdn.test/a.jpg"], url: "https://findy.az/az/product/x", currency: "AZN" };

describe("product data for search engines", () => {
  it("one store: a plain offer with the price the page shows", () => {
    const data = productJsonLd({ ...base, offers: [{ priceMinor: 23990, inStock: true, store: "Undefeated" }] })!;
    expect(data.offers).toMatchObject({ "@type": "Offer", price: "239.90", priceCurrency: "AZN", availability: "https://schema.org/InStock" });
  });

  it("several stores: the range over those in stock", () => {
    const data = productJsonLd({
      ...base,
      offers: [
        { priceMinor: 30000, inStock: true, store: "A" },
        { priceMinor: 25000, inStock: true, store: "B" },
        { priceMinor: 10000, inStock: false, store: "C" },
      ],
    })!;
    expect(data.offers).toMatchObject({ "@type": "AggregateOffer", lowPrice: "250.00", highPrice: "300.00", offerCount: 2 });
  });

  it("nothing in stock says so; no offers, no data", () => {
    const data = productJsonLd({ ...base, offers: [{ priceMinor: 10000, inStock: false, store: "C" }] })!;
    expect(data.offers).toMatchObject({ availability: "https://schema.org/OutOfStock" });
    expect(productJsonLd({ ...base, offers: [] })).toBeNull();
  });

  it("a product name cannot close the script tag", () => {
    expect(jsonLdText({ name: "</script><script>alert(1)</script>" })).not.toContain("<");
  });
});
