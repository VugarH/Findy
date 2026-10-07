import { decodeHtml } from "../../http";
import { sizesFromStructuredVariants, type SizeOption } from "../../sizes";
import type { ListPriceSource } from "./list-price";

export { LIST_PRICE_SOURCES, type ListPriceSource } from "./list-price";

/**
 * Reading the schema.org Product that most store pages embed as JSON-LD for
 * search engines. It is a published standard, so one parser serves every store
 * that has it, whatever platform the store runs on.
 */
export interface StructuredProduct {
  name: string;
  brand: string | null;
  sku: string | null;
  mpn: string | null;
  gtin: string | null;
  image: string | null;
  price: number;
  currency: string | null;
  inStock: boolean;
  /** From a ProductGroup's variants, when they name their size. */
  sizes?: SizeOption[];
}

type Json = Record<string, unknown>;

/** The first schema.org Product (or ProductGroup) on a page, or null. */
export function readStructuredProduct(html: string): StructuredProduct | null {
  for (const block of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    const product = findProduct(parseJson(block[1]));
    if (product) {
      const parsed = toStructuredProduct(product);
      if (parsed) return parsed;
    }
  }
  return null;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // Raw line breaks inside strings are a common hand-written-template mistake.
    try {
      return JSON.parse(text.replace(/[\u0000-\u001f]+/g, " "));
    } catch {
      return null;
    }
  }
}

function typesOf(node: Json): string[] {
  const type = node["@type"];
  return (Array.isArray(type) ? type : [type]).filter((t): t is string => typeof t === "string");
}

function findProduct(data: unknown): Json | null {
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findProduct(item);
      if (found) return found;
    }
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const node = data as Json;
  if (typesOf(node).some((t) => t === "Product" || t === "ProductGroup")) return node;
  return node["@graph"] ? findProduct(node["@graph"]) : null;
}

function text(value: unknown): string | null {
  if (typeof value === "string") return decodeHtml(value).replace(/\s+/g, " ").trim() || null;
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object" && !Array.isArray(value)) return text((value as Json).name);
  return null;
}

/** "2534.35", 2534.35, "2.534,35" and "1,499.90" are all prices. */
export function parsePrice(value: unknown): number | null {
  if (typeof value === "number") return value > 0 ? value : null;
  if (typeof value !== "string") return null;
  let clean = value.replace(/[^\d.,]/g, "");
  if (clean.includes(",") && clean.includes(".")) {
    // Whichever separator comes last is the decimal one.
    clean = clean.lastIndexOf(",") > clean.lastIndexOf(".") ? clean.replace(/\./g, "").replace(",", ".") : clean.replace(/,/g, "");
  } else if (clean.includes(",")) {
    clean = /,\d{1,2}$/.test(clean) ? clean.replace(",", ".") : clean.replace(/,/g, "");
  }
  const price = Number(clean);
  return price > 0 ? price : null;
}

function firstImage(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return firstImage(value[0]);
  if (value && typeof value === "object") return firstImage((value as Json).url ?? (value as Json).contentUrl);
  return null;
}

interface OfferInfo {
  price: number;
  currency: string | null;
  inStock: boolean;
}

/** Cheapest offer that can be bought; Offer, Offer[] and AggregateOffer all occur. */
function readOffers(value: unknown): OfferInfo | null {
  const list = (Array.isArray(value) ? value : [value]).filter((o): o is Json => !!o && typeof o === "object");
  const offers: OfferInfo[] = [];
  for (const offer of list) {
    const price = parsePrice(offer.price) ?? parsePrice(offer.lowPrice) ?? parsePrice((offer.priceSpecification as Json)?.price);
    if (price === null) continue;
    const availability = String(offer.availability ?? "");
    offers.push({
      price,
      currency: text(offer.priceCurrency)?.toUpperCase() ?? null,
      inStock: !/OutOfStock|SoldOut|Discontinued/i.test(availability),
    });
  }
  const sorted = offers.sort((a, b) => Number(b.inStock) - Number(a.inStock) || a.price - b.price);
  return sorted[0] ?? null;
}

function toStructuredProduct(node: Json): StructuredProduct | null {
  const name = text(node.name);
  // A ProductGroup carries its prices on the variants.
  const variants = Array.isArray(node.hasVariant) ? (node.hasVariant as Json[]) : [];
  const offer = readOffers(node.offers) ?? readOffers(variants.flatMap((v) => (Array.isArray(v.offers) ? v.offers : [v.offers])));
  if (!name || !offer) return null;

  const gtin = [node.gtin13, node.gtin12, node.gtin14, node.gtin8, node.gtin]
    .map((g) => (typeof g === "string" || typeof g === "number" ? String(g).replace(/\D/g, "") : ""))
    .find((g) => g.length >= 8 && g.length <= 14);

  return {
    name,
    brand: text(node.brand),
    sku: text(node.sku),
    mpn: text(node.mpn),
    gtin: gtin ?? null,
    image: firstImage(node.image),
    price: offer.price,
    currency: offer.currency,
    inStock: offer.inStock,
    sizes: sizesFromStructuredVariants(variants),
  };
}

const LIST_PRICE_PATTERNS: Record<Exclude<ListPriceSource, "ga4-discount">, RegExp> = {
  "retail-price": /\\?"retail_price\\?"\s*:\s*\\?"?([\d.]+)/,
  "old-price-json": /"oldPrice"\s*:\s*"?([\d.]+)/,
  "old-price-field": /"old_price"\s*:\s*"?([\d.]+)/,
};

/** A crossed-out price must be above the price, and not absurdly so (that would be another product's). */
const MAX_LIST_RATIO = 5;

export function readListPrice(html: string, price: number, source: ListPriceSource | undefined): number | null {
  if (!source) return null;
  let listPrice: number | null = null;
  if (source === "ga4-discount") {
    const discount = parsePrice(/["']discount["']\s*:\s*["']?([\d.]+)/.exec(html)?.[1]);
    listPrice = discount ? price + discount : null;
  } else {
    listPrice = parsePrice(LIST_PRICE_PATTERNS[source].exec(html)?.[1]);
  }
  return listPrice && listPrice > price * 1.01 && listPrice < price * MAX_LIST_RATIO ? Math.round(listPrice * 100) / 100 : null;
}

export interface SitemapEntry {
  url: string;
  lastmod: string | null;
}

/** <loc> (and <lastmod>) of each <url> or <sitemap> entry. */
export function readSitemap(xml: string): { isIndex: boolean; entries: SitemapEntry[] } {
  const isIndex = /<sitemapindex[\s>]/i.test(xml);
  const entries: SitemapEntry[] = [];
  for (const block of xml.matchAll(/<(?:url|sitemap)>([\s\S]*?)<\/(?:url|sitemap)>/gi)) {
    const loc = /<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)/i.exec(block[1])?.[1];
    if (!loc) continue;
    const lastmod = /<lastmod>\s*([^<\s]+)/i.exec(block[1])?.[1] ?? null;
    entries.push({ url: decodeHtml(loc), lastmod });
  }
  return { isIndex, entries };
}

/**
 * The product pages to read this run: focus brands first, then the most
 * recently changed. The list is the same from day to day (it moves only as
 * the store adds and edits products), so every product we show is re-checked
 * daily — a product read only once would expire and vanish two days later.
 */
export function pickProductUrls(entries: SitemapEntry[], options: { limit: number; focus?: RegExp }): string[] {
  const { limit, focus } = options;
  const unique = [...new Map(entries.map((e) => [e.url, e])).values()];
  const ranked = unique.sort(
    (a, b) =>
      Number(!!focus && focus.test(b.url)) - Number(!!focus && focus.test(a.url)) ||
      (b.lastmod ?? "").localeCompare(a.lastmod ?? ""),
  );
  return ranked.slice(0, limit).map((e) => e.url);
}
