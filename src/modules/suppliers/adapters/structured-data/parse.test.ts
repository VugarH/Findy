import { describe, expect, it } from "vitest";
import { createStructuredDataAdapter, toRawOffer, type StructuredDataStore } from "./adapter";
import { parsePrice, pickProductUrls, readListPrice, readSitemap, readStructuredProduct } from "./parse";

const ld = (data: unknown) => `<html><head><script type="application/ld+json">${JSON.stringify(data)}</script></head></html>`;

describe("readStructuredProduct", () => {
  it("reads a plain Product with a single Offer", () => {
    const html = ld({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "adidas 3 Stripes   Studio Leggings",
      sku: "HZ0872-001",
      mpn: "HZ0872",
      brand: { "@type": "Brand", name: "adidas" },
      image: ["https://cdn.example/1.jpg", "https://cdn.example/2.jpg"],
      offers: { "@type": "Offer", priceCurrency: "TRY", price: "2534.35", availability: "https://schema.org/InStock" },
    });
    expect(readStructuredProduct(html)).toEqual({
      name: "adidas 3 Stripes Studio Leggings",
      brand: "adidas",
      sku: "HZ0872-001",
      mpn: "HZ0872",
      gtin: null,
      image: "https://cdn.example/1.jpg",
      price: 2534.35,
      currency: "TRY",
      inStock: true,
    });
  });

  it("finds the Product among other blocks, inside @graph, with offers as an array", () => {
    const html =
      ld({ "@type": "Organization", name: "Shop" }) +
      ld({
        "@graph": [
          { "@type": "BreadcrumbList" },
          {
            "@type": ["Product"],
            name: "Siyah Bej Kadın Kağıt Hasır &#199;anta",
            gtin13: "8697883003857",
            offers: [
              { price: 3149, priceCurrency: "try", availability: "OutOfStock" },
              { price: 3499, priceCurrency: "try", availability: "InStock" },
            ],
          },
        ],
      });
    const product = readStructuredProduct(html);
    expect(product?.name).toBe("Siyah Bej Kadın Kağıt Hasır Çanta");
    expect(product?.gtin).toBe("8697883003857");
    // An offer that can be bought beats a cheaper sold-out one.
    expect(product).toMatchObject({ price: 3499, currency: "TRY", inStock: true });
  });

  it("reads AggregateOffer and ProductGroup variants", () => {
    expect(readStructuredProduct(ld({ "@type": "Product", name: "A", offers: { "@type": "AggregateOffer", lowPrice: "99.90" } }))?.price).toBe(99.9);
    const group = ld({
      "@type": "ProductGroup",
      name: "Tee",
      hasVariant: [{ offers: { price: "20" } }, { offers: { price: "15" } }],
    });
    expect(readStructuredProduct(group)?.price).toBe(15);
  });

  it("returns null without a usable product or price", () => {
    expect(readStructuredProduct("<html></html>")).toBeNull();
    expect(readStructuredProduct(ld({ "@type": "Product", name: "No price" }))).toBeNull();
    expect(readStructuredProduct('<script type="application/ld+json">{broken</script>')).toBeNull();
  });

  it("survives raw line breaks inside JSON strings", () => {
    const html = '<script type="application/ld+json">{"@type":"Product","name":"Line\nbreak","offers":{"price":"10"}}</script>';
    expect(readStructuredProduct(html)?.name).toBe("Line break");
  });
});

describe("parsePrice", () => {
  it.each([
    ["2534.35", 2534.35],
    ["2.534,35", 2534.35],
    ["1,499.90", 1499.9],
    ["999,99", 999.99],
    [13350, 13350],
    ["", null],
    [0, null],
  ] as const)("%s -> %s", (input, expected) => {
    expect(parsePrice(input)).toBe(expected);
  });
});

describe("readListPrice", () => {
  it("reads each store's crossed-out price", () => {
    expect(readListPrice('{\\"price\\":\\"969.90\\",\\"retail_price\\":\\"1499\\"}', 969.9, "retail-price")).toBe(1499);
    expect(readListPrice('"price":{"oldPrice":3899,"newPrice":2534.35}', 2534.35, "old-price-json")).toBe(3899);
    expect(readListPrice('"initial_price":70950.0000,"old_price":80000.0000', 70950, "old-price-field")).toBe(80000);
    expect(readListPrice('{"discount":999.9100,"price":699.9900}', 699.99, "ga4-discount")).toBe(1699.9);
  });

  it("ignores missing, equal and implausible values", () => {
    expect(readListPrice('"old_price":null', 100, "old-price-field")).toBeNull();
    expect(readListPrice('\\"retail_price\\":\\"5099\\"', 5099, "retail-price")).toBeNull();
    expect(readListPrice('"oldPrice":99999', 100, "old-price-json")).toBeNull();
    expect(readListPrice('"discount":0,"price":100', 100, "ga4-discount")).toBeNull();
    expect(readListPrice('"oldPrice":200', 100, undefined)).toBeNull();
  });
});

describe("readSitemap", () => {
  it("tells an index from a URL set and reads lastmod", () => {
    const index = readSitemap(
      '<sitemapindex><sitemap><loc>https://s.example/products-1.xml</loc><lastmod>2026-09-01</lastmod></sitemap></sitemapindex>',
    );
    expect(index).toEqual({ isIndex: true, entries: [{ url: "https://s.example/products-1.xml", lastmod: "2026-09-01" }] });

    const set = readSitemap("<urlset><url><loc><![CDATA[ https://s.example/p?a=1&amp;b=2 ]]></loc></url></urlset>");
    expect(set).toEqual({ isIndex: false, entries: [{ url: "https://s.example/p?a=1&b=2", lastmod: null }] });
  });
});

describe("pickProductUrls", () => {
  const entries = Array.from({ length: 20 }, (_, i) => ({
    url: `https://s.example/${i % 4 === 0 ? "adidas" : "other"}-${i}`,
    lastmod: `2026-09-${String(10 + i).padStart(2, "0")}`,
  }));

  it("puts focus brands first, then the most recently changed", () => {
    const urls = pickProductUrls(entries, { limit: 6, focus: /adidas/ });
    expect(urls.slice(0, 3)).toEqual(["https://s.example/adidas-16", "https://s.example/adidas-12", "https://s.example/adidas-8"]);
    expect(urls).toHaveLength(6);
  });

  it("picks the same pages every day, so tracked prices never expire", () => {
    expect(pickProductUrls(entries, { limit: 6 })).toEqual(pickProductUrls([...entries].reverse(), { limit: 6 }));
  });

  it("returns everything when the catalog fits the budget", () => {
    expect(pickProductUrls(entries.slice(0, 3), { limit: 10 })).toHaveLength(3);
  });
});

describe("toRawOffer", () => {
  const store: StructuredDataStore = {
    id: "shoeshop",
    name: "SuperStep",
    origin: "https://www.shoe.example",
    originCountry: "TR",
    currency: "TRY",
    reliability: { basis: "established-retailer", note: "test" },
    shipsToMarket: false,
    categories: ["shoes", "bags", "fashion"],
    sitemap: "https://www.shoe.example/sitemap.xml",
    productUrl: /\/urun\//,
    listPrice: "retail-price",
  };
  const page = (data: object, extra = "") => ld({ "@type": "Product", ...data }) + extra;
  const url = "https://www.shoe.example/urun/adidas-ultrarun-5-erkek-beyaz-spor-ayakkabi/ih2639-1/";

  it("builds an offer: brand from the title when the store names itself, article number from the URL", () => {
    const html = page(
      { name: "adidas Ultrarun 5 Erkek Beyaz Spor Ayakkabı", sku: "6591994", brand: { name: "SuperStep" }, offers: { price: "5099", priceCurrency: "try" } },
      '<script>{\\"retail_price\\":\\"6999\\"}</script>',
    );
    expect(toRawOffer(html, url, store)).toMatchObject({
      externalId: "6591994",
      brand: "adidas",
      model: "Ultrarun 5 Erkek Beyaz Spor Ayakkabı",
      mpn: "IH2639",
      categorySlug: "shoes",
      priceMinor: 509900,
      listPriceMinor: 699900,
      currency: "TRY",
      shippingMinor: null,
      inStock: true,
    });
  });

  it("skips products in another currency or outside the store's categories", () => {
    expect(toRawOffer(page({ name: "Spor Ayakkabı", offers: { price: "50", priceCurrency: "USD" } }), url, store)).toBeNull();
    const toy = "https://www.shoe.example/urun/basketbol-topu/123/";
    expect(toRawOffer(page({ name: "Basketbol Topu", offers: { price: "500" } }), toy, store)).toBeNull();
    expect(toRawOffer(page({ name: "Basketbol Topu", offers: { price: "500" } }), toy, { ...store, fallbackCategory: "fashion" })?.categorySlug).toBe("fashion");
  });

  it("records the access method with the store", () => {
    const { definition } = createStructuredDataAdapter(store);
    expect(definition).toMatchObject({ id: "shoeshop", scope: "global", integration: "crawler", categories: ["shoes", "bags", "fashion"] });
    expect(definition.access.kind).toBe("sitemap-json-ld");
    expect(definition.access.fields.listPrice).toContain("retail-price");
  });
});
