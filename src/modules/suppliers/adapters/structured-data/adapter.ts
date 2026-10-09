import { detectCategory, type CategorySlug } from "@/config/categories";
import type { CurrencyCode } from "@/config/currencies";
import { toMinor } from "@/lib/money";
import { parseElectronicsTitle } from "@/modules/catalog/normalizers/electronics";
import { articleNumberOf, detectBrand, sameBrand, stripBrand } from "@/modules/catalog/normalizers/fashion";
import { PoliteClient } from "../../http";
import { RobotsPolicy } from "../../robots";
import { readEmbeddedSizes } from "../../sizes";
import type { AdapterContext, RawOffer, Reliability, SupplierAdapter, SupplierDefinition } from "../../types";
import {
  pickProductUrls,
  readListPrice,
  readSitemap,
  readStructuredProduct,
  type ListPriceSource,
  type SitemapEntry,
} from "./parse";

/**
 * One adapter for every store whose product pages carry schema.org Product
 * data (JSON-LD) and whose sitemap lists those pages. Connecting another such
 * store is a single entry in ./stores.ts — no new code.
 */
export interface StructuredDataStore {
  id: string;
  name: string;
  /** Scheme + host, e.g. "https://www.superstep.com.tr". */
  origin: string;
  originCountry: string;
  currency: CurrencyCode;
  reliability: Reliability;
  /** The store lists Azerbaijan among the countries it ships to. */
  shipsToMarket: boolean;
  /** Categories this store's products may go to; a product that fits none is skipped. */
  categories: CategorySlug[];
  /** For a store whose every product belongs to one category even when its title does not say so. */
  fallbackCategory?: CategorySlug;
  /** Sitemap (or sitemap index) that lists the product pages. */
  sitemap: string;
  /** In a sitemap index: which child sitemaps list products. */
  productSitemaps?: RegExp;
  /** Which URLs are product pages. */
  productUrl: RegExp;
  /** Product URLs read first: brands people in Azerbaijan look for most. */
  focus?: RegExp;
  /** Single-brand store: the brand of every product. */
  brand?: string;
  /** The store fills Product.brand with something else (Troy names Apple on a JBL speaker): read the brand from the title first. */
  brandFromTitle?: boolean;
  /** Where the crossed-out price is on product pages, if the store shows one. */
  listPrice?: ListPriceSource;
  /** Product pages read per run (one request each). */
  productsPerRun?: number;
}

const DELAY_MS = 1500;
/** Some stores build their multi-megabyte product sitemap on request (Colin's takes ~40 s). */
const TIMEOUT_MS = 90_000;
const DEFAULT_PRODUCTS_PER_RUN = 300;
/** Child sitemaps read per run; very large catalogs are covered across their first files. */
const MAX_SITEMAPS = 6;
/** More failures than this in one run means the store is refusing us, not that a page was removed. */
const MAX_FAILURES = 15;

export function createStructuredDataAdapter(store: StructuredDataStore): SupplierAdapter {
  const perRun = store.productsPerRun ?? DEFAULT_PRODUCTS_PER_RUN;
  const maxRequests = 1 + 1 + MAX_SITEMAPS + perRun;

  const definition: SupplierDefinition = {
    id: store.id,
    name: store.name,
    scope: store.originCountry === "AZ" ? "local" : "global",
    originCountry: store.originCountry,
    currency: store.currency,
    websiteUrl: store.origin,
    trustScore: store.reliability.basis === "official-brand-store" ? 86 : 84,
    integration: "crawler",
    categories: store.categories,
    reliability: store.reliability,
    shipsToMarket: store.shipsToMarket,
    access: {
      kind: "sitemap-json-ld",
      summary:
        "Product URLs come from the store's XML sitemap; each product page describes itself in schema.org Product data (JSON-LD) for search engines.",
      steps: [
        "GET /robots.txt and stop unless product pages are allowed (checked on every run)",
        `GET ${store.sitemap}${store.productSitemaps ? ` and the product sitemaps it lists (at most ${MAX_SITEMAPS})` : ""}`,
        `Keep URLs matching ${store.productUrl}${store.focus ? `; brands matching ${store.focus} first` : ""}, then the most recently changed`,
        `GET up to ${perRun} product pages, one every ${DELAY_MS / 1000} s — the same pages every day, so each listed price is re-checked daily`,
        "Read the schema.org Product: name, brand, sku/mpn, gtin, offers.price, priceCurrency, availability, image",
        "Sort each product into a category by its title; skip products that fit none of the store's categories",
      ],
      entryPoints: [store.origin + "/robots.txt", store.sitemap],
      fields: {
        externalId: "Product.sku (else the URL path)",
        title: "Product.name",
        brand: store.brand ? "fixed (single-brand store)" : "Product.brand, else recognised from the title",
        mpn: "the maker's article number, recognised in Product.mpn / sku / URL / name for brands with a known format",
        gtin: "Product.gtin13 / gtin12 / gtin14 / gtin8",
        price: "Product.offers.price (cheapest in-stock offer)",
        listPrice: store.listPrice ? `page data: ${store.listPrice}` : "not shown by the store",
        inStock: "Product.offers.availability",
        image: "Product.image (first)",
      },
      robots: { checkedOn: "2026-10-01", notes: "Product pages and sitemaps allowed when connected; re-checked on every run." },
      politeness: { delayMs: DELAY_MS, maxRequestsPerRun: maxRequests },
      liveSearch: { supported: false, reason: "Search pages are disallowed by robots.txt or not machine-readable." },
      assumptions: [
        store.shipsToMarket
          ? "The store ships to Azerbaijan, but its shipping price is unknown; a forwarder estimate is used."
          : "The store does not ship to Azerbaijan directly; delivery is assumed through a freight forwarder.",
        `The sitemap does not carry prices, so only ${perRun} products of a large catalog are tracked.`,
      ],
    },
  };

  return {
    definition,

    async fetchCatalog(ctx: AdapterContext): Promise<RawOffer[]> {
      const client = new PoliteClient({ delayMs: DELAY_MS, maxRequests, signal: ctx.signal, timeoutMs: TIMEOUT_MS });
      const robots = await RobotsPolicy.fetch(store.origin, client);
      const allowed = (url: string) => {
        const { pathname, search } = new URL(url);
        return robots.allows(pathname + search);
      };

      const entries = (await listProductPages(client, store)).filter(
        (entry) => store.productUrl.test(entry.url) && entry.url.startsWith(store.origin) && allowed(entry.url),
      );
      if (entries.length === 0) throw new Error("The sitemap lists no product pages we may read");

      const offers: RawOffer[] = [];
      let failures = 0;
      for (const url of pickProductUrls(entries, { limit: perRun, focus: store.focus })) {
        if (client.budgetLeft <= 0) break;
        try {
          const offer = toRawOffer(await client.getText(url), url, store);
          if (offer) offers.push(offer);
        } catch (error) {
          if (++failures > MAX_FAILURES) throw error;
        }
      }
      return offers;
    },

    async search(): Promise<RawOffer[]> {
      return [];
    },
  };
}

async function listProductPages(client: PoliteClient, store: StructuredDataStore): Promise<SitemapEntry[]> {
  const root = readSitemap(await client.getText(store.sitemap));
  if (!root.isIndex) return root.entries;

  const children = root.entries.filter((e) => !store.productSitemaps || store.productSitemaps.test(e.url)).slice(0, MAX_SITEMAPS);
  const entries: SitemapEntry[] = [];
  for (const child of children) {
    entries.push(...readSitemap(await client.getText(child.url)).entries);
  }
  return entries;
}

export function toRawOffer(html: string, url: string, store: StructuredDataStore): RawOffer | null {
  const product = readStructuredProduct(html);
  if (!product || (product.currency && product.currency !== store.currency)) return null;

  const path = new URL(url).pathname;
  const category =
    detectCategory(store.categories, `${product.name} ${path.replace(/[-_/]+/g, " ")}`) ?? store.fallbackCategory;
  if (!category) return null;

  // Multi-brand stores sometimes name themselves as the brand.
  const statedBrand =
    product.brand && !store.brandFromTitle && !sameBrand(product.brand, store.name) ? product.brand : null;
  const brand = store.brandFromTitle
    ? (detectBrand(product.name) ?? product.brand ?? undefined)
    : (store.brand ?? detectBrand(statedBrand ?? "") ?? statedBrand ?? detectBrand(product.name) ?? undefined);
  const listPrice = readListPrice(html, product.price, store.listPrice);
  // Electronics match other stores by brand + model ("Apple iPhone 17 Pro 256GB"), as everywhere else.
  const parsed =
    category === "electronics"
      ? parseElectronicsTitle(brand && !startsWithBrand(product.name, brand) ? `${brand} ${product.name}` : product.name)
      : null;

  return {
    externalId: product.sku ?? path,
    url,
    title: product.name,
    brand: parsed?.brand ?? brand,
    model: parsed?.model ?? (brand ? stripBrand(product.name, brand) : undefined),
    // Some stores use the barcode as their SKU.
    gtin: product.gtin ?? [product.sku, product.mpn].find(isGtin) ?? undefined,
    mpn: articleNumberOf(brand, [product.mpn, product.sku, path, product.name], category) ?? undefined,
    categorySlug: category,
    // Pages may give "//host/a.jpg" or "/a.jpg": made absolute against the page.
    imageUrl: absoluteUrl(product.image, url),
    priceMinor: toMinor(product.price),
    currency: store.currency,
    listPriceMinor: listPrice ? toMinor(listPrice) : undefined,
    shippingMinor: null,
    inStock: product.inStock,
    sizes: product.sizes ?? readEmbeddedSizes(html),
  };
}

function startsWithBrand(title: string, brand: string): boolean {
  return title.toLowerCase().startsWith(brand.toLowerCase());
}

/** An EAN-13 / UPC-A / GTIN-14 with a valid check digit. */
export function isGtin(value: string | null | undefined): value is string {
  if (!value || !/^\d{12,14}$/.test(value) || /^0+$/.test(value)) return false;
  const digits = [...value].map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((total, digit, i) => total + digit * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

function absoluteUrl(value: string | null, page: string): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value, page).toString();
  } catch {
    return undefined;
  }
}
