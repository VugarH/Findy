import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { offers, priceObservations, products, suppliers } from "@/db/schema";
import type { CurrencyCode } from "@/config/currencies";

/**
 * Offers entered by hand in the admin panel — a local shop without a website
 * feed, or one item a crawler does not reach. Nobody re-reads them from the
 * store, so the daily job re-confirms them: the price stays current (and
 * builds price history) until someone changes it or removes the offer.
 */
export interface ManualOfferInput {
  productId: string;
  supplierId: string;
  url: string;
  title: string;
  priceMinor: number;
  listPriceMinor: number | null;
  currency: CurrencyCode;
  inStock: boolean;
  shippingMinor: number | null;
  deliveryMinDays: number | null;
  deliveryMaxDays: number | null;
}

const MANUAL_ID_PREFIX = "manual-";

export async function createManualOffer(input: ManualOfferInput, now = new Date()): Promise<string> {
  const [saved] = await db
    .insert(offers)
    .values({
      ...input,
      externalId: `${MANUAL_ID_PREFIX}${randomUUID()}`,
      manual: true,
      firstSeenAt: now,
      lastSeenAt: now,
    })
    .returning({ id: offers.id });
  await observe(saved.id, input.priceMinor, input.currency, now);
  return saved.id;
}

/** Changes a manual offer; crawled offers are rewritten by every run, so they are not editable. */
export async function updateManualOffer(
  offerId: string,
  input: Omit<ManualOfferInput, "productId">,
  now = new Date(),
): Promise<boolean> {
  const [saved] = await db
    .update(offers)
    .set({ ...input, lastSeenAt: now })
    .where(and(eq(offers.id, offerId), eq(offers.manual, true)))
    .returning({ id: offers.id });
  if (!saved) return false;
  await observe(saved.id, input.priceMinor, input.currency, now);
  return true;
}

/** Removes a manual offer with its price history. Crawled offers would come back, so they cannot be removed. */
export async function deleteManualOffer(offerId: string): Promise<boolean> {
  const removed = await db
    .delete(offers)
    .where(and(eq(offers.id, offerId), eq(offers.manual, true)))
    .returning({ id: offers.id });
  return removed.length > 0;
}

/**
 * Daily job step: every manual offer of an active store and product is seen
 * again today. Stores that only have manual offers are marked as collected.
 */
export async function confirmManualOffers(now: Date): Promise<number> {
  const confirmed = await db
    .update(offers)
    .set({ lastSeenAt: now })
    .where(
      and(
        eq(offers.manual, true),
        sql`exists (select 1 from ${suppliers} where ${eq(suppliers.id, offers.supplierId)} and ${eq(suppliers.active, true)})`,
        sql`exists (select 1 from ${products} where ${eq(products.id, offers.productId)} and ${eq(products.active, true)})`,
      ),
    )
    .returning({ id: offers.id, priceMinor: offers.priceMinor, currency: offers.currency });

  const observedOn = now.toISOString().slice(0, 10);
  for (let i = 0; i < confirmed.length; i += 1000) {
    await db
      .insert(priceObservations)
      .values(
        confirmed
          .slice(i, i + 1000)
          .map((o) => ({ offerId: o.id, observedOn, priceMinor: o.priceMinor, currency: o.currency })),
      )
      .onConflictDoUpdate({
        target: [priceObservations.offerId, priceObservations.observedOn],
        set: { priceMinor: sql`excluded.price_minor`, currency: sql`excluded.currency` },
      });
  }

  await db.execute(sql`
    update ${suppliers} set
      last_success_at = ${now.toISOString()}::timestamptz,
      last_offer_count = (select count(*) from ${offers} where ${eq(offers.supplierId, suppliers.id)} and ${eq(offers.manual, true)}),
      last_error = null,
      last_error_at = null
    where ${suppliers.active} and ${suppliers.customConfig}->'connection'->>'type' = 'manual'`);

  return confirmed.length;
}

async function observe(offerId: string, priceMinor: number, currency: string, now: Date): Promise<void> {
  await db
    .insert(priceObservations)
    .values({ offerId, observedOn: now.toISOString().slice(0, 10), priceMinor, currency })
    .onConflictDoUpdate({
      target: [priceObservations.offerId, priceObservations.observedOn],
      set: { priceMinor, currency },
    });
}
