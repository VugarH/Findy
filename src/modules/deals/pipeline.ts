import { and, desc, eq, gt, gte } from "drizzle-orm";
import { db } from "@/db/client";
import { pipelineRuns, searchQueries, suppliers, type PipelineStats, type SupplierRunStat } from "@/db/schema";
import type { MarketConfig } from "@/config/markets";
import {
  ingestOffers,
  markUnlistedOffers,
  recordSupplierFailure,
  recordSupplierSuccess,
  registerSupplier,
} from "@/modules/catalog/ingest";
import { getAllAdapters, getLiveSearchAdapters } from "@/modules/suppliers/registry";
import type { AdapterContext, SupplierAdapter } from "@/modules/suppliers/types";
import { loadMarket, refreshFxRates } from "@/modules/pricing/fx";
import { checkPriceWatches } from "@/modules/alerts/check";
import { classifyProducts } from "@/modules/catalog/classify";
import { confirmManualOffers } from "@/modules/catalog/manual-offers";
import { buildDailyDigest } from "@/modules/digest/service";
import { postDigest } from "@/modules/telegram/channel";
import { buildDeals } from "./build";

export interface PipelineResult {
  runId: string;
  status: "success" | "partial" | "failed";
  stats: PipelineStats;
}

/**
 * The daily job:
 *   0. refresh exchange rates
 *   1. collect every supplier's catalog (one failing store never stops the rest),
 *      hide what a store no longer lists, and re-confirm the prices entered by
 *      hand in the admin panel
 *   2. refresh the products users searched for most (demand-driven catalog)
 *   3. sort products into subcategories with the current rules
 *   4. rebuild the published deals
 *   5. notify people whose watched products dropped in price from the fresh prices
 *   6. pick the day's top deals and post them to the Telegram channel (full runs, once a day)
 */
export interface PipelineOptions {
  /** Collect only from these stores (by scope or id). Everything after collection still runs in full. */
  scope?: "local" | "global";
  supplierIds?: string[];
  /** Step 2; skipped when only one store is being re-collected (admin panel "Collect now"). */
  refreshSearches?: boolean;
}

export async function runDailyPipeline(
  baseMarket: MarketConfig,
  now = new Date(),
  options: PipelineOptions = {},
): Promise<PipelineResult> {
  // Landed prices depend on exchange rates, so refresh those first.
  const fx = await refreshFxRates(baseMarket, now);
  const market = await loadMarket(baseMarket.code);
  // Stores switched off in the database (suppliers.active = false) are not contacted at all.
  const disabled = await disabledSupplierIds();
  const adapters = (await getAllAdapters()).filter(
    ({ definition }) =>
      !disabled.has(definition.id) &&
      (!options.scope || definition.scope === options.scope) &&
      (!options.supplierIds || options.supplierIds.includes(definition.id)),
  );
  const ctx: AdapterContext = { marketCode: market.code, now };

  const [run] = await db
    .insert(pipelineRuns)
    .values({ marketCode: market.code, status: "running", startedAt: now })
    .returning({ id: pipelineRuns.id });

  const supplierStats = await collectCatalogs(adapters, ctx);
  await confirmManualOffers(now);
  const refreshedSearches =
    options.refreshSearches === false
      ? 0
      : await refreshPopularSearches(
          getLiveSearchAdapters().filter(({ definition }) => !disabled.has(definition.id)),
          market,
          ctx,
        );
  await classifyProducts();
  const dealCount = await buildDeals(market, run.id, now);
  // With fresh prices in place: tell people whose watched products got cheaper.
  const alerts = await checkPriceWatches(market, now);
  // A run limited to some stores ("Collect now") is not the day's run.
  const digest = !options.scope && !options.supplierIds ? await dailyDigest(market, now) : undefined;

  const failed = supplierStats.filter((s) => !s.ok).length;
  const status = failed === 0 ? "success" : failed === supplierStats.length ? "failed" : "partial";
  const stats: PipelineStats = {
    suppliers: supplierStats,
    refreshedSearches,
    deals: dealCount,
    fxError: fx.error,
    alerts,
    digest,
  };

  await db
    .update(pipelineRuns)
    .set({ status, stats, finishedAt: new Date() })
    .where(eq(pipelineRuns.id, run.id));

  return { runId: run.id, status, stats };
}

/** Step 6. Picked once a day; a second run the same day finds it done. Never fails the run. */
async function dailyDigest(market: MarketConfig, now: Date): Promise<PipelineStats["digest"]> {
  try {
    const digest = await buildDailyDigest(market, now);
    if (!digest) return undefined;
    const post = await postDigest(digest, market);
    return {
      day: digest.day,
      items: digest.items.length,
      posted: post.status === "posted" || post.status === "already",
      error: post.status === "failed" ? post.error : undefined,
    };
  } catch (error) {
    return { day: "", items: 0, posted: false, error: describeError(error) };
  }
}

export async function disabledSupplierIds(): Promise<Set<string>> {
  const rows = await db.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.active, false));
  return new Set(rows.map((row) => row.id));
}

/**
 * Stores are collected in lanes that run side by side, because they are
 * limited in different ways:
 *   - Shopify: every Shopify store shares one request queue (Shopify counts us
 *     as one visitor across all of them), so more parallel stores only means
 *     more waiting. A few keep the queue busy while others save their data.
 *   - Everything else: each store has its own polite pace (one page at a time),
 *     so they all start at once, the biggest first — a 900-page sitemap store
 *     sets the length of the run, and it must not wait behind the Shopify queue.
 * Each store is still hit one request at a time.
 */
export interface CollectionLane {
  name: "shopify" | "own-pace";
  concurrency: number;
  /** Indexes into the adapter list, in the order they start. */
  order: number[];
}

const SHOPIFY_LANE_CONCURRENCY = 4;
const OWN_PACE_LANE_CONCURRENCY = 32;

export function planLanes(adapters: SupplierAdapter[]): CollectionLane[] {
  const indexes = adapters.map((_, index) => index);
  const isShopify = (index: number) => adapters[index].definition.access.kind === "shopify-json";
  const size = (index: number) => adapters[index].definition.access.politeness.maxRequestsPerRun;
  return [
    { name: "shopify" as const, concurrency: SHOPIFY_LANE_CONCURRENCY, order: indexes.filter(isShopify) },
    {
      name: "own-pace" as const,
      concurrency: OWN_PACE_LANE_CONCURRENCY,
      // Biggest first; the sort is stable, so equal stores keep their listed order.
      order: indexes.filter((index) => !isShopify(index)).sort((a, b) => size(b) - size(a)),
    },
  ].filter((lane) => lane.order.length > 0);
}

/** Step 1 on its own — also used to back-fill price history for past days. Stats come back in `adapters` order. */
export async function collectCatalogs(adapters: SupplierAdapter[], ctx: AdapterContext): Promise<SupplierRunStat[]> {
  const stats: SupplierRunStat[] = new Array(adapters.length);

  async function runLane({ concurrency, order }: CollectionLane) {
    let next = 0;
    async function worker() {
      while (next < order.length) {
        const index = order[next++];
        stats[index] = await collectOne(adapters[index], ctx);
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, order.length) }, worker));
  }
  await Promise.all(planLanes(adapters).map(runLane));
  return stats;
}

async function collectOne(adapter: SupplierAdapter, ctx: AdapterContext): Promise<SupplierRunStat> {
  const supplierId = adapter.definition.id;
  try {
    let listedEverything = false;
    const rawOffers = await adapter.fetchCatalog({ ...ctx, listedEverything: () => (listedEverything = true) });
    if (rawOffers.length === 0) throw new Error("The store returned no offers");
    // Only now — with real data in hand — does the store enter our database.
    await recordSupplierSuccess(adapter.definition, rawOffers.length, ctx.now);
    const { offerCount } = await ingestOffers(adapter.definition, rawOffers, ctx.now);
    // Only after a successful read of the whole listing. A store that failed, or that is read as a
    // sample (sitemap stores, large Shopify catalogs), keeps its offers until they turn stale.
    const removed = listedEverything ? await markUnlistedOffers(supplierId, ctx.now) : 0;
    return { supplierId, ok: true, offers: offerCount, removed };
  } catch (error) {
    const message = describeError(error);
    await recordSupplierFailure(supplierId, message, ctx.now);
    return { supplierId, ok: false, offers: 0, error: message };
  }
}

/**
 * An error as one line. Node's fetch says only "fetch failed"; the reason
 * (DNS, timeout, connection reset) is in its cause, so that is added.
 */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause as { code?: string; message?: string } | undefined;
  const reason = cause?.code ?? cause?.message;
  return reason && !error.message.includes(reason) ? `${error.message} (${reason})` : error.message;
}

async function refreshPopularSearches(
  adapters: SupplierAdapter[],
  market: MarketConfig,
  ctx: AdapterContext,
): Promise<number> {
  if (adapters.length === 0) return 0;
  const since = new Date(ctx.now.getTime() - 7 * 86_400_000);
  const popular = await db
    .select({ query: searchQueries.query })
    .from(searchQueries)
    .where(
      and(
        eq(searchQueries.marketCode, market.code),
        gte(searchQueries.lastSearchedAt, since),
        gt(searchQueries.liveCount, 0),
      ),
    )
    .orderBy(desc(searchQueries.liveCount))
    .limit(market.deals.refreshTopSearches);

  for (const { query } of popular) {
    await Promise.all(
      adapters.map(async (adapter) => {
        try {
          const rawOffers = await adapter.search(query, ctx);
          if (rawOffers.length === 0) return;
          await registerSupplier(adapter.definition);
          await ingestOffers(adapter.definition, rawOffers, ctx.now);
        } catch {
          // A store failing one refresh is not worth failing the run for.
        }
      }),
    );
  }
  return popular.length;
}
