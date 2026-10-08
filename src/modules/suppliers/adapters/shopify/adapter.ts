import { detectCategory, type CategorySlug } from "@/config/categories";
import { isCurrencyCode, type CurrencyCode } from "@/config/currencies";
import { toMinor } from "@/lib/money";
import { articleNumberOf, detectBrand } from "@/modules/catalog/normalizers/fashion";
import { parsePhoneTitle } from "@/modules/catalog/normalizers/phones";
import { PoliteClient, Throttle } from "../../http";
import { RobotsPolicy } from "../../robots";
import { sizesFromShopify } from "../../sizes";
import type { AdapterContext, RawOffer, Reliability, SupplierAdapter, SupplierDefinition } from "../../types";

/**
 * One adapter for every store built on Shopify. Those stores publish their
 * catalog as JSON at /products.json, so connecting another one is a single
 * entry in ./stores.ts — no new code.
 */
export interface ShopifyStore {
  id: string;
  name: string;
  domain: string;
  /** Where parcels ship from; decides forwarder cost and delivery time. */
  originCountry: string;
  currency: CurrencyCode;
  /** Where products go; for a store that sells several kinds, where the rest go. */
  category: CategorySlug;
  /** Other categories the store sells (a sneaker shop's bags and T-shirts), recognised by title and product type. */
  mixedWith?: CategorySlug[];
  reliability: Reliability;
  /** The store lists Azerbaijan among the countries it ships to. */
  shipsToMarket: boolean;
  /** Set for single-brand stores whose `vendor` field is unreliable. */
  brand?: string;
}

/**
 * Shopify limits us as one visitor across all of its stores, so every store
 * shares this queue: one request at a time, platform-wide.
 */
const SHOPIFY_DELAY_MS = 2500;
const shopifyThrottle = new Throttle(SHOPIFY_DELAY_MS);

const PAGE_SIZE = 250;
const MAX_PAGES = 2;
const LIST_PATH = "/products.json";

/** Things a store lists as "products" that are not goods anyone compares prices on. */
const NOT_A_PRODUCT = /gift\s?card|e-?gift|warranty|protection plan|insurance|reservation|deposit|donation|free gift|\bsample\b|shipping fee|price adjust|replacement part|refurbished|renewed|spare part|scratch and dent|open[- ]box|pre-?owned|membership|app only|live only/i;
const MIN_PRICE = 3;

interface ShopifyVariant {
  sku?: string | null;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  price: string;
  compare_at_price: string | null;
  available: boolean;
  grams: number;
}

export interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  vendor: string;
  product_type: string;
  variants: ShopifyVariant[];
  /** "Size", "Color"…; variant.option1/2/3 hold the values in this order. */
  options?: { name: string; position?: number }[];
  images: { src: string }[];
}

export function toRawOffer(product: ShopifyProduct, store: ShopifyStore): RawOffer | null {
  if (!product.title || NOT_A_PRODUCT.test(`${product.title} ${product.product_type}`)) return null;

  // One offer per product: the cheapest variant that can actually be bought.
  const byPrice = [...product.variants].sort((a, b) => Number(a.price) - Number(b.price));
  const variant = byPrice.find((v) => v.available) ?? byPrice[0];
  const price = Number(variant?.price);
  if (!variant || !(price >= MIN_PRICE)) return null;

  const category = categoryOf(product, store);
  const vendor = product.vendor?.trim() || store.name;
  // Retailers spell vendors their own way ("ADIDAS"); use one spelling for brands we know.
  const brand = store.brand ?? (category === "electronics" ? vendor : (detectBrand(vendor) ?? vendor));
  const phone = category === "electronics" ? parsePhoneTitle(`${brand} ${product.title}`) : null;
  const cleanPhone = phone && /^[\w\s+./-]+$/.test(phone.model) ? phone : null;
  const compareAt = Number(variant.compare_at_price);

  return {
    externalId: String(product.id),
    url: `https://${store.domain}/products/${product.handle}`,
    title: product.title,
    brand: cleanPhone?.brand ?? brand,
    model: cleanPhone?.model ?? stripBrand(product.title, brand),
    mpn: articleNumberOf(brand, [variant.sku, product.title], category) ?? undefined,
    categorySlug: category,
    productType: product.product_type || undefined,
    imageUrl: thumbnail(product.images[0]?.src),
    priceMinor: toMinor(price),
    currency: store.currency,
    listPriceMinor: compareAt > price ? toMinor(compareAt) : undefined,
    // The JSON has no shipping price; the landed-cost module estimates it by weight and origin.
    shippingMinor: null,
    weightKg: variant.grams > 0 ? variant.grams / 1000 : undefined,
    inStock: variant.available,
    sizes: sizesFromShopify(product.options, product.variants),
  };
}

function categoryOf(product: ShopifyProduct, store: ShopifyStore): CategorySlug {
  if (!store.mixedWith) return store.category;
  // "… by Shoe Palace" says nothing about the product.
  const text = `${product.title} ${product.product_type}`.replaceAll(store.name, " ");
  return detectCategory([store.category, ...store.mixedWith], text) ?? store.category;
}

/** Shopify's CDN resizes on request; originals are often several megabytes. */
function thumbnail(src: string | undefined): string | undefined {
  if (!src) return undefined;
  return `${src}${src.includes("?") ? "&" : "?"}width=600`;
}

function stripBrand(title: string, brand: string): string {
  const stripped = title.toLowerCase().startsWith(brand.toLowerCase()) ? title.slice(brand.length) : title;
  return stripped.replace(/^[\s|:–-]+/, "").trim() || title;
}

/**
 * Shopify stores with "Markets" price each visitor in their own currency:
 * from Azerbaijan, /products.json can come back in AZN although the store's
 * currency is USD, and some stores serve USD while listing EUR (Nordgreen).
 * Every response says which currency it is priced in, in its `cart_currency`
 * cookie, so prices are saved in that currency, never assumed. A currency we
 * cannot convert fails the run rather than save wrong prices.
 */
export function servedCurrency(headers: Headers, fallback: CurrencyCode): CurrencyCode {
  const cookies = headers.getSetCookie?.() ?? [headers.get("set-cookie") ?? ""];
  const currency = cookies.map((cookie) => /(?:^|[;,\s])cart_currency=([A-Z]{3})/.exec(cookie)?.[1]).find(Boolean);
  if (!currency) return fallback;
  if (!isCurrencyCode(currency)) throw new Error(`Prices come in ${currency}, which we cannot convert; not saved`);
  return currency;
}

export function createShopifyAdapter(store: ShopifyStore): SupplierAdapter {
  const origin = `https://${store.domain}`;

  const definition: SupplierDefinition = {
    id: store.id,
    name: store.name,
    scope: "global",
    originCountry: store.originCountry,
    currency: store.currency,
    websiteUrl: origin,
    trustScore: store.reliability.basis === "official-brand-store" ? 86 : 82,
    integration: "feed",
    categories: [store.category, ...(store.mixedWith ?? [])],
    reliability: store.reliability,
    shipsToMarket: store.shipsToMarket,
    access: {
      kind: "shopify-json",
      summary: "The store runs on Shopify, which publishes the catalog as JSON at /products.json.",
      steps: [
        "GET /robots.txt and stop unless /products.json is allowed (checked on every run)",
        "All Shopify stores share one queue: one request every 2.5 s platform-wide; on HTTP 429 wait as told, retry once",
        `Prices are saved in the currency each response is served in (its cart_currency cookie; ${store.currency} if absent) — stores may price Azerbaijani visitors in AZN`,
        `GET /products.json?limit=${PAGE_SIZE}&page=1…${MAX_PAGES}`,
        "One offer per product, from its cheapest available variant",
        "Skip gift cards, warranties, samples and anything under the minimum price",
      ],
      entryPoints: [origin + LIST_PATH],
      fields: {
        externalId: "products[].id",
        title: "products[].title",
        brand: store.brand ? "fixed (single-brand store)" : "products[].vendor",
        price: "variants[].price (cheapest available variant)",
        listPrice: "variants[].compare_at_price when above the price",
        inStock: "variants[].available",
        weight: "variants[].grams",
        image: "products[].images[0].src",
        url: "/products/ + products[].handle",
        currency: "fixed per store, read once from /meta.json",
      },
      robots: { checkedOn: "2026-09-30", notes: "/products.json allowed when connected; re-checked on every run." },
      politeness: { delayMs: SHOPIFY_DELAY_MS, maxRequestsPerRun: MAX_PAGES + 1 },
      liveSearch: { supported: false, reason: "Shopify stores disallow /search in robots.txt." },
      assumptions: [
        `Only the first ${PAGE_SIZE * MAX_PAGES} products are read; larger catalogs are covered partially.`,
        store.shipsToMarket
          ? "The store lists Azerbaijan as a shipping destination, but its shipping price is unknown; a forwarder estimate is used."
          : "The store does not ship to Azerbaijan directly; delivery is assumed through a freight forwarder.",
        "Prices are the store's base-currency prices.",
      ],
    },
  };

  return {
    definition,

    async fetchCatalog(ctx: AdapterContext): Promise<RawOffer[]> {
      const { delayMs, maxRequestsPerRun } = definition.access.politeness;
      const client = new PoliteClient({
        delayMs,
        maxRequests: maxRequestsPerRun,
        signal: ctx.signal,
        throttle: shopifyThrottle,
      });

      const robots = await RobotsPolicy.fetch(origin, client);
      if (!robots.allows(LIST_PATH)) throw new Error("robots.txt no longer allows /products.json");
      const offers: RawOffer[] = [];

      for (let page = 1; page <= MAX_PAGES; page++) {
        const response = await client.get(`${origin}${LIST_PATH}?limit=${PAGE_SIZE}&page=${page}`);
        if (response.status !== 200) throw new Error(`HTTP ${response.status} for ${origin}${LIST_PATH}`);
        const body = JSON.parse(response.text);
        const served = { ...store, currency: servedCurrency(response.headers, store.currency) };
        const products: ShopifyProduct[] = body.products ?? [];
        for (const product of products) {
          const offer = toRawOffer(product, served);
          if (offer) offers.push(offer);
        }
        if (products.length < PAGE_SIZE) {
          // A short page is the last one: the whole catalog was read.
          ctx.listedEverything?.();
          break;
        }
      }
      return offers;
    },

    async search(): Promise<RawOffer[]> {
      return [];
    },
  };
}
