import type { MarketConfig } from "@/config/markets";
import type { ProductCardData } from "@/modules/catalog/card";
import { ingestOffers, registerSupplier } from "@/modules/catalog/ingest";
import { getLiveSearchAdapters } from "@/modules/suppliers/registry";
import type { SupplierScope } from "@/modules/suppliers/types";
import { cardsForProducts, recordSearch } from "./catalog-search";

const SUPPLIER_TIMEOUT_MS = 8_000;

export type LiveSearchEvent =
  | { type: "start"; suppliers: { id: string; name: string; scope: SupplierScope }[] }
  | { type: "supplier"; supplierId: string; ok: boolean; found: number; products: ProductCardData[] }
  | { type: "done"; products: ProductCardData[] };

/**
 * Asks every supplier at once and reports back as each one answers, so the
 * user watches results arrive instead of waiting for the slowest store.
 * Everything found is ingested, which is how searches grow the catalog.
 */
export async function* liveSearch(
  query: string,
  market: MarketConfig,
  signal?: AbortSignal,
): AsyncGenerator<LiveSearchEvent> {
  const adapters = getLiveSearchAdapters();
  const now = new Date();

  yield {
    type: "start",
    suppliers: adapters.map(({ definition }) => ({ id: definition.id, name: definition.name, scope: definition.scope })),
  };

  const tasks = adapters.map(async (adapter) => {
    try {
      const timeout = AbortSignal.timeout(SUPPLIER_TIMEOUT_MS);
      const rawOffers = await Promise.race([
        adapter.search(query, { marketCode: market.code, now, signal: signal ? AbortSignal.any([signal, timeout]) : timeout }),
        new Promise<never>((_, reject) =>
          timeout.addEventListener("abort", () => reject(new Error("Supplier timed out")), { once: true }),
        ),
      ]);
      return { adapter, rawOffers, ok: true };
    } catch {
      return { adapter, rawOffers: [], ok: false };
    }
  });

  const productIds = new Set<string>();
  let products: ProductCardData[] = [];

  for await (const { adapter, rawOffers, ok } of inCompletionOrder(tasks)) {
    if (signal?.aborted) return;
    if (rawOffers.length > 0) {
      await registerSupplier(adapter.definition);
      const result = await ingestOffers(adapter.definition, rawOffers, now);
      result.productIds.forEach((id) => productIds.add(id));
      products = await cardsForProducts([...productIds], market);
    }
    yield { type: "supplier", supplierId: adapter.definition.id, ok, found: rawOffers.length, products };
  }

  await recordSearch(query, market, products.length, true);
  yield { type: "done", products };
}

async function* inCompletionOrder<T>(tasks: Promise<T>[]): AsyncGenerator<T> {
  const pending = new Map(tasks.map((task, index) => [index, task.then((value) => ({ index, value }))]));
  while (pending.size > 0) {
    const { index, value } = await Promise.race(pending.values());
    pending.delete(index);
    yield value;
  }
}
