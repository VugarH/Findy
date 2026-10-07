import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { offers, products, suppliers } from "@/db/schema";
import type { MarketConfig } from "@/config/markets";
import { loadProductsWithOffers, type OfferView } from "@/modules/catalog/offer-view";
import { summarizeProduct } from "@/modules/catalog/summary";
import type { CartItem } from "./items";
import { planParcels, type CartProduct, type CartView, type PlanInput, type UnavailableLine } from "./plan";

/** Prices a cart with today's offers: available lines become parcels, the rest are listed with an alternative. */
export async function loadCart(market: MarketConfig, items: CartItem[], now = new Date()): Promise<CartView> {
  if (items.length === 0) return { ...planParcels([], market), unavailable: [], unknown: [] };

  // Every offer in the cart with its product, fresh or not, so a line can still be named when it has gone.
  const rows = await db
    .select({
      offerId: offers.id,
      supplierName: suppliers.name,
      product: {
        productId: products.id,
        slug: products.slug,
        title: products.title,
        brand: products.brand,
        imageUrl: products.imageUrl,
        categorySlug: products.categorySlug,
      },
    })
    .from(offers)
    .innerJoin(products, eq(offers.productId, products.id))
    .innerJoin(suppliers, eq(offers.supplierId, suppliers.id))
    .where(
      inArray(
        offers.id,
        items.map((item) => item.offerId),
      ),
    );
  const known = new Map(rows.map((row) => [row.offerId, row]));

  const productIds = [...new Set(rows.map((row) => row.product.productId))];
  const entries = await loadProductsWithOffers(market, now, productIds);
  const live = new Map<string, OfferView>();
  for (const entry of entries) for (const offer of entry.offers) live.set(offer.offerId, offer);
  const bestByProduct = new Map(
    entries.flatMap((entry) => {
      const summary = summarizeProduct(entry, market);
      return summary ? [[entry.product.id, summary.best] as const] : [];
    }),
  );

  const storeIds = [...new Set([...live.values()].map((offer) => offer.supplier.id))];
  const websites = new Map(
    storeIds.length
      ? (
          await db
            .select({ id: suppliers.id, websiteUrl: suppliers.websiteUrl })
            .from(suppliers)
            .where(inArray(suppliers.id, storeIds))
        ).map((row) => [row.id, row.websiteUrl])
      : [],
  );

  const available: PlanInput[] = [];
  const unavailable: UnavailableLine[] = [];
  for (const item of items) {
    const row = known.get(item.offerId);
    if (!row) continue;
    const product: CartProduct = row.product;
    const offer = live.get(item.offerId);
    if (offer?.inStock) {
      available.push({
        offerId: item.offerId,
        quantity: item.quantity,
        product,
        store: { ...offer.supplier, websiteUrl: websites.get(offer.supplier.id) ?? new URL(offer.url).origin },
        storePriceMinor: offer.priceMinor,
        currency: offer.currency,
        costInput: offer.costInput,
        delivery: offer.delivery,
      });
      continue;
    }
    const best = bestByProduct.get(product.productId);
    unavailable.push({
      offerId: item.offerId,
      quantity: item.quantity,
      product,
      storeName: row.supplierName,
      reason: offer ? "outOfStock" : "gone",
      alternative:
        best && best.offerId !== item.offerId
          ? { offerId: best.offerId, storeName: best.supplier.name, landedMinor: best.landed.totalMinor }
          : null,
    });
  }

  return {
    ...planParcels(available, market),
    unavailable,
    unknown: items.filter((item) => !known.has(item.offerId)).map((item) => item.offerId),
  };
}
