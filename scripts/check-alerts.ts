/**
 * Checks watched products for price drops and sends the notifications,
 * without collecting new prices. The daily job does this automatically.
 *
 *   npm run alerts:check
 */
import { closeDb } from "@/db/client";
import { checkPriceWatches } from "@/modules/alerts/check";
import { loadMarket } from "@/modules/pricing/fx";

async function main() {
  const result = await checkPriceWatches(await loadMarket());
  console.log(
    `${result.watches} watches checked, ${result.notified} notifications created, ${result.pushed} pushes delivered, ${result.telegram} Telegram messages sent.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDb);
