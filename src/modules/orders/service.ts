import { randomInt } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { offers, orderRequests, products, type OrderRequest } from "@/db/schema";
import type { MarketConfig } from "@/config/markets";
import type { Locale } from "@/i18n/config";
import { loadProductsWithOffers, type OfferView } from "@/modules/catalog/offer-view";
import { estimateAssistedOrder } from "./pricing";

/** An abroad offer that can be ordered through us, with the product it belongs to. */
export interface OrderableOffer {
  productId: string;
  productTitle: string;
  productSlug: string;
  offer: OfferView;
}

export async function getOrderableOffer(offerId: string, market: MarketConfig): Promise<OrderableOffer | null> {
  if (!market.assistedOrder.enabled) return null;
  const [row] = await db
    .select({ productId: offers.productId, title: products.title, slug: products.slug })
    .from(offers)
    .innerJoin(products, eq(offers.productId, products.id))
    .where(eq(offers.id, offerId))
    .limit(1);
  if (!row) return null;

  const [entry] = await loadProductsWithOffers(market, new Date(), [row.productId]);
  const offer = entry?.offers.find((candidate) => candidate.offerId === offerId);
  // Local stores need no help, and we do not take requests for something that is sold out.
  if (!offer || offer.supplier.scope !== "global" || !offer.inStock) return null;
  return { productId: row.productId, productTitle: row.title, productSlug: row.slug, offer };
}

export interface OrderRequestInput {
  quantity: number;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  city: string;
  note: string | null;
}

/** Letters and digits that cannot be misread over the phone (no 0/O, 1/I/L). */
const REFERENCE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const newReference = () =>
  `SR-${Array.from({ length: 6 }, () => REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)]).join("")}`;

export async function createOrderRequest(
  target: OrderableOffer,
  input: OrderRequestInput,
  context: { market: MarketConfig; locale: Locale; userId: string | null },
): Promise<string> {
  // Priced again on the server: the figures stored are ours, not whatever the browser sent.
  const estimate = estimateAssistedOrder(target.offer.costInput, context.market, input.quantity);

  const [created] = await db
    .insert(orderRequests)
    .values({
      reference: newReference(),
      marketCode: context.market.code,
      userId: context.userId,
      productId: target.productId,
      offerId: target.offer.offerId,
      productTitle: target.productTitle,
      supplierName: target.offer.supplier.name,
      offerUrl: target.offer.url,
      quantity: estimate.quantity,
      estimatedLandedMinor: estimate.landed.totalMinor,
      estimatedFeeMinor: estimate.feeMinor,
      contactName: input.contactName,
      contactPhone: input.contactPhone,
      contactEmail: input.contactEmail,
      city: input.city,
      note: input.note,
      locale: context.locale,
    })
    .returning({ reference: orderRequests.reference });
  return created.reference;
}

export async function listUserOrderRequests(userId: string): Promise<OrderRequest[]> {
  return db.select().from(orderRequests).where(eq(orderRequests.userId, userId)).orderBy(desc(orderRequests.createdAt)).limit(50);
}

/** Newest first, for whoever handles the requests. */
export async function listOrderRequests(limit = 100): Promise<OrderRequest[]> {
  return db.select().from(orderRequests).orderBy(desc(orderRequests.createdAt)).limit(limit);
}
