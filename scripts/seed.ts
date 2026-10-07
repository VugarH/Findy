/**
 * Demo mode only. Fills a fresh database with demo data: replays the last 90 days through the
 * demo suppliers to build a price history, then runs today's pipeline.
 *
 *   npm run db:seed
 */
import { closeDb } from "@/db/client";
import { getMarket } from "@/config/markets";
import { siteConfig } from "@/config/site";
import { collectCatalogs, runDailyPipeline } from "@/modules/deals/pipeline";
import { getAdapters } from "@/modules/suppliers/registry";

const DAY_MS = 86_400_000;

async function main() {
  const market = getMarket();
  const adapters = getAdapters();
  const now = new Date();
  const days = market.deals.historyWindowDays;

  if (!siteConfig.demoData) {
    throw new Error("db:seed replays the demo stores. Set NEXT_PUBLIC_DEMO_DATA=true, or use `npm run deals:run` for real stores.");
  }

  process.stdout.write(`Back-filling ${days} days of price history `);
  for (let daysAgo = days; daysAgo >= 1; daysAgo--) {
    const day = new Date(now.getTime() - daysAgo * DAY_MS);
    const stats = await collectCatalogs(adapters, { marketCode: market.code, now: day });
    const failed = stats.find((s) => !s.ok);
    if (failed) throw new Error(`${failed.supplierId}: ${failed.error}`);
    if (daysAgo % 10 === 0) process.stdout.write(".");
  }
  console.log(" done");

  const { status, stats } = await runDailyPipeline(market, now);
  console.log(`Today's run: ${status}, ${stats.deals} deals published.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDb);
