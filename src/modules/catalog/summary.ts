import type { MarketConfig } from "@/config/markets";
import { badgesFor, scoreDeal, type DealBadge } from "@/modules/deals/scoring";
import type { OfferView, ProductWithOffers } from "./offer-view";

/** The verified discount on a product's best offer. */
export interface DealVerdict {
  usualLandedMinor: number;
  savingsMinor: number;
  /** Discount on the landed total — consistent with the prices shown to users. */
  discountPct: number;
  score: number;
  badges: DealBadge[];
  /** True when our price history backs the discount; false for a store's own claim. */
  verified: boolean;
}

export interface ProductSummary {
  /** Cheapest in-stock offer by landed cost. */
  best: OfferView;
  bestLocal: OfferView | null;
  bestGlobal: OfferView | null;
  offerCount: number;
  /** Present only when the best offer is a verified discount. */
  deal: DealVerdict | null;
}

/**
 * Picks the best offers for a product and decides whether it is a real deal.
 * The single source of truth for the daily job, search results and product page.
 */
export function summarizeProduct(entry: ProductWithOffers, market: MarketConfig): ProductSummary | null {
  const available = entry.offers.filter((offer) => offer.inStock);
  if (available.length === 0) return null;

  const best = available[0];
  const bestLocal = available.find((offer) => offer.supplier.scope === "local") ?? null;
  const bestGlobal = available.find((offer) => offer.supplier.scope === "global") ?? null;

  // Colour variants from the same store are not competition for each other.
  const nextBestElsewhere = available.find((offer) => offer.supplier.id !== best.supplier.id);

  return { best, bestLocal, bestGlobal, offerCount: available.length, deal: judgeDeal(best, nextBestElsewhere, market) };
}

/** Unverified store claims rank below verified discounts of the same size. */
const STORE_CLAIM_SCORE_FACTOR = 0.7;

interface DiscountBasis {
  /** Landed price the offer is discounted from. */
  usualLandedMinor: number;
  /** Discount on the store's own price (before delivery and customs). */
  discountBasisPct: number;
  /** True when the reference is our own price history, false when it is the store's crossed-out price. */
  verified: boolean;
}

/**
 * What an offer's price is compared with. With enough history, only the
 * history counts — whatever the store claims; before that, the store's own
 * crossed-out price (when the market allows showing store claims).
 */
function discountBasis(offer: OfferView, market: MarketConfig): DiscountBasis | null {
  const { verdict } = offer;
  if (verdict !== null && verdict.historyDays >= market.deals.minHistoryDays) {
    return offer.usualLandedMinor === null
      ? null
      : { usualLandedMinor: offer.usualLandedMinor, discountBasisPct: verdict.realDiscountPct, verified: true };
  }
  if (market.deals.showStoreClaims && offer.listLandedMinor !== null && offer.listPriceMinor) {
    return {
      usualLandedMinor: offer.listLandedMinor,
      discountBasisPct: ((offer.listPriceMinor - offer.priceMinor) / offer.listPriceMinor) * 100,
      verified: false,
    };
  }
  return null;
}

export interface PriceBeforeDiscount {
  /** Landed total before the discount. */
  wasMinor: number;
  discountPct: number;
  verified: boolean;
}

/** The "was" price to show crossed out next to an offer, or null when it is not discounted. */
export function priceBeforeDiscount(offer: OfferView, market: MarketConfig): PriceBeforeDiscount | null {
  const basis = discountBasis(offer, market);
  if (!basis || basis.usualLandedMinor <= offer.landed.totalMinor) return null;
  const discountPct = Math.round(((basis.usualLandedMinor - offer.landed.totalMinor) / basis.usualLandedMinor) * 100);
  return discountPct >= 1 ? { wasMinor: basis.usualLandedMinor, discountPct, verified: basis.verified } : null;
}

function judgeDeal(best: OfferView, nextBest: OfferView | undefined, market: MarketConfig): DealVerdict | null {
  const basis = discountBasis(best, market);
  if (!basis || basis.discountBasisPct < market.deals.minRealDiscountPct) return null;
  const { usualLandedMinor, discountBasisPct, verified: hasHistory } = basis;
  const savingsMinor = usualLandedMinor - best.landed.totalMinor;
  if (savingsMinor <= 0) return null;

  const signals = {
    realDiscountPct: discountBasisPct,
    vsNextBestPct: nextBest
      ? ((nextBest.landed.totalMinor - best.landed.totalMinor) / nextBest.landed.totalMinor) * 100
      : 0,
    trustScore: best.supplier.trustScore,
    deliveryMaxDays: best.delivery.max,
    isLowest: hasHistory && best.verdict !== null && best.verdict.isLowest,
  };
  const score = Math.round(scoreDeal(signals) * (hasHistory ? 1 : STORE_CLAIM_SCORE_FACTOR));

  return {
    usualLandedMinor,
    savingsMinor,
    discountPct: Math.round((savingsMinor / usualLandedMinor) * 100),
    score,
    badges: badgesFor(signals, score),
    verified: hasHistory,
  };
}
