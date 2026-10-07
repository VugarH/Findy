/**
 * Re-sorts products into subcategories and rebuilds the published deals from
 * the offers already in the database, without contacting any store. Run it
 * after changing deal rules or subcategory rules. (The admin panel's
 * "Publish changes" button does the same.)
 *
 *   npm run deals:rebuild
 */
import { closeDb } from "@/db/client";
import { publishDeals } from "@/modules/deals/publish";

async function main() {
  const count = await publishDeals();
  console.log(`${count} deals published.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDb);
