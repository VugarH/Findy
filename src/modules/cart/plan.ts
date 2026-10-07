import type { CurrencyCode } from "@/config/currencies";
import type { MarketConfig } from "@/config/markets";
import { convertMinor } from "@/lib/money";
import {
  computeParcelCost,
  dutyFreeLimitMinor,
  type LandedCost,
  type LandedCostInput,
} from "@/modules/pricing/landed-cost";
import type { SupplierScope } from "@/modules/suppliers/types";

/**
 * The parcel planner: groups the cart by store — everything from one store
 * travels as one parcel — and prices each parcel as a whole (one delivery
 * charge, customs on the parcel's total; see computeParcelCost). Pure, so the
 * numbers are tested and identical wherever they are shown.
 */

export interface CartProduct {
  productId: string;
  slug: string;
  title: string;
  brand: string | null;
  imageUrl: string | null;
  categorySlug: string;
}

export interface CartStore {
  id: string;
  name: string;
  scope: SupplierScope;
  originCountry: string;
  websiteUrl: string;
}

/** A cart line whose offer is in stock right now. */
export interface PlanInput {
  offerId: string;
  quantity: number;
  product: CartProduct;
  store: CartStore;
  /** The store's own price for one, in its currency. */
  storePriceMinor: number;
  currency: CurrencyCode;
  costInput: LandedCostInput;
  delivery: { min: number; max: number };
}

export interface PlannedLine {
  offerId: string;
  quantity: number;
  product: CartProduct;
  storePriceMinor: number;
  currency: CurrencyCode;
  /** The items alone (price × quantity) in the market currency, before delivery and customs. */
  itemsMinor: number;
}

export interface CustomsStatus {
  limitMinor: number;
  /** What customs looks at: the items plus delivery. */
  valueMinor: number;
  overMinor: number;
  /** How much more fits before customs applies. */
  roomMinor: number;
  /** Duty + VAT on this parcel. */
  chargedMinor: number;
}

export interface Parcel {
  store: CartStore;
  lines: PlannedLine[];
  /** The whole parcel: items, one delivery charge, customs, fees. */
  cost: LandedCost;
  /** The same lines each ordered on its own. */
  separateTotalMinor: number;
  /** What combining saves; negative when together they cross the duty-free limit. */
  savingsMinor: number;
  /** Everything in a parcel arrives together: the slowest item decides. */
  delivery: { min: number; max: number };
  weightKg: number;
  /** Null for a store in the market: no customs. */
  customs: CustomsStatus | null;
}

export interface CartPlan {
  parcels: Parcel[];
  totalMinor: number;
  itemCount: number;
  customsMinor: number;
  /** Positive savings only: what combining parcels saves overall. */
  savingsMinor: number;
  /** When the last parcel arrives; null for an empty plan. */
  delivery: { min: number; max: number } | null;
}

export function planParcels(inputs: PlanInput[], market: MarketConfig): CartPlan {
  // One parcel per store, in the order the stores first appear in the cart.
  const byStore = new Map<string, PlanInput[]>();
  for (const input of inputs) byStore.set(input.store.id, [...(byStore.get(input.store.id) ?? []), input]);

  const limitMinor = dutyFreeLimitMinor(market);
  const parcels = [...byStore.values()].map((group): Parcel => {
    const cost = computeParcelCost(
      group.map(({ costInput, quantity }) => ({ input: costInput, quantity })),
      market,
    );
    const separateTotalMinor = group.reduce(
      (sum, { costInput, quantity }) => sum + computeParcelCost([{ input: costInput, quantity }], market).totalMinor,
      0,
    );
    const store = group[0].store;
    const valueMinor = cost.itemMinor + cost.shippingMinor;
    return {
      store,
      lines: group.map((input) => ({
        offerId: input.offerId,
        quantity: input.quantity,
        product: input.product,
        storePriceMinor: input.storePriceMinor,
        currency: input.currency,
        itemsMinor: convertMinor(input.storePriceMinor * input.quantity, input.currency, market.currency, market.fxRates),
      })),
      cost,
      separateTotalMinor,
      savingsMinor: separateTotalMinor - cost.totalMinor,
      delivery: {
        min: Math.max(...group.map(({ delivery }) => delivery.min)),
        max: Math.max(...group.map(({ delivery }) => delivery.max)),
      },
      weightKg: group.reduce((sum, { costInput, quantity }) => sum + costInput.weightKg * quantity, 0),
      customs:
        store.scope === "local"
          ? null
          : {
              limitMinor,
              valueMinor,
              overMinor: Math.max(0, valueMinor - limitMinor),
              roomMinor: Math.max(0, limitMinor - valueMinor),
              chargedMinor: cost.dutyMinor + cost.vatMinor,
            },
    };
  });

  return {
    parcels,
    totalMinor: parcels.reduce((sum, parcel) => sum + parcel.cost.totalMinor, 0),
    itemCount: inputs.reduce((sum, input) => sum + input.quantity, 0),
    customsMinor: parcels.reduce((sum, parcel) => sum + (parcel.customs?.chargedMinor ?? 0), 0),
    savingsMinor: parcels.reduce((sum, parcel) => sum + Math.max(0, parcel.savingsMinor), 0),
    delivery: parcels.length
      ? {
          min: Math.max(...parcels.map((parcel) => parcel.delivery.min)),
          max: Math.max(...parcels.map((parcel) => parcel.delivery.max)),
        }
      : null,
  };
}

/** A cart line that cannot be bought from its store right now. */
export interface UnavailableLine {
  offerId: string;
  quantity: number;
  product: CartProduct;
  storeName: string;
  reason: "gone" | "outOfStock";
  /** The product's best offer now, when there is one elsewhere. */
  alternative: { offerId: string; storeName: string; landedMinor: number } | null;
}

/** Everything the cart page shows. */
export interface CartView extends CartPlan {
  unavailable: UnavailableLine[];
  /** Offers that no longer exist at all; the browser drops them from the cart. */
  unknown: string[];
}
