import { describe, expect, it } from "vitest";
import { readFarmasiProduct } from "./farmasi";

const page = (productData: object) =>
  `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { productData } } })}</script></html>`;

describe("Farmasi pages", () => {
  it("reads the product, with the previous price when it is discounted", () => {
    const product = readFarmasiProduct(
      page({ name: "Lip Oil - Transparent", code: "1002515", brandName: "Farmasi MUP", price: 399, retailPrice: 399, referencePrice: 509, currencyCode: "TRY", stock: true, images: [{ imageUrl: "https://content-tr.farmasi.com.tr/Product/1002515_400.webp" }] }),
    );
    expect(product).toMatchObject({ name: "Lip Oil - Transparent", brand: "Farmasi", sku: "1002515", price: 399, listPrice: 509, currency: "TRY", inStock: true });
  });

  it("has no crossed-out price at the regular price, and no product without data", () => {
    expect(readFarmasiProduct(page({ name: "X", code: "1", price: 509, retailPrice: 509, referencePrice: null, stock: true }))?.listPrice).toBeNull();
    expect(readFarmasiProduct("<html></html>")).toBeNull();
    expect(readFarmasiProduct(page({ name: "X", code: "1", price: 0 }))).toBeNull();
  });
});
