import { siteConfig } from "@/config/site";
import { bakuElectronicsAdapter } from "./adapters/baku-electronics";
import { demoAdapters } from "./adapters/demo";
import { createShopifyAdapter } from "./adapters/shopify/adapter";
import { SHOPIFY_STORES } from "./adapters/shopify/stores";
import { solitonAdapter } from "./adapters/soliton";
import { createStructuredDataAdapter } from "./adapters/structured-data/adapter";
import { STRUCTURED_DATA_STORES } from "./adapters/structured-data/stores";
import { worldTelecomAdapter } from "./adapters/world-telecom";
import { loadCustomAdapters } from "./custom";
import type { SupplierAdapter } from "./types";

/**
 * Every supplier defined in code. To add a store, implement SupplierAdapter in
 * ./adapters/<store>.ts and add it here — or add it in the admin panel, if one
 * of the generic connectors fits (./custom.ts). Research notes on stores that
 * are not connected yet live in docs/SUPPLIERS.md.
 */
const REAL_ADAPTERS: SupplierAdapter[] = [
  bakuElectronicsAdapter,
  solitonAdapter,
  worldTelecomAdapter,
  ...SHOPIFY_STORES.map(createShopifyAdapter),
  ...STRUCTURED_DATA_STORES.map(createStructuredDataAdapter),
];

/** Demo mode (NEXT_PUBLIC_DEMO_DATA=true) swaps in the fictional stores; the two are never mixed. */
const ADAPTERS: SupplierAdapter[] = siteConfig.demoData ? demoAdapters : REAL_ADAPTERS;

/** Stores defined in code. */
export function getAdapters(): SupplierAdapter[] {
  return ADAPTERS;
}

/** Stores defined in code plus the ones added in the admin panel: what the daily job collects. */
export async function getAllAdapters(): Promise<SupplierAdapter[]> {
  if (siteConfig.demoData) return ADAPTERS;
  const codeIds = new Set(ADAPTERS.map((adapter) => adapter.definition.id));
  const custom = (await loadCustomAdapters()).filter((adapter) => !codeIds.has(adapter.definition.id));
  return [...ADAPTERS, ...custom];
}

export function isCodeSupplier(id: string): boolean {
  return ADAPTERS.some((adapter) => adapter.definition.id === id);
}

/** Suppliers that may be queried on demand, while a user waits. */
export function getLiveSearchAdapters(): SupplierAdapter[] {
  return ADAPTERS.filter((adapter) => adapter.definition.access.liveSearch.supported);
}
