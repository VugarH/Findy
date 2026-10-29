import type { MarketConfig } from "@/config/markets";
import type { ProductCardData } from "@/modules/catalog/card";
import { listDeals } from "@/modules/deals/queries";

/**
 * The cards of a visitor's saved products, in the order they were saved.
 * Only products listed today come back; the rest are not on sale right now.
 */
export async function favoriteCards(market: MarketConfig, productIds: string[]): Promise<ProductCardData[]> {
  if (productIds.length === 0) return [];
  const { items } = await listDeals(market, { productIds, limit: productIds.length });
  const byId = new Map(items.map((card) => [card.productId, card]));
  return productIds.flatMap((id) => byId.get(id) ?? []);
}
