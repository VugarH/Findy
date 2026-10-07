/**
 * Runs the daily deals pipeline once. Schedule this (cron, GitHub Actions,
 * a worker) or call POST /api/cron/daily-deals instead.
 *
 *   npm run deals:run                          every store (about 20 minutes)
 *   npm run deals:run -- --scope local         only the Azerbaijani stores (a few minutes)
 *   npm run deals:run -- --only soliton,amazfit
 */
import { closeDb } from "@/db/client";
import { loadMarket } from "@/modules/pricing/fx";
import { runDailyPipeline, type PipelineOptions } from "@/modules/deals/pipeline";

function parseOptions(args: string[]): PipelineOptions {
  const value = (flag: string) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const scope = value("--scope");
  if (scope && scope !== "local" && scope !== "global") throw new Error(`--scope must be "local" or "global"`);
  return { scope: scope as PipelineOptions["scope"], supplierIds: value("--only")?.split(",").filter(Boolean) };
}

async function main() {
  const market = await loadMarket();
  const started = Date.now();
  const { status, stats } = await runDailyPipeline(market, new Date(), parseOptions(process.argv.slice(2)));

  console.log(`Market ${market.code}: ${status} in ${Date.now() - started} ms`);
  console.table(stats.suppliers.map(({ supplierId, ok, offers, error }) => ({ supplierId, ok, offers, error: error?.slice(0, 70) })));
  if (stats.fxError) console.warn(`Exchange rates not refreshed: ${stats.fxError}`);
  console.log(`Refreshed ${stats.refreshedSearches} popular searches, published ${stats.deals} deals.`);
  if (stats.alerts) {
    const { notified, watches, telegram = 0 } = stats.alerts;
    console.log(`Price alerts: ${notified} notifications from ${watches} watches, ${telegram} people told in Telegram.`);
  }
  if (stats.digest) {
    const { day, items, posted, error } = stats.digest;
    console.log(`Top deals ${day}: ${items} picked${posted ? ", posted to Telegram" : ""}${error ? ` — ${error}` : ""}.`);
  }
  if (status === "failed") process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
    // A store connection that never closes must not keep a scheduled run alive for hours.
    setTimeout(() => process.exit(), 10_000).unref();
  });
