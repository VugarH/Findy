/**
 * Tells people about new deals from the brands, stores and categories they
 * follow: notifications on the site and one Telegram message each. Meant to
 * run once a day (10:00), after the daily deals job. Safe to run again: it
 * only covers deals that started since its previous run.
 *
 *   npm run follows:notify
 */
import { closeDb } from "@/db/client";
import { notifyFollowers } from "@/modules/follows/notify";
import { loadMarket } from "@/modules/pricing/fx";

async function main() {
  const result = await notifyFollowers(await loadMarket());
  const from = result.windowStart?.toISOString() ?? "—";
  console.log(`New deals ${from} → ${result.windowEnd.toISOString()}: ${result.newDeals}`);
  console.log(
    `${result.follows} follows · ${result.people} people told · ${result.notifications} notifications · ${result.telegram} Telegram messages`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDb);
