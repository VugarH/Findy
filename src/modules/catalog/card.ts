import { usableImage } from "@/config/images";
import type { Product } from "@/db/schema";
import type { Audience } from "@/config/audience";
import type { CategorySlug } from "@/config/categories";
import type { SupplierScope } from "@/modules/suppliers/types";
import { inStockSizeKeys } from "@/modules/suppliers/sizes";
import { storeDiscount, type ProductSummary } from "./summary";

/** The flat, serialisable shape every product card in the UI renders from. */
export interface ProductCardData {
  productId: string;
  /** The best offer — what "Add to cart" adds. */
  offerId: string;
  slug: string;
  title: string;
  brand: string | null;
  categorySlug: CategorySlug;
  subcategorySlug: string;
  audience: Audience | null;
  /** When we first saw this product in any store (ISO string, so the card stays serialisable). */
  addedAt: string;
  /** Country the best offer ships from. */
  originCountry: string;
  imageUrl: string | null;
  /** Landed total of the best offer, in the market currency. */
  landedMinor: number;
  /**
   * The store's own discount (its crossed-out price): the badge, the crossed-out
   * total and the saving. Null when the store shows none. Our own check is
   * `verified` / `fresh`, shown apart from this number.
   */
  usualLandedMinor: number | null;
  discountPct: number | null;
  savingsMinor: number | null;
  /** True when our own price history backs the deal. */
  verified: boolean;
  supplierId: string;
  supplierName: string;
  scope: SupplierScope;
  deliveryMaxDays: number;
  badges: string[];
  offerCount: number;
  bestLocalLandedMinor: number | null;
  bestGlobalLandedMinor: number | null;
  /** Sizes in stock at the best offer's store (sizeKey form); null when it lists none. */
  sizes: string[] | null;
  /** A recent price drop measured by our own checks (modules/deals/fresh-drop.ts); absent when none. */
  fresh?: CardFresh | null;
}

export interface CardFresh {
  dropPct: number;
  /** Landed total at the price we compared with. */
  fromLandedMinor: number;
  /** The day we recorded that price (YYYY-MM-DD). */
  fromOn: string;
  storeDiscountPct: number;
  /** The days the drop is measured over (market.deals.freshDrop.windowDays), for "−20% in 3 days". */
  windowDays: number;
}

export function toCard(product: Product, summary: ProductSummary): ProductCardData {
  const { best, deal } = summary;
  const store = storeDiscount(best);
  return {
    productId: product.id,
    offerId: best.offerId,
    slug: product.slug,
    title: product.title,
    brand: product.brand,
    categorySlug: product.categorySlug as CategorySlug,
    subcategorySlug: product.subcategorySlug,
    audience: product.audience as Audience | null,
    addedAt: product.createdAt.toISOString(),
    originCountry: best.supplier.originCountry,
    imageUrl: usableImage(product.imageUrl),
    landedMinor: best.landed.totalMinor,
    usualLandedMinor: store?.wasLandedMinor ?? null,
    discountPct: store?.pct ?? null,
    savingsMinor: store?.savingsMinor ?? null,
    verified: deal?.verified ?? false,
    supplierId: best.supplier.id,
    supplierName: best.supplier.name,
    scope: best.supplier.scope,
    deliveryMaxDays: best.delivery.max,
    badges: deal?.badges ?? [],
    offerCount: summary.offerCount,
    bestLocalLandedMinor: summary.bestLocal?.landed.totalMinor ?? null,
    bestGlobalLandedMinor: summary.bestGlobal?.landed.totalMinor ?? null,
    sizes: inStockSizeKeys(best.sizes),
  };
}
