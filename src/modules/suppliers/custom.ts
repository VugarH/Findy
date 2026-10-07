import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { suppliers, type Supplier } from "@/db/schema";
import { isCurrencyCode } from "@/config/currencies";
import { createShopifyAdapter } from "./adapters/shopify/adapter";
import { createStructuredDataAdapter } from "./adapters/structured-data/adapter";
import { customConfigSchema, trustScoreFor, type CustomStore } from "./custom-config";
import type { RawOffer, SupplierAdapter, SupplierDefinition } from "./types";

export * from "./custom-config";

/**
 * Stores added in the admin panel instead of in code. Each one uses one of the
 * generic connectors — the same adapters the code stores use — configured by
 * the settings saved with the store (see ./custom-config.ts).
 */

/** The adapter that collects this store, or null for a store whose prices are entered by hand. */
export function createCustomAdapter(store: CustomStore): SupplierAdapter | null {
  const { connection, categories, reliability, shipsToMarket } = store.config;
  const [main, ...others] = categories;
  const base = {
    id: store.id,
    name: store.name,
    originCountry: store.originCountry,
    currency: store.currency,
    reliability,
    shipsToMarket,
  };

  switch (connection.type) {
    case "shopify":
      return createShopifyAdapter({
        ...base,
        domain: new URL(store.websiteUrl).host,
        category: main,
        mixedWith: others.length > 0 ? others : undefined,
        brand: connection.brand,
      });
    case "structured-data":
      return createStructuredDataAdapter({
        ...base,
        origin: new URL(store.websiteUrl).origin,
        categories,
        // A product whose title names none of the store's categories still belongs to its main one.
        fallbackCategory: main,
        sitemap: connection.sitemap,
        productUrl: new RegExp(connection.productUrl),
        productSitemaps: connection.productSitemaps ? new RegExp(connection.productSitemaps) : undefined,
        focus: connection.focus ? new RegExp(connection.focus, "i") : undefined,
        listPrice: connection.listPrice,
        brand: connection.brand,
        brandFromTitle: connection.brandFromTitle,
        productsPerRun: connection.productsPerRun,
      });
    case "manual":
      return null;
  }
}

/** How the store is described in the suppliers table, whatever its connection. */
export function customDefinition(store: CustomStore): SupplierDefinition {
  const adapter = createCustomAdapter(store);
  if (adapter) return adapter.definition;
  return {
    id: store.id,
    name: store.name,
    scope: store.originCountry === "AZ" ? "local" : "global",
    originCountry: store.originCountry,
    currency: store.currency,
    websiteUrl: store.websiteUrl,
    trustScore: trustScoreFor(store.config.reliability.basis),
    integration: "manual",
    categories: store.config.categories,
    reliability: store.config.reliability,
    shipsToMarket: store.config.shipsToMarket,
    access: {
      kind: "manual-entry",
      summary: "No connection to the store: prices are entered by hand in the admin panel.",
      steps: [
        "Someone from the team checks the price at the store and enters it in the admin panel",
        "Every daily run re-confirms the entered prices, so they stay listed until changed or removed",
      ],
      entryPoints: [store.websiteUrl],
      fields: { price: "entered by hand", url: "entered by hand", inStock: "entered by hand" },
      robots: {
        checkedOn: new Date().toISOString().slice(0, 10),
        notes: "The store's site is not read automatically.",
      },
      politeness: { delayMs: 0, maxRequestsPerRun: 0 },
      liveSearch: { supported: false, reason: "Prices are entered by hand." },
    },
  };
}

/** A store row from the database as a CustomStore, or null when it is not one or its settings are invalid. */
export function toCustomStore(
  row: Pick<Supplier, "id" | "name" | "websiteUrl" | "originCountry" | "currency" | "source" | "customConfig">,
): CustomStore | null {
  if (row.source !== "admin" || !row.customConfig || !isCurrencyCode(row.currency)) return null;
  const config = customConfigSchema.safeParse(row.customConfig);
  if (!config.success) return null;
  return {
    id: row.id,
    name: row.name,
    websiteUrl: row.websiteUrl,
    originCountry: row.originCountry,
    currency: row.currency,
    config: config.data,
  };
}

/** Adapters of every store added in the admin panel that has an automatic connection. */
export async function loadCustomAdapters(): Promise<SupplierAdapter[]> {
  const rows = await db.select().from(suppliers).where(eq(suppliers.source, "admin"));
  return rows.flatMap((row) => {
    const store = toCustomStore(row);
    if (!store) {
      console.warn(`Store ${row.id}: its admin settings are invalid; not collected.`);
      return [];
    }
    const adapter = createCustomAdapter(store);
    return adapter ? [adapter] : [];
  });
}

export interface StorePreview {
  ok: boolean;
  /** How many offers a run would save. */
  total: number;
  sample: RawOffer[];
  error?: string;
}

/** Products a preview reads at most; enough to judge the settings, small enough to be quick. */
const PREVIEW_PRODUCTS = 6;

/**
 * Runs a store's connector once without saving anything, so settings can be
 * checked before the store is added. Uses the same polite client and
 * robots.txt rules as the daily job.
 */
export async function previewCustomStore(store: CustomStore): Promise<StorePreview> {
  const connection = store.config.connection;
  const trial =
    connection.type === "structured-data"
      ? { ...store, config: { ...store.config, connection: { ...connection, productsPerRun: PREVIEW_PRODUCTS } } }
      : store;
  const adapter = createCustomAdapter(trial);
  if (!adapter) return { ok: true, total: 0, sample: [] };
  try {
    const offers = await adapter.fetchCatalog({
      marketCode: "",
      now: new Date(),
      signal: AbortSignal.timeout(180_000),
    });
    return {
      ok: offers.length > 0,
      total: offers.length,
      sample: offers.slice(0, PREVIEW_PRODUCTS),
      error: offers.length ? undefined : "The store returned no products",
    };
  } catch (error) {
    return { ok: false, total: 0, sample: [], error: error instanceof Error ? error.message : String(error) };
  }
}
