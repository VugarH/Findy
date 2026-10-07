import { describe, expect, it } from "vitest";
import type { DigestItem } from "@/db/schema";
import en from "@/i18n/dictionaries/en";
import { digestPost, dropAlertMessage, newDealsMessage, escapeHtml, flag, MESSAGE_LIMIT, shorten, type MessageContext } from "./format";

const ctx: MessageContext = {
  t: en,
  money: (minor) => `${(minor / 100).toFixed(2)} ₼`,
  url: (path) => `https://serfeli.az/en${path}`,
};

const item = (overrides: Partial<DigestItem> = {}): DigestItem => ({
  productId: "p1",
  slug: "nike-pegasus",
  title: "Nike Air Zoom Pegasus 41",
  brand: "Nike",
  categorySlug: "shoes",
  imageUrl: "https://cdn.example.com/pegasus.jpg",
  originCountry: "TR",
  scope: "global",
  supplierName: "Nike TR",
  landedMinor: 12_900,
  usualLandedMinor: 18_900,
  discountPct: 32,
  savingsMinor: 6_000,
  verified: true,
  ...overrides,
});

describe("Telegram text helpers", () => {
  it("escapes what Telegram's HTML treats as markup", () => {
    expect(escapeHtml(`Tom & Jerry <3 "x"`)).toBe("Tom &amp; Jerry &lt;3 &quot;x&quot;");
  });

  it("turns a country code into its flag", () => {
    expect(flag("TR")).toBe("🇹🇷");
    expect(flag("")).toBe("");
  });

  it("shortens long titles", () => {
    expect(shorten("a  b   c", 10)).toBe("a b c");
    expect(shorten("abcdefghij", 5)).toBe("abcd…");
  });
});

describe("digestPost", () => {
  const day = { key: "2026-10-06", label: "Tuesday, 6 October" };

  it("lists each deal with its link, price, old price, discount and store", () => {
    const post = digestPost([item(), item({ productId: "p2", slug: "b", title: "<Bag>", verified: false })], day, ctx);
    expect(post.html).toContain("Today's top 2 deals");
    expect(post.html).toContain('1. <a href="https://serfeli.az/en/product/nike-pegasus">Nike Air Zoom Pegasus 41</a>');
    expect(post.html).toContain("<b>129.00 ₼</b> <s>189.00 ₼</s> · −32% · 🇹🇷 Nike TR");
    expect(post.html).toContain("&lt;Bag&gt;");
    expect(post.html).toContain("−32% (store's discount)");
    expect(post.previewUrl).toBe("https://cdn.example.com/pegasus.jpg");
    expect(post.button.url).toBe("https://serfeli.az/en/top?day=2026-10-06");
  });

  it("always fits in one message", () => {
    const items = Array.from({ length: 10 }, (_, i) => item({ productId: `p${i}`, slug: "x".repeat(200), title: "Long ".repeat(60) }));
    expect(digestPost(items, day, ctx).html.length).toBeLessThanOrEqual(MESSAGE_LIMIT);
  });
});

describe("dropAlertMessage", () => {
  const drop = { title: "Pegasus", slug: "pegasus", store: "Nike TR", oldPriceMinor: 15_000, newPriceMinor: 12_000, pct: 20 };

  it("writes one drop with its own heading", () => {
    const html = dropAlertMessage([drop], ctx);
    expect(html).toContain("<b>Price dropped 20%</b>");
    expect(html).toContain("Dropped 20%: now 120.00 ₼ at Nike TR, was 150.00 ₼.");
    expect(html).toContain('<a href="https://serfeli.az/en/alerts">Your price alerts</a>');
  });

  it("groups many drops into one message and points to the site for the rest", () => {
    const html = dropAlertMessage(Array.from({ length: 11 }, () => drop), ctx);
    expect(html).toContain("11 products you watch got cheaper");
    expect(html).toContain("…and 3 more on the site.");
    expect(html.match(/\/product\/pegasus/g)).toHaveLength(8);
  });
});

describe("newDealsMessage", () => {
  it("groups the new deals under what the person follows", () => {
    const html = newDealsMessage(
      [
        {
          label: "adidas",
          deals: [{ title: "Adibreak Tee", slug: "tee", storeName: "Sneaks Up", landedMinor: 3_828, usualLandedMinor: 7_147, discountPct: 46 }],
        },
        {
          label: "Shoes & <more>",
          deals: [{ title: "Forum Low", slug: "forum", storeName: "Culture Kings", landedMinor: 11_668, usualLandedMinor: 22_657, discountPct: 49 }],
        },
      ],
      ctx,
    );
    expect(html).toContain("New deals from what you follow");
    expect(html).toContain("<b>adidas</b>\n• <a href=\"https://serfeli.az/en/product/tee\">Adibreak Tee</a>");
    expect(html).toContain("<b>38.28 ₼</b> <s>71.47 ₼</s> · −46% · Sneaks Up");
    expect(html).toContain("<b>Shoes &amp; &lt;more&gt;</b>");
    expect(html).toContain('href="https://serfeli.az/en/alerts#follows"');
  });
});
