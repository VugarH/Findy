/**
 * Prints the "order it for me" requests, newest first, for whoever handles them.
 *
 *   npm run orders:list
 */
import { closeDb } from "@/db/client";
import { formatMoney } from "@/lib/money";
import { getMarket } from "@/config/markets";
import { listOrderRequests } from "@/modules/orders/service";

async function main() {
  const requests = await listOrderRequests();
  if (requests.length === 0) console.log("No requests yet.");
  const currency = getMarket().currency;

  for (const r of requests) {
    const total = formatMoney(r.estimatedLandedMinor + r.estimatedFeeMinor, currency, "en");
    const fee = formatMoney(r.estimatedFeeMinor, currency, "en");
    console.log(`\n${r.reference}  [${r.status}]  ${r.createdAt.toISOString().slice(0, 16).replace("T", " ")}`);
    console.log(`  item    : ${r.quantity} × ${r.productTitle} — ${r.supplierName}`);
    console.log(`  link    : ${r.offerUrl}`);
    console.log(`  estimate: ${total} (includes ${fee} fee)`);
    console.log(`  contact : ${r.contactName}, ${r.contactPhone}${r.contactEmail ? `, ${r.contactEmail}` : ""} — ${r.city} (${r.locale})`);
    if (r.note) console.log(`  note    : ${r.note}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDb);
