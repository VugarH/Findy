import { describe, expect, it } from "vitest";
import { categoryFor, shortTitle } from "./adapter";
import { ADMITAD_FEED_STORES } from "./stores";
import { decodeXml, parseOffer, readFeed, rootCategories, type FeedCategory } from "./feed";
import { discountOf, Selector, type SelectionRules } from "./select";

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<yml_catalog><shop><categories>
<category id="44">Consumer Electronics</category>
<category id="100" parentId="44">Earphones</category>
<category id="34">Automobiles</category>
</categories><offers>
<offer id="1"><name>Wireless Earbuds &amp; Case</name><url>https://track.test/1</url><price>9.50</price><oldprice>19.00</oldprice><currencyId>USD</currencyId><categoryId>100</categoryId><picture>https://img.test/1.jpg</picture><param name="discount">50%</param><param name="commissionRate">8%</param><param name="shopId">7</param></offer>
<offer id="2"><name>Car Mat</name><url>https://track.test/2</url><price>12</price><oldprice>20</oldprice><categoryId>34</categoryId><picture>https://img.test/2.jpg</picture></offer>
<offer id="3"><name>broken</name></offer>
</offers></shop></yml_catalog>`;

async function* chunked(text: string, size: number) {
  for (let i = 0; i < text.length; i += size) yield text.slice(i, i + size);
}

describe("Admitad feed", () => {
  it("reads categories and offers from a stream, whatever the chunk size", async () => {
    for (const size of [7, 64, 100_000]) {
      let categories: FeedCategory[] = [];
      const offers = [];
      for await (const offer of readFeed(chunked(FEED, size), (found) => (categories = found))) offers.push(offer);
      expect(categories.map((c) => c.id)).toEqual(["44", "100", "34"]);
      expect(offers.map((o) => o.id)).toEqual(["1", "2"]);
      expect(offers[0]).toMatchObject({
        name: "Wireless Earbuds & Case",
        price: 9.5,
        oldPrice: 19,
        categoryId: "100",
        pictures: ["https://img.test/1.jpg"],
        params: { discount: "50%", commissionRate: "8%", shopId: "7" },
      });
    }
  });

  it("decodes entities and CDATA", () => {
    expect(decodeXml("Men&#39;s Tee &lt;3&gt;")).toBe("Men's Tee <3>");
    expect(decodeXml("<![CDATA[A & B]]>")).toBe("A & B");
  });

  it("drops an old price that is not above the price", () => {
    expect(parseOffer('<offer id="9"><name>x</name><url>u</url><price>10</price><oldprice>10</oldprice></offer>')?.oldPrice).toBeNull();
  });

  it("maps an offer through its top-level category, skipping the ones we do not take", () => {
    const roots = rootCategories([
      { id: "44", name: "Consumer Electronics", parentId: null },
      { id: "100", name: "Earphones", parentId: "44" },
      { id: "34", name: "Automobiles", parentId: null },
    ]);
    const offer = parseOffer(FEED.slice(FEED.indexOf('<offer id="1"'), FEED.indexOf("</offer>") + 8))!;
    expect(categoryFor(offer, roots, { "44": ["electronics"] })).toBe("electronics");
    expect(categoryFor({ ...offer, categoryId: "34" }, roots, { "44": ["electronics"] })).toBeNull();
  });

  it("shortens long titles at a word", () => {
    expect(shortTitle("one two three four", 11)).toBe("one two…");
    expect(shortTitle("short", 11)).toBe("short");
  });
});

describe("Selector", () => {
  const rules: SelectionRules = {
    quotas: { electronics: 2 },
    minPrice: 2,
    maxPrice: 40,
    minDiscountPct: 10,
    maxDiscountPct: 85,
    maxPerShop: 1,
  };
  const offer = (id: string, price: number, oldPrice: number | null, shopId = id) => ({
    id,
    name: id,
    url: `u${id}`,
    price,
    oldPrice,
    currency: "USD",
    categoryId: "44",
    pictures: ["p"],
    vendor: null,
    params: { shopId },
    available: null,
    extra: {},
  });

  it("keeps the best discounts within the price and discount rules, per seller and quota", () => {
    const selector = new Selector(rules);
    selector.add(offer("a", 10, 20), "electronics"); // 50 %
    selector.add(offer("b", 10, 40, "a"), "electronics"); // 75 %, same seller as a
    selector.add(offer("c", 10, 12.5), "electronics"); // 20 %
    selector.add(offer("d", 50, 100), "electronics"); // too dear
    selector.add(offer("e", 10, 10.5), "electronics"); // 5 %: too small
    selector.add(offer("f", 1, 100), "electronics"); // 99 %: not believable, and too cheap
    selector.add(offer("g", 10, 20), "beauty"); // no quota
    selector.add(offer("h", 10, 20), null); // not our category
    expect(selector.result().map((c) => c.offer.id)).toEqual(["b", "c"]);
  });

  it("measures the discount from the old price", () => {
    expect(discountOf(offer("x", 7.5, 10))).toBe(25);
    expect(discountOf(offer("x", 7.5, null))).toBe(0);
  });
});

describe("The Luxury Closet", () => {
  const store = ADMITAD_FEED_STORES.find((s) => s.id === "the-luxury-closet")!;
  const item = (extra: Record<string, string>, available: boolean | null = true) => ({
    id: "1",
    name: "Chanel Classic Flap Bag",
    url: "u",
    price: 2000,
    oldPrice: null,
    currency: "USD",
    categoryId: "x",
    pictures: ["p"],
    vendor: "Chanel",
    params: {},
    available,
    extra: { categories: "Women, Women's Handbags, Shoulder Bags", ...extra },
  });

  it("takes in-stock items in top condition, with their earlier price, else the price new", () => {
    expect(store.prepare!(item({ custom_label_4: "Excellent", pre_offer_price: "2378 USD", orp: "7007 USD" }))?.oldPrice).toBe(2378);
    expect(store.prepare!(item({ custom_label_4: "Pristine", orp: "7007 USD" }))?.oldPrice).toBe(7007);
    expect(store.prepare!(item({ custom_label_4: "Good", orp: "7007 USD" }))).toBeNull();
    expect(store.prepare!(item({ custom_label_4: "Excellent" }))).toBeNull();
    expect(store.prepare!(item({ custom_label_4: "Excellent", orp: "7007 USD" }, false))).toBeNull();
  });

  it("places items by their category path and skips kids", () => {
    expect(store.categoryOf!(item({}))).toBe("bags");
    expect(store.categoryOf!({ ...item({ categories: "Women, Women's Shoes, Pumps" }), name: "Dior Pumps" })).toBe("shoes");
    expect(store.categoryOf!(item({ categories: "Kids, Girls, Dresses" }))).toBeNull();
  });
});
