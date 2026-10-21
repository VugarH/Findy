import { detectCategory, type CategorySlug } from "@/config/categories";
import { classifyProduct, OTHER_SUBCATEGORY } from "@/config/subcategories";
import type { CurrencyCode } from "@/config/currencies";
import { toMinor } from "@/lib/money";
import { BOT_USER_AGENT } from "../../http";
import type { AdapterContext, RawOffer, Reliability, SupplierAdapter, SupplierDefinition } from "../../types";
import { readFeed, rootCategories, type FeedCategory, type FeedOffer } from "./feed";
import { Selector, type SelectionRules } from "./select";
import { ADMITAD_FEED_STORES } from "./stores";

/**
 * Stores we join through the Admitad affiliate network, read from the product
 * feed Admitad builds for us: one download per run, filtered while it streams
 * (./select.ts), so only a few thousand offers ever reach the database. Every
 * link in the feed already carries our affiliate tracking.
 */
export interface AdmitadFeedStore {
  id: string;
  name: string;
  websiteUrl: string;
  /** ISO country the goods ship from. */
  originCountry: string;
  /** The feed is requested in this currency. */
  currency: CurrencyCode;
  /** Admitad's id of the feed (Product Feeds → Feed). */
  feedId: string;
  /** Ask Admitad for discounted products only (smaller download). */
  onlySale: boolean;
  /** Our categories this store's products may go to. */
  categories: CategorySlug[];
  /**
   * The store's top-level categories we take, by id: the categories its
   * products may go to, the first one the default when the title says nothing.
   * Anything under another top-level category is skipped.
   */
  categoryRoots?: Record<string, CategorySlug[]>;
  /** Instead of categoryRoots: our category from the offer itself (e.g. a category path in a tag). */
  categoryOf?: (offer: FeedOffer) => CategorySlug | null;
  /** Store-specific tags to read from each offer (into offer.extra). */
  extraTags?: string[];
  /** Turns an offer into one we may pick (e.g. sets its "was" price), or null to skip it. */
  prepare?: (offer: FeedOffer) => FeedOffer | null;
  /** Keep only products our product-type rules recognise: for marketplaces with a long tail of odd listings. */
  requireKnownType: boolean;
  /** Put before every title, e.g. "Pre-owned". */
  titlePrefix?: string;
  /** Saved with a new product (products.attributes), e.g. its condition. */
  attributesOf?: (offer: FeedOffer) => Record<string, string>;
  rules: SelectionRules;
  /** Delivered by the store itself; its own shipping (often free) instead of a forwarder. */
  shippingMinor: number;
  deliveryDays: { min: number; max: number };
  trustScore: number;
  reliability: Reliability;
  /** Very long marketplace titles are cut to this many characters (whole words). */
  maxTitleLength: number;
  notes: string[];
}

/** Admitad account details for feed links; set in the environment, never in code. */
function feedAccount(): { websiteId: string; user: string; code: string } | null {
  const websiteId = process.env.ADMITAD_WEBSITE_ID?.trim();
  const user = process.env.ADMITAD_FEED_USER?.trim();
  const code = process.env.ADMITAD_FEED_CODE?.trim();
  return websiteId && user && code ? { websiteId, user, code } : null;
}

/** Whether Admitad stores can be read here (the account is configured). */
export const admitadConfigured = () => feedAccount() !== null;

/** Whether a store id is one of the Admitad feed stores. */
const ADMITAD_IDS = new Set(ADMITAD_FEED_STORES.map((store) => store.id));
export const isAdmitadStore = (id: string) => ADMITAD_IDS.has(id);

/** A long download: the AliExpress feed is ~850 MB (about 20 minutes on a slow line); the job itself stops at 120. */
const TIMEOUT_MS = 75 * 60_000;

export function feedUrl(store: AdmitadFeedStore, account: { websiteId: string; user: string; code: string }): string {
  const query = new URLSearchParams({
    user: account.user,
    code: account.code,
    format: "xml",
    currency: store.currency,
    feed_id: store.feedId,
    last_import: "",
  });
  if (store.onlySale) query.set("only_sale", "true");
  return `https://export.admitad.com/en/webmaster/websites/${account.websiteId}/products/export_adv_products/?${query}`;
}

/** Cuts a title at a word boundary. */
export function shortTitle(title: string, max: number): string {
  const clean = title.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).trimEnd()}…`;
}

/** Our category for an offer: its top-level store category decides which ones fit, the title picks among them. */
export function categoryFor(
  offer: FeedOffer,
  roots: Map<string, FeedCategory>,
  categoryRoots: Record<string, CategorySlug[]>,
): CategorySlug | null {
  const root = offer.categoryId ? roots.get(offer.categoryId) : undefined;
  const allowed = root ? categoryRoots[root.id] : undefined;
  if (!allowed?.length) return null;
  return detectCategory(allowed, offer.name) ?? allowed[0];
}

export function toRawOffer(offer: FeedOffer, category: CategorySlug, store: AdmitadFeedStore, productType?: string): RawOffer {
  const title = shortTitle(offer.name, store.maxTitleLength);
  return {
    externalId: offer.id,
    url: offer.url,
    title: store.titlePrefix ? `${store.titlePrefix} ${title}` : title,
    attributes: store.attributesOf?.(offer),
    brand: offer.vendor && !/^(other|none|no brand)$/i.test(offer.vendor) ? offer.vendor : undefined,
    categorySlug: category,
    productType,
    imageUrl: offer.pictures[0],
    priceMinor: toMinor(offer.price),
    currency: store.currency,
    listPriceMinor: offer.oldPrice ? toMinor(offer.oldPrice) : undefined,
    shippingMinor: store.shippingMinor,
    inStock: true,
    deliveryDays: store.deliveryDays,
  };
}

/** A response body as text, chunk by chunk. */
async function* textChunks(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      yield decoder.decode(value, { stream: true });
    }
    yield decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

export function createAdmitadFeedAdapter(store: AdmitadFeedStore): SupplierAdapter {
  const total = Object.values(store.rules.quotas).reduce((sum, n) => sum + (n ?? 0), 0);
  const definition: SupplierDefinition = {
    id: store.id,
    name: store.name,
    scope: "global",
    originCountry: store.originCountry,
    currency: store.currency,
    websiteUrl: store.websiteUrl,
    trustScore: store.trustScore,
    integration: "feed",
    categories: store.categories,
    reliability: store.reliability,
    shipsToMarket: true,
    access: {
      kind: "official-api",
      summary: `Admitad affiliate product feed (feed ${store.feedId}), read once per run as a stream; links carry our affiliate tracking.`,
      steps: [
        `GET the feed (XML) from export.admitad.com with our account's feed code${store.onlySale ? ", discounted products only" : ""}`,
        "Read it as it downloads, one offer at a time; nothing but the picked offers is kept",
        `Keep offers in our categories, ${store.rules.minPrice}–${store.rules.maxPrice} ${store.currency}, ${store.rules.minDiscountPct}–${store.rules.maxDiscountPct}% off, at most ${store.rules.maxPerShop} per seller in a category`,
        `Best ${total} by discount (and a little by commission), split by category quotas`,
      ],
      entryPoints: ["https://export.admitad.com (feed link with ADMITAD_* settings)"],
      fields: {
        externalId: "offer@id",
        title: "name (long titles shortened)",
        brand: "vendor, when the feed has one",
        price: "price",
        listPrice: "oldprice",
        category: "categoryId → its top-level category → ours, refined by the title",
        image: "picture[0]",
        url: "url (Admitad tracking link)",
      },
      robots: { checkedOn: "2026-10-21", notes: "Not crawled: a feed Admitad provides for this purpose." },
      politeness: { delayMs: 0, maxRequestsPerRun: 1 },
      liveSearch: { supported: false, reason: "Feed only." },
      assumptions: store.notes,
    },
  };

  return {
    definition,

    async fetchCatalog(ctx: AdapterContext): Promise<RawOffer[]> {
      const account = feedAccount();
      if (!account) throw new Error("Admitad is not configured (ADMITAD_WEBSITE_ID, ADMITAD_FEED_USER, ADMITAD_FEED_CODE)");
      const timeout = AbortSignal.timeout(TIMEOUT_MS);
      const response = await fetch(feedUrl(store, account), {
        headers: { "User-Agent": BOT_USER_AGENT, "Accept-Encoding": "gzip" },
        signal: ctx.signal ? AbortSignal.any([ctx.signal, timeout]) : timeout,
      });
      if (!response.ok || !response.body) throw new Error(`Admitad feed answered ${response.status}`);

      let roots = new Map<string, FeedCategory>();
      const names = new Map<string, string>();
      const selector = new Selector(store.rules);
      const chunks = textChunks(response.body);
      let seen = 0;
      const onCategories = (categories: FeedCategory[]) => {
        roots = rootCategories(categories);
        for (const category of categories) names.set(category.id, category.name);
      };
      for await (const read of readFeed(chunks, onCategories, store.extraTags)) {
        seen++;
        const offer = store.prepare ? store.prepare(read) : read;
        if (!offer) continue;
        const category = store.categoryOf
          ? store.categoryOf(offer)
          : store.categoryRoots
            ? categoryFor(offer, roots, store.categoryRoots)
            : null;
        // Only things our product types recognise (earbuds, phone cases, mugs…): a marketplace has a long tail of odd listings.
        const known =
          category &&
          (!store.requireKnownType ||
            classifyProduct(category, offer.name, offer.categoryId ? names.get(offer.categoryId) : null) !== OTHER_SUBCATEGORY);
        selector.add(offer, known ? category : null);
      }
      if (seen === 0) throw new Error("The Admitad feed had no offers");

      const picked = selector.result();
      if (picked.length === 0) throw new Error(`None of ${seen} feed offers passed the selection`);
      // The pick is the whole set we track: offers that dropped out of it are hidden at once.
      ctx.listedEverything?.();
      return picked.map(({ offer, category }) =>
        toRawOffer(offer, category, store, offer.categoryId ? names.get(offer.categoryId) : undefined),
      );
    },

    async search(): Promise<RawOffer[]> {
      return [];
    },
  };
}
