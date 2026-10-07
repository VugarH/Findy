/**
 * Prints the stores we use and exactly how each one's data is obtained.
 *
 *   npm run suppliers:list
 */
import { closeDb } from "@/db/client";
import { listSuppliers } from "@/modules/suppliers/queries";

async function main() {
  const stores = await listSuppliers();
  if (stores.length === 0) console.log("No store has returned data yet. Run: npm run deals:run");

  for (const store of stores) {
    const method = store.accessMethod;
    console.log(`\n${store.name}  (${store.scope}, ${store.originCountry})  ${store.websiteUrl}`);
    console.log(`  offers tracked : ${store.offerCount}`);
    console.log(`  first verified : ${store.firstVerifiedAt.toISOString()}`);
    console.log(`  last success   : ${store.lastSuccessAt?.toISOString() ?? "never"} (${store.lastOfferCount} offers)`);
    if (store.lastError) console.log(`  last error     : ${store.lastErrorAt?.toISOString()} — ${store.lastError}`);
    if (!method) continue;
    console.log(`  method         : ${method.kind} — ${method.summary}`);
    method.steps.forEach((step, i) => console.log(`    ${i + 1}. ${step}`));
    console.log(`  entry points   : ${method.entryPoints.join(", ") || "—"}`);
    console.log(`  robots.txt     : checked ${method.robots.checkedOn}. ${method.robots.notes}`);
    console.log(`  politeness     : ${method.politeness.delayMs} ms between requests, max ${method.politeness.maxRequestsPerRun} per run`);
    console.log(`  live search    : ${method.liveSearch.supported ? "yes" : `no — ${method.liveSearch.reason}`}`);
    for (const [field, source] of Object.entries(method.fields)) console.log(`    ${field.padEnd(12)} <- ${source}`);
    method.assumptions?.forEach((note) => console.log(`  assumption     : ${note}`));
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDb);
