import type { ConversationDetails } from "@/db/schema";
import type { MarketConfig } from "@/config/markets";
import type { CartPlan } from "@/modules/cart/plan";
import { serviceFeeMinor } from "@/modules/orders/pricing";

/**
 * The items attached to a request, as saved with it: each parcel's lines
 * with their links, and the totals when it was sent. Pure.
 */
export function requestDetails(plan: CartPlan, market: MarketConfig): ConversationDetails | null {
  if (plan.parcels.length === 0) return null;
  return {
    currency: market.currency,
    parcels: plan.parcels.map((parcel) => ({
      store: parcel.store.name,
      storeUrl: parcel.store.websiteUrl,
      totalMinor: parcel.cost.totalMinor,
      lines: parcel.lines.map((line) => ({
        title: line.product.title,
        slug: line.product.slug,
        url: line.url,
        quantity: line.quantity,
        itemsMinor: line.itemsMinor,
      })),
    })),
    totalMinor: plan.totalMinor,
    feeMinor: serviceFeeMinor(plan.totalMinor, market),
  };
}

/** Every attached line, in order (for the subject and short summaries). */
export function detailLines(details: ConversationDetails | null): ConversationDetails["parcels"][number]["lines"] {
  return details ? details.parcels.flatMap((parcel) => parcel.lines) : [];
}
