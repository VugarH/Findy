import type { Product } from "@/db/schema";
import type { Audience } from "@/config/audience";
import type { CategorySlug } from "@/config/categories";
import type { SupplierScope } from "@/modules/suppliers/types";
import { inStockSizeKeys } from "@/modules/suppliers/sizes";
import type { ProductSummary } from "./summary";

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
  usualLandedMinor: number | null;
  discountPct: number | null;
  savingsMinor: number | null;
  /** False when the discount is the store's own claim, not yet backed by our history. */
  verified: boolean;
  supplierName: string;
  scope: SupplierScope;
  deliveryMaxDays: number;
  badges: string[];
  offerCount: number;
  bestLocalLandedMinor: number | null;
  bestGlobalLandedMinor: number | null;
  /** Sizes in stock at the best offer's store (sizeKey form); null when it lists none. */
  sizes: string[] | null;
}

export function toCard(product: Product, summary: ProductSummary): ProductCardData {
  const { best, deal } = summary;
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
    imageUrl: product.imageUrl,
    landedMinor: best.landed.totalMinor,
    usualLandedMinor: deal?.usualLandedMinor ?? null,
    discountPct: deal?.discountPct ?? null,
    savingsMinor: deal?.savingsMinor ?? null,
    verified: deal?.verified ?? false,
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
