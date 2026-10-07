import { toMinor } from "@/lib/money";
import { parseElectronicsTitle } from "@/modules/catalog/normalizers/electronics";
import { decodeHtml, PoliteClient } from "../http";
import type { AdapterContext, RawOffer, SupplierAdapter, SupplierDefinition } from "../types";

const ORIGIN = "https://w-t.az";

/** Sections we collect. `productType` helps pick the subcategory. */
const SECTIONS = [
  { path: "/k2+mobil-telefonlar", productType: "smartphone" },
  { path: "/k3+plansetler", productType: "tablet" },
  { path: "/k20+smart-saatlar", productType: "smartwatch" },
  { path: "/k55+simsiz-qulaqliqlar", productType: "headphones" },
  { path: "/k6+notbuklar", productType: "laptop" },
  { path: "/k67+oyun-konsollari-ve-oyunlar", productType: "game console" },
] as const;

const definition: SupplierDefinition = {
  id: "world-telecom",
  name: "World Telecom",
  scope: "local",
  originCountry: "AZ",
  currency: "AZN",
  websiteUrl: ORIGIN,
  trustScore: 80,
  integration: "crawler",
  categories: ["electronics"],
  access: {
    kind: "html",
    summary: "Section pages list products as HTML cards; each brand within a section has its own page.",
    steps: [
      "GET a section page, e.g. /k2+mobil-telefonlar (first 20 products)",
      "Collect the brand links on it (/k2+mobil-telefonlar/apple+m2 …) and GET each brand page",
      "Read every product card: name, price, link and image; de-duplicate by product id (+p1234 in the URL)",
    ],
    entryPoints: SECTIONS.map((section) => ORIGIN + section.path),
    fields: {
      externalId: "the number after +p in the product URL",
      title: "div.productName",
      price: "span.realPrice (whole part + <sup> decimals)",
      image: "img.productImage-img",
      "brand, model": "parsed from the title",
      listPrice: "not available — the cards show no previous price",
      inStock: "assumed: only listed products are shown",
    },
    robots: { checkedOn: "2026-09-30", notes: "robots.txt has an empty Disallow: everything is allowed." },
    politeness: { delayMs: 1000, maxRequestsPerRun: 90 },
    liveSearch: { supported: false, reason: "Not evaluated; the catalog is collected daily instead." },
    assumptions: [
      "A page shows at most 20 products and the rest load through a script endpoint we do not call, so brands with more than 20 products in a section are covered partially.",
      "Delivery is taken as free, 1–3 days.",
    ],
  },
};

const CARD =
  /class="productImage-img" src="([^"]+)"[\s\S]*?<a href="([^"]+\+p(\d+))" class="productUrl">\s*<div class="productName">([^<]+)<\/div>[\s\S]*?<span class="realPrice">\s*([\d\s]+)<sup>([.\d]*)<\/sup>/g;

export function parseCards(html: string, productType: string): RawOffer[] {
  const offers: RawOffer[] = [];
  for (const [, image, url, id, rawTitle, whole, decimals] of html.matchAll(CARD)) {
    const title = decodeHtml(rawTitle).trim();
    const price = Number(`${whole.replace(/\s/g, "")}${decimals || ""}`);
    const parsed = parseElectronicsTitle(title);
    if (!parsed || !(price > 0)) continue;

    offers.push({
      externalId: id,
      url,
      title,
      brand: parsed.brand,
      model: parsed.model,
      categorySlug: "electronics",
      productType,
      imageUrl: image,
      priceMinor: toMinor(price),
      currency: "AZN",
      shippingMinor: 0,
      inStock: true,
      deliveryDays: { min: 1, max: 3 },
      attributes: parsed.color ? { color: parsed.color } : undefined,
    });
  }
  return offers;
}

/** Brand pages of a section: /k2+mobil-telefonlar/apple+m2 */
export function brandLinks(html: string, sectionPath: string): string[] {
  const escaped = sectionPath.replace(/[+]/g, "\\+");
  const pattern = new RegExp(`href="(${ORIGIN.replace(/\./g, "\\.")}${escaped}/[a-z0-9-]+\\+m\\d+)"`, "g");
  return [...new Set([...html.matchAll(pattern)].map((match) => match[1]))];
}

export const worldTelecomAdapter: SupplierAdapter = {
  definition,

  async fetchCatalog(ctx: AdapterContext): Promise<RawOffer[]> {
    const { delayMs, maxRequestsPerRun } = definition.access.politeness;
    const client = new PoliteClient({ delayMs, maxRequests: maxRequestsPerRun, signal: ctx.signal });
    const byId = new Map<string, RawOffer>();
    const collect = (html: string, productType: string) => {
      for (const offer of parseCards(html, productType)) byId.set(offer.externalId, offer);
    };

    for (const section of SECTIONS) {
      if (client.budgetLeft <= 0) break;
      const sectionHtml = await client.getText(ORIGIN + section.path);
      collect(sectionHtml, section.productType);

      for (const link of brandLinks(sectionHtml, section.path)) {
        if (client.budgetLeft <= 0) break;
        try {
          collect(await client.getText(link), section.productType);
        } catch {
          // One brand page failing should not lose the rest of the store.
        }
      }
    }
    return [...byId.values()];
  },

  async search(): Promise<RawOffer[]> {
    return [];
  },
};
