import { describe, expect, it } from "vitest";
import { parseListPage, toRawOffer } from "./baku-electronics";
import { brandLinks, parseCards } from "./world-telecom";
import { parseProductPage, productUrlsFromListing, productUrlsFromSitemap } from "./soliton";

describe("Baku Electronics adapter", () => {
  const item = {
    product_code: 235791,
    name: "Smartfon HONOR X8e 6GB/256GB Gold",
    slug: "telefon-honor-x8e-6gb256gb-gold-235791",
    price: 899.99,
    discount: "70",
    discounted_price: 829.99,
    quantity: 34,
    image: "https://media.bakuelectronics.az/x.webp",
  };

  it("reads the product list out of __NEXT_DATA__", () => {
    const data = { props: { pageProps: { products: { products: { items: [item], total: 332, size: 18 } } } } };
    const html = `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script></html>`;
    expect(parseListPage(html)).toMatchObject({ total: 332, size: 18, items: [{ product_code: 235791 }] });
  });

  it("fails loudly when the page layout changes", () => {
    expect(() => parseListPage("<html></html>")).toThrow(/__NEXT_DATA__/);
  });

  it("maps a discounted item", () => {
    expect(toRawOffer(item, "smartphone")).toMatchObject({
      externalId: "235791",
      url: "https://bakuelectronics.az/mehsul/telefon-honor-x8e-6gb256gb-gold-235791",
      brand: "Honor",
      model: "X8e 6/256GB",
      priceMinor: 82_999,
      listPriceMinor: 89_999,
      inStock: true,
    });
  });

  it("has no list price without a discount", () => {
    const offer = toRawOffer({ ...item, discount: "0", discounted_price: 899.99 }, "smartphone");
    expect(offer).toMatchObject({ priceMinor: 89_999, listPriceMinor: undefined });
  });
});

describe("Soliton adapter", () => {
  const url = "https://soliton.az/az/telefon/mobil-telefonlar/20260925123410231-motorola-moto-g77.html";
  const page = `
    <meta property="og:title" content="MOTOROLA MOTO G77  5G 8/256GB BLACK OLIVE(BLACK)">
    <meta property="og:image" content="https://soliton.az/images/a_1.jpg">
    <meta property="product:brand" content="Motorola">
    <meta property="product:availability" content="in stock">
    <meta property="product:price:amount" content="919.99">
    <meta property="product:price:currency" content="AZN">
    <meta property="product:retailer_item_id" content="20260925123410231">
    <div class="priceHolder"><span class="creditPrice">999.99 <span class="aznm">M</span></span></div>`;

  it("reads a product from its meta tags", () => {
    expect(parseProductPage(page, url, "electronics")).toMatchObject({
      externalId: "20260925123410231",
      brand: "Motorola",
      model: "Moto G77 5G 8/256GB",
      priceMinor: 91_999,
      listPriceMinor: 99_999,
      inStock: true,
      imageUrl: "https://soliton.az/images/a_1.jpg",
    });
  });

  it("skips pages without a price", () => {
    expect(parseProductPage(page.replace("919.99", ""), url, "electronics")).toBeNull();
  });

  it("collects product URLs from the sitemap and the listing", () => {
    const xml = `<urlset><url><loc>${url}</loc></url><url><loc>https://soliton.az/az/telefon/adi-telefonlar/1-x.html</loc></url></urlset>`;
    expect(productUrlsFromSitemap(xml, "/mobil-telefonlar/")).toEqual([url]);
    const html = `<a href="/az/telefon/mobil-telefonlar/20260925123410231-motorola-moto-g77.html" class="prodTitle">x</a>`;
    expect(productUrlsFromListing(html, "/mobil-telefonlar/")).toEqual([url]);
  });
});

describe("World Telecom adapter", () => {
  const card = (id: number, name: string, whole: string) => `
    <a href="https://w-t.az/x+p${id}"><img loading="lazy" class="productImage-img" src="https://w-t.az/storage/${id}.jpeg" alt=""></a>
    <div class="productNameUrl">
      <a href="https://w-t.az/smartfonlar/apple/item+p${id}" class="productUrl">
                <div class="productName">${name}</div>
      </a>
    </div>
    <div class="productPrice"><span class="realPrice">
                ${whole} <sup>.00</sup> ₼            </span></div>`;

  it("reads product cards", () => {
    const offers = parseCards(card(2733, "Apple iPhone 15 128 GB Black", "1799") + card(9, "Smart Paket", "35"), "smartphone");
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({
      externalId: "2733",
      url: "https://w-t.az/smartfonlar/apple/item+p2733",
      brand: "Apple",
      model: "iPhone 15 128GB",
      priceMinor: 179_900,
      productType: "smartphone",
      imageUrl: "https://w-t.az/storage/2733.jpeg",
    });
  });

  it("finds the brand pages of a section", () => {
    const html = `<a href="https://w-t.az/k2+mobil-telefonlar/apple+m2">a</a><a href="https://w-t.az/k2+mobil-telefonlar/samsung+m1">s</a><a href="https://w-t.az/k3+plansetler/apple+m2">other section</a>`;
    expect(brandLinks(html, "/k2+mobil-telefonlar")).toEqual([
      "https://w-t.az/k2+mobil-telefonlar/apple+m2",
      "https://w-t.az/k2+mobil-telefonlar/samsung+m1",
    ]);
  });
});
