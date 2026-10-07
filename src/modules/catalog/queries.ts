import { eq, max } from "drizzle-orm";
import { db } from "@/db/client";
import { offers, products, type Product } from "@/db/schema";
import type { MarketConfig } from "@/config/markets";
import { loadProductsWithOffers, type OfferView } from "./offer-view";
import { summarizeProduct, type ProductSummary } from "./summary";

export interface ProductDetail {
  product: Product;
  /** All fresh offers, cheapest landed first (includes out-of-stock ones). */
  offers: OfferView[];
  summary: ProductSummary | null;
  /** When a store last listed this product; tells "not checked lately" apart from "no longer sold". */
  lastSeenAt: Date | null;
}

export async function getProductDetail(slug: string, market: MarketConfig): Promise<ProductDetail | null> {
  const [product] = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
  // A switched-off product is gone for visitors: its page is "not found".
  if (!product || !product.active) return null;

  const [entry] = await loadProductsWithOffers(market, new Date(), [product.id]);
  if (entry) return { product, offers: entry.offers, summary: summarizeProduct(entry, market), lastSeenAt: null };

  const [seen] = await db.select({ at: max(offers.lastSeenAt) }).from(offers).where(eq(offers.productId, product.id));
  return { product, offers: [], summary: null, lastSeenAt: seen?.at ?? null };
}
