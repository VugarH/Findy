/**
 * Prints "yes" when today's full daily run (Baku day) has started already:
 * GitHub's own timer is a late backup to Vercel Cron and must not run it twice.
 *
 *   npm run deals:ran-today
 */
import { and, eq, gte, or, sql } from "drizzle-orm";
import { closeDb, db } from "@/db/client";
import { pipelineRuns } from "@/db/schema";
import { loadMarket } from "@/modules/pricing/fx";

async function main() {
  const market = await loadMarket();
  const now = new Date();
  // A day and a bit back covers the market's whole day in any time zone; the date check below decides.
  const since = new Date(now.getTime() - 26 * 3_600_000);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: market.timeZone }).format(now);
  const rows = await db
    .select({ startedAt: pipelineRuns.startedAt })
    .from(pipelineRuns)
    .where(
      and(
        eq(pipelineRuns.marketCode, market.code),
        gte(pipelineRuns.startedAt, since),
        // A full run posts the day's top deals (stats.digest); "Collect now" for some stores does not.
        or(eq(pipelineRuns.status, "running"), sql`${pipelineRuns.stats} ? 'digest'`),
      ),
    );
  const ranToday = rows.some(
    (row) => new Intl.DateTimeFormat("en-CA", { timeZone: market.timeZone }).format(row.startedAt) === today,
  );
  console.log(ranToday ? "yes" : "no");
}

main()
  .catch((error) => {
    console.error(error);
    // Not knowing must not block the run.
    console.log("no");
  })
  .finally(closeDb);
