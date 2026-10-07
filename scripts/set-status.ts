/**
 * Switches stores and products off or on from the command line. The admin
 * panel (/az/admin) does the same with a button and records who did it.
 *
 *   npm run status -- store undefeated off      the daily job stops contacting the store; its products disappear
 *   npm run status -- product <slug> off        the product disappears; its prices are no longer recorded
 *   npm run status -- store undefeated on       (and back)
 *   npm run status -- list                      what is switched off now
 *
 * The product slug is the last part of its page address: /az/product/<slug>.
 * Store ids are listed by `npm run suppliers:list`. The deal list is rebuilt
 * at the end, so the change shows on the site immediately.
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { closeDb, db } from "@/db/client";
import { products, suppliers } from "@/db/schema";
import { buildDeals } from "@/modules/deals/build";
import { loadMarket } from "@/modules/pricing/fx";

const USAGE = "usage: npm run status -- store <id> on|off | product <slug> on|off | list";

async function main() {
  const [kind, id, state] = process.argv.slice(2);

  if (kind === "list") {
    const stores = await db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(eq(suppliers.active, false));
    const items = await db.select({ slug: products.slug, title: products.title }).from(products).where(eq(products.active, false));
    console.log(`Stores switched off (${stores.length}):`);
    stores.forEach((s) => console.log(`  ${s.id}  ${s.name}`));
    console.log(`Products switched off (${items.length}):`);
    items.forEach((p) => console.log(`  ${p.slug}  ${p.title}`));
    return;
  }

  if ((kind !== "store" && kind !== "product") || !id || (state !== "on" && state !== "off")) {
    console.error(USAGE);
    process.exitCode = 2;
    return;
  }

  const active = state === "on";
  const updated =
    kind === "store"
      ? await db.update(suppliers).set({ active }).where(eq(suppliers.id, id)).returning({ name: suppliers.name })
      : await db.update(products).set({ active }).where(eq(products.slug, id)).returning({ name: products.title });

  if (updated.length === 0) {
    console.error(`No ${kind} "${id}" found.${kind === "store" ? " Store ids: npm run suppliers:list" : ""}`);
    process.exitCode = 1;
    return;
  }

  console.log(`${updated[0].name}: switched ${state}. Rebuilding the deal list…`);
  const market = await loadMarket();
  const deals = await buildDeals(market, randomUUID(), new Date());
  console.log(`Done: ${deals} deals published.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDb);
