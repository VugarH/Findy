import type { SizeOption } from "./sizes";
import type { CategorySlug } from "@/config/categories";
import type { CurrencyCode } from "@/config/currencies";

export type SupplierScope = "local" | "global";

/** How we get data from a supplier. Prefer api/feed; crawl only as a last resort. */
export type SupplierIntegration = "api" | "feed" | "crawler" | "manual" | "demo";

/**
 * A written record of how a store's data is obtained. Stored with the supplier
 * so the method, its limits and the rules we agreed to follow are never only
 * in someone's head (or only in code).
 */
export interface AccessMethod {
  kind:
    | "official-api"
    | "shopify-json"
    | "embedded-json"
    | "sitemap-meta-tags"
    | "sitemap-json-ld"
    | "html"
    | "manual-entry"
    | "demo";
  summary: string;
  /** The fetch procedure, in order. */
  steps: string[];
  entryPoints: string[];
  /** Our field -> where it comes from in the store's data. */
  fields: Record<string, string>;
  robots: { checkedOn: string; notes: string };
  politeness: { delayMs: number; maxRequestsPerRun: number };
  liveSearch: { supported: boolean; reason?: string };
  /** Things we assumed because the store does not state them. */
  assumptions?: string[];
}

export const RELIABILITY_BASES = ["official-brand-store", "established-retailer"] as const;

/** Why we consider a store safe to send buyers to. */
export interface Reliability {
  basis: (typeof RELIABILITY_BASES)[number];
  note: string;
}

export interface SupplierDefinition {
  /** Stable id, used as the primary key in the suppliers table. */
  id: string;
  name: string;
  scope: SupplierScope;
  /** ISO country the goods ship from. Drives forwarding cost and delivery time. */
  originCountry: string;
  currency: CurrencyCode;
  websiteUrl: string;
  /** 0–100. Reputation, warranty handling, return policy. */
  trustScore: number;
  integration: SupplierIntegration;
  categories: readonly CategorySlug[];
  access: AccessMethod;
  reliability?: Reliability;
  /** A foreign store that itself delivers to the market (no forwarder needed). */
  shipsToMarket?: boolean;
}

/** A listing exactly as a supplier reports it, before matching or pricing. */
export interface RawOffer {
  externalId: string;
  url: string;
  title: string;
  brand?: string;
  model?: string;
  gtin?: string;
  /**
   * The maker's own article / reference number (adidas "IH2639", Nike
   * "FN8797-456"). Together with the brand it identifies the same item in
   * every store that sells it, so set it only when it is certain.
   */
  mpn?: string;
  categorySlug: CategorySlug;
  /** The store's own product type / section name, if it has one. Helps pick a subcategory. */
  productType?: string;
  imageUrl?: string;
  /** Minor units of `currency`. */
  priceMinor: number;
  currency: CurrencyCode;
  /** The supplier's own "was" price, if it shows one. */
  listPriceMinor?: number;
  /** Shipping to the market; null when the supplier does not ship there directly. */
  shippingMinor: number | null;
  weightKg?: number;
  inStock: boolean;
  /** Clothes and shoes: the sizes the store lists and which can be bought; undefined when unknown or one size. */
  sizes?: SizeOption[];
  deliveryDays?: { min: number; max: number };
  attributes?: Record<string, string>;
}

export interface AdapterContext {
  /** Market the request is for (suppliers may price or ship differently per country). */
  marketCode: string;
  /** "Now" for the request. Injected so runs are reproducible and back-fillable. */
  now: Date;
  signal?: AbortSignal;
  /**
   * fetchCatalog calls this when it read the store's whole listing, not a
   * sample: offers it did not return are then gone from the store and are
   * hidden at once (see markUnlistedOffers). Sampling adapters never call it.
   */
  listedEverything?: () => void;
}

/**
 * The single contract every supplier integration implements.
 * Adding a store = one new file implementing this + one line in registry.ts.
 */
export interface SupplierAdapter {
  readonly definition: SupplierDefinition;
  /** Daily job: the supplier's current listings in the categories we track. */
  fetchCatalog(ctx: AdapterContext): Promise<RawOffer[]>;
  /** Live search: listings matching a free-text query. */
  search(query: string, ctx: AdapterContext): Promise<RawOffer[]>;
}
