/**
 * Shows how well the connected stores cover the popular product families:
 * how many variants we track, how many can be compared across stores, and where.
 *
 *   npm run popular:coverage
 */
import { closeDb } from "@/db/client";
import { POPULAR_FAMILIES } from "@/config/popular";
import { formatMoney } from "@/lib/money";
import { getPopularCoverage } from "@/modules/catalog/popular";
import { loadMarket } from "@/modules/pricing/fx";

async function main() {
  const market = await loadMarket();
  const coverage = await getPopularCoverage(market, true);

  console.table(
    coverage.map((row) => ({
      family: row.family.label,
      variants: row.variants,
      "in 2+ stores": row.comparable,
      stores: row.stores.length,
      from: formatMoney(row.fromMinor, market.currency, "en"),
      where: row.stores.join(", ").slice(0, 70),
    })),
  );
  const missing = POPULAR_FAMILIES.filter((family) => !coverage.some((row) => row.family.id === family.id));
  if (missing.length > 0) console.log(`Not found in any store: ${missing.map((family) => family.label).join(", ")}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDb);
