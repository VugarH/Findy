import { toMinor } from "@/lib/money";
import { parsePhoneTitle } from "@/modules/catalog/normalizers/phones";
import { decodeHtml, PoliteClient } from "../http";
import type { AdapterContext, RawOffer, SupplierAdapter, SupplierDefinition } from "../types";

const ORIGIN = "https://soliton.az";

/** Add a line to cover another section of the store. */
const SECTIONS = [
  {
    sitemap: "/sitemap-products-telefon.xml",
    listing: "/az/telefon/mobil-telefonlar/",
    urlContains: "/mobil-telefonlar/",
    categorySlug: "electronics" as const,
  },
];

const definition: SupplierDefinition = {
  id: "soliton",
  name: "Soliton",
  scope: "local",
  originCountry: "AZ",
  currency: "AZN",
  websiteUrl: ORIGIN,
  trustScore: 82,
  integration: "crawler",
  categories: ["electronics"],
  access: {
    kind: "sitemap-meta-tags",
    summary:
      "Product URLs come from the store's XML sitemap; each product page states price, brand and stock in OpenGraph product meta tags.",
    steps: [
      "GET /sitemap-products-telefon.xml and keep URLs under /mobil-telefonlar/ (newest first; the id starts with the listing date)",
      "GET the section listing page for the 15 newest products — the sitemap can lag behind by weeks",
      "GET each product page and read the <meta property=\"product:*\"> / og:* tags",
      "Stop at the per-run request cap; the newest products are always covered first",
    ],
    entryPoints: SECTIONS.flatMap((section) => [ORIGIN + section.sitemap, ORIGIN + section.listing]),
    fields: {
      externalId: "meta product:retailer_item_id",
      title: "meta og:title",
      brand: "meta product:brand (model is parsed from the title)",
      price: "meta product:price:amount",
      listPrice: "span.creditPrice on the page, when it is above the cash price",
      inStock: "meta product:availability == \"in stock\"",
      image: "meta og:image (first)",
    },
    robots: {
      checkedOn: "2026-09-30",
      notes:
        "Allow: / for all agents. Disallowed and not used: /ajax-requests.php (so \"load more\" pagination is off-limits), /search.php, /basket.php.",
    },
    politeness: { delayMs: 500, maxRequestsPerRun: 340 },
    liveSearch: { supported: false, reason: "The store's search endpoint is disallowed by robots.txt." },
    assumptions: [
      "\"creditPrice\" (the instalment price) is treated as the store's regular price.",
      "Delivery is taken as free, 1–3 days; product pages do not state delivery cost.",
      "The sitemap was last regenerated on 2026-07-07 when checked, so products listed after that are only seen via the listing page.",
    ],
  },
};

const meta = (html: string, property: string): string | null => {
  const match = new RegExp(`<meta property="${property}" content="([^"]*)"`).exec(html);
  return match ? decodeHtml(match[1]).trim() : null;
};

export function parseProductPage(html: string, url: string, categorySlug: RawOffer["categorySlug"]): RawOffer | null {
  const title = meta(html, "og:title");
  const price = Number(meta(html, "product:price:amount"));
  const externalId = meta(html, "product:retailer_item_id");
  if (!title || !externalId || !(price > 0) || meta(html, "product:price:currency") !== "AZN") return null;

  const phone = parsePhoneTitle(title);
  if (!phone) return null;

  const credit = Number(/class="creditPrice">\s*([\d.]+)/.exec(html)?.[1]);
  return {
    externalId,
    url,
    title,
    brand: phone.brand,
    model: phone.model,
    categorySlug,
    productType: "smartphone",
    imageUrl: meta(html, "og:image") ?? undefined,
    priceMinor: toMinor(price),
    currency: "AZN",
    listPriceMinor: credit > price ? toMinor(credit) : undefined,
    shippingMinor: 0,
    weightKg: 0.4,
    inStock: meta(html, "product:availability") === "in stock",
    deliveryDays: { min: 1, max: 3 },
    attributes: phone.color ? { color: phone.color } : undefined,
  };
}

export function productUrlsFromSitemap(xml: string, urlContains: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((url) => url.includes(urlContains));
}

export function productUrlsFromListing(html: string, urlContains: string): string[] {
  return [...html.matchAll(/href="(\/az\/[^"]+\.html)" class="prodTitle"/g)]
    .map((m) => ORIGIN + m[1])
    .filter((url) => url.includes(urlContains));
}

/** Product ids begin with the listing timestamp, so a descending sort is newest first. */
const idOf = (url: string) => /\/(\d{10,})-/.exec(url)?.[1] ?? "";

export const solitonAdapter: SupplierAdapter = {
  definition,

  async fetchCatalog(ctx: AdapterContext): Promise<RawOffer[]> {
    const { delayMs, maxRequestsPerRun } = definition.access.politeness;
    const client = new PoliteClient({ delayMs, maxRequests: maxRequestsPerRun, signal: ctx.signal });
    const offers: RawOffer[] = [];

    for (const section of SECTIONS) {
      const fromSitemap = productUrlsFromSitemap(await client.getText(ORIGIN + section.sitemap), section.urlContains);
      const fromListing = productUrlsFromListing(await client.getText(ORIGIN + section.listing), section.urlContains);
      const urls = [...new Set([...fromListing, ...fromSitemap])].sort((a, b) => idOf(b).localeCompare(idOf(a)));

      let failures = 0;
      for (const url of urls) {
        if (client.budgetLeft <= 0) break;
        try {
          const offer = parseProductPage(await client.getText(url), url, section.categorySlug);
          if (offer) offers.push(offer);
        } catch (error) {
          // A removed product (404) is normal; a run of failures means we are being refused.
          if (++failures > 10) throw error;
        }
      }
    }
    return offers;
  },

  async search(): Promise<RawOffer[]> {
    return [];
  },
};
