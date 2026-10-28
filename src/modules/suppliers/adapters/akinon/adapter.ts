import type { CategorySlug } from "@/config/categories";
import type { CurrencyCode } from "@/config/currencies";
import { PoliteClient } from "../../http";
import { RobotsPolicy } from "../../robots";
import type { AdapterContext, RawOffer, Reliability, SupplierAdapter, SupplierDefinition } from "../../types";
import { readListingPage, toRawOffer } from "./parse";

/**
 * Stores on the Akinon platform, read through their category pages: each page
 * lists ~48 products with prices and cart offers, so the whole catalog costs a
 * few hundred requests instead of one request per product.
 */
export interface AkinonStore {
  id: string;
  name: string;
  /** Scheme + host, e.g. "https://www.superstep.com.tr". */
  origin: string;
  originCountry: string;
  currency: CurrencyCode;
  reliability: Reliability;
  shipsToMarket: boolean;
  /** Categories this store's products may go to; a product that fits none is skipped. */
  categories: CategorySlug[];
  /** For a store whose every product belongs to one category even when its name does not say so. */
  fallbackCategory?: CategorySlug;
  /** Single-brand store: the brand of every product. */
  brand?: string;
  /** Category pages that together list the catalog, e.g. ["/erkek/", "/kadin/"]; read in turns, page by page. */
  listings: string[];
  /** Stop once this many discounted products were found. */
  maxDiscounted: number;
  /** Save every listed product, not only discounted ones: for brand stores whose whole catalog fits in a run. */
  allProducts?: boolean;
}

const DELAY_MS = 1500;
const TIMEOUT_MS = 60_000;
/** Listing pages read per run at most: enough for SuperStep's ~17,000 products. */
const MAX_PAGES = 420;
/** More failures than this in one run means the store is refusing us, not that a page was removed. */
const MAX_FAILURES = 10;

export function createAkinonAdapter(store: AkinonStore): SupplierAdapter {
  const maxRequests = 1 + MAX_PAGES;

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
      kind: "embedded-json",
      summary:
        "The store runs on Akinon; its category pages embed the listed products (price, cart offers, stock, sizes, photos) in the page's Next.js data.",
      steps: [
        "GET /robots.txt and stop unless the category pages are allowed (checked on every run)",
        `GET ${store.listings.join(", ")} with ?page=1, 2, … in turns, one request every ${DELAY_MS / 1000} s, until each listing ends`,
        `Stop once ${store.maxDiscounted} discounted products were found (or after ${MAX_PAGES} pages)`,
        "Price = what one item costs: the listed price, or the cart price when a one-item cart offer applies to every shopper (\"SEPETTE %30 İNDİRİM\")",
        store.allProducts
          ? "Every listed product is saved, with or without a discount"
          : "Discounted products are saved; a product without a discount only updates an offer we already have, so ended discounts disappear",
      ],
      entryPoints: store.listings.map((path) => store.origin + path),
      fields: {
        externalId: "attributes.integration_model_renk (model + colour), else base_code / sku",
        title: "name",
        brand: "recognised from the name, else attributes.integration_alt_marka",
        mpn: "the maker's article number, from base_code / sku / name for brands with a known format",
        price: "basket_offers[].listing_kwargs.discounted_total_price (quantity 1, all shoppers), else price",
        listPrice: "max(price, retail_price) when above the payable price",
        inStock: "any size in stock (extra_data.variants), else in_stock",
        sizes: "extra_data.variants (integration_beden)",
        image: "productimage_set[0].image",
        url: "absolute_url",
      },
      robots: {
        checkedOn: "2026-10-11",
        notes: "Category pages with ?page= allowed; robots.txt disallows only sorter/price/page_size parameters, /list/ and account pages.",
      },
      politeness: { delayMs: DELAY_MS, maxRequestsPerRun: maxRequests },
      liveSearch: { supported: false, reason: "Search pages are disallowed by robots.txt." },
      assumptions: [
        store.shipsToMarket
          ? "The store ships to Azerbaijan, but its shipping price is unknown; a forwarder estimate is used."
          : "The store does not ship to Azerbaijan directly; delivery is assumed through a freight forwarder.",
        store.allProducts
          ? `Every product is tracked, at most ${MAX_PAGES} listing pages per run.`
          : `Only discounted products are tracked, at most ${store.maxDiscounted}; our price history therefore has gaps between discounts.`,
      ],
    },
  };

  return {
    definition,

    async fetchCatalog(ctx: AdapterContext): Promise<RawOffer[]> {
      const client = new PoliteClient({ delayMs: DELAY_MS, maxRequests, signal: ctx.signal, timeoutMs: TIMEOUT_MS });
      const robots = await RobotsPolicy.fetch(store.origin, client);
      const listings = store.listings.filter((path) => robots.allows(`${path}?page=1`));
      if (listings.length === 0) throw new Error("robots.txt no longer allows the category pages");

      const offers = new Map<string, RawOffer>();
      let discounted = 0;
      let failures = 0;
      const nextPage = new Map(listings.map((path) => [path, 1]));

      while (nextPage.size > 0 && discounted < store.maxDiscounted && client.budgetLeft > 0) {
        for (const [path, page] of [...nextPage]) {
          if (discounted >= store.maxDiscounted || client.budgetLeft <= 0) break;
          let products;
          let totalCount;
          try {
            ({ products, totalCount } = readListingPage(await client.getText(`${store.origin}${path}?page=${page}`)));
          } catch (error) {
            if (++failures > MAX_FAILURES) throw error;
            nextPage.delete(path);
            continue;
          }
          for (const product of products) {
            const offer = toRawOffer(product, store);
            if (!offer || offers.has(offer.externalId)) continue;
            const isDiscounted = offer.listPriceMinor !== undefined && offer.inStock;
            if (isDiscounted) {
              if (discounted >= store.maxDiscounted) continue;
              discounted++;
              offers.set(offer.externalId, offer);
            } else if (store.allProducts) {
              offers.set(offer.externalId, offer);
            } else {
              // No discount: only refreshes an offer we already track, so its old discount ends.
              offers.set(offer.externalId, { ...offer, updateOnly: true });
            }
          }
          const seen = page * Math.max(products.length, 1);
          if (products.length === 0 || (totalCount !== null && seen >= totalCount)) nextPage.delete(path);
          else nextPage.set(path, page + 1);
        }
      }
      if (offers.size === 0) throw new Error("The category pages listed no products we could read");
      // Every listing read to its end: what they no longer list has left the store.
      if (store.allProducts && nextPage.size === 0 && failures === 0) ctx.listedEverything?.();
      return [...offers.values()];
    },

    async search(): Promise<RawOffer[]> {
      return [];
    },
  };
}
