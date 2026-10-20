import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { deals, freshDeals } from "@/db/schema";
import type { MarketConfig } from "@/config/markets";
import { loadProductsWithOffers } from "@/modules/catalog/offer-view";
import { usableImage } from "@/config/images";
import { storeDiscount, summarizeProduct } from "@/modules/catalog/summary";
import { inStockSizeKeys } from "@/modules/suppliers/sizes";
import { offerFreshDrop } from "./fresh-drop";

const INSERT_BATCH = 1000;

/**
 * Rebuilds the published deal catalog (and the fresh real deals) for a market from current offers.
 * The swap happens in one transaction, so the site never shows a half-built list.
 */
export async function buildDeals(market: MarketConfig, runId: string, now: Date): Promise<number> {
  const entries = await loadProductsWithOffers(market, now);
  // A product that stays a deal keeps the time it became one; only new deals get `now`.
  const previous = await db
    .select({ productId: deals.productId, dealSince: deals.dealSince })
    .from(deals)
    .where(eq(deals.marketCode, market.code));
  const since = new Map(previous.map((row) => [row.productId, row.dealSince]));

  const freshRows: (typeof freshDeals.$inferInsert)[] = [];
  const rows = entries.flatMap((entry) => {
    // No usable photo, no deal card: a grey box looks like a broken site.
    if (!usableImage(entry.product.imageUrl)) return [];
    const summary = summarizeProduct(entry, market);
    const fresh = summary && offerFreshDrop(summary.best, market);
    if (summary && fresh) {
      freshRows.push({
        marketCode: market.code,
        productId: entry.product.id,
        offerId: summary.best.offerId,
        categorySlug: entry.product.categorySlug,
        dropPct: fresh.dropPct,
        landedMinor: summary.best.landed.totalMinor,
        fromLandedMinor: fresh.fromLandedMinor,
        fromOn: fresh.fromOn,
        storeDiscountPct: fresh.storeDiscountPct,
        createdAt: now,
      });
    }
    if (!summary?.deal) return [];
    const { best, deal } = summary;
    const store = storeDiscount(best);
    return [
      {
        marketCode: market.code,
        productId: entry.product.id,
        offerId: best.offerId,
        categorySlug: entry.product.categorySlug,
        subcategorySlug: entry.product.subcategorySlug,
        audience: entry.product.audience,
        originCountry: best.supplier.originCountry,
        scope: best.supplier.scope,
        landedMinor: best.landed.totalMinor,
        usualLandedMinor: deal.usualLandedMinor,
        savingsMinor: deal.savingsMinor,
        breakdown: best.landed,
        realDiscountPct: deal.discountPct,
        verified: deal.verified,
        claimedDiscountPct: best.verdict?.claimedDiscountPct ?? null,
        storeDiscountPct: store?.pct ?? null,
        storeListLandedMinor: store?.wasLandedMinor ?? null,
        bestLocalLandedMinor: summary.bestLocal?.landed.totalMinor ?? null,
        bestGlobalLandedMinor: summary.bestGlobal?.landed.totalMinor ?? null,
        offerCount: summary.offerCount,
        deliveryMinDays: best.delivery.min,
        deliveryMaxDays: best.delivery.max,
        score: deal.score,
        badges: deal.badges as string[],
        runId,
        createdAt: now,
        dealSince: since.get(entry.product.id) ?? now,
        sizes: inStockSizeKeys(best.sizes),
      },
    ];
  });

  await db.transaction(async (tx) => {
    await tx.delete(deals).where(eq(deals.marketCode, market.code));
    // In batches: PostgreSQL allows at most 65,535 parameters per statement.
    for (let i = 0; i < rows.length; i += INSERT_BATCH) {
      await tx.insert(deals).values(rows.slice(i, i + INSERT_BATCH));
    }
    await tx.delete(freshDeals).where(eq(freshDeals.marketCode, market.code));
    for (let i = 0; i < freshRows.length; i += INSERT_BATCH) {
      await tx.insert(freshDeals).values(freshRows.slice(i, i + INSERT_BATCH));
    }
  });

  return rows.length;
}
