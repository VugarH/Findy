import { and, eq, gte, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { offers, priceObservations, products, suppliers, type Product } from "@/db/schema";
import { getCategory, type CategorySlug } from "@/config/categories";
import type { CurrencyCode } from "@/config/currencies";
import type { MarketConfig } from "@/config/markets";
import { verifyDiscount, type DiscountVerdict } from "@/modules/deals/discount";
import {
  computeLandedCost,
  resolveDeliveryDays,
  type LandedCost,
  type LandedCostInput,
} from "@/modules/pricing/landed-cost";
import type { SupplierScope } from "@/modules/suppliers/types";

export interface PricePoint {
  date: string;
  priceMinor: number;
}

/** An offer with everything a buyer in a given market needs to judge it. */
export interface OfferView {
  offerId: string;
  supplier: { id: string; name: string; scope: SupplierScope; trustScore: number; originCountry: string };
  url: string;
  title: string;
  priceMinor: number;
  currency: CurrencyCode;
  listPriceMinor: number | null;
  inStock: boolean;
  /** Sizes the store lists and which are in stock; null when unknown or one size. */
  sizes: { label: string; inStock: boolean }[] | null;
  /** The inputs the landed cost was computed from; lets other features re-price (e.g. for a quantity). */
  costInput: LandedCostInput;
  landed: LandedCost;
  /** Landed cost at the offer's usual price; null without enough history. */
  usualLandedMinor: number | null;
  /** Landed cost at the store's own "was" price; null when it shows none. */
  listLandedMinor: number | null;
  delivery: { min: number; max: number };
  verdict: DiscountVerdict | null;
  history: PricePoint[];
}

export interface ProductWithOffers {
  product: Product;
  offers: OfferView[];
}

const DAY_MS = 86_400_000;

/**
 * Loads current offers (fresh ones only) with landed cost, delivery and the
 * discount verdict computed for `market`. Pass productIds to limit the load.
 */
/** Offers not seen in a store for this long are treated as gone: their products are not shown. */
export function freshSince(market: MarketConfig, now = new Date()): Date {
  return new Date(now.getTime() - market.deals.staleAfterHours * 3_600_000);
}

/**
 * SQL condition: the offer is live — its store confirmed it since `since`
 * (see freshSince) and did not drop it from its listing in a later read.
 */
export function offerIsLive(since: Date): SQL {
  return and(gte(offers.lastSeenAt, since), isNull(offers.removedAt))!;
}

/** SQL condition: the product is active and has a live offer. */
export function hasFreshOffer(market: MarketConfig, now = new Date()): SQL {
  return sql`${products.active} and exists (select 1 from ${offers} where ${eq(offers.productId, products.id)} and ${offerIsLive(freshSince(market, now))})`;
}

const OBSERVATION_BATCH = 20_000;

export async function loadProductsWithOffers(
  market: MarketConfig,
  now: Date,
  productIds?: string[],
): Promise<ProductWithOffers[]> {
  if (productIds && productIds.length === 0) return [];

  const rows = await db
    .select({ offer: offers, supplier: suppliers, product: products })
    .from(offers)
    .innerJoin(suppliers, eq(offers.supplierId, suppliers.id))
    .innerJoin(products, eq(offers.productId, products.id))
    .where(
      and(
        offerIsLive(freshSince(market, now)),
        eq(suppliers.active, true),
        eq(products.active, true),
        productIds ? inArray(offers.productId, productIds) : undefined,
      ),
    );
  if (rows.length === 0) return [];

  const windowStart = new Date(now.getTime() - market.deals.historyWindowDays * DAY_MS).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  // In batches: PostgreSQL allows at most 65,535 parameters per query, and a full catalog has more offers.
  const offerIds = rows.map((r) => r.offer.id);
  const observations: (typeof priceObservations.$inferSelect)[] = [];
  for (let i = 0; i < offerIds.length; i += OBSERVATION_BATCH) {
    observations.push(
      ...(await db
        .select()
        .from(priceObservations)
        .where(
          and(
            inArray(priceObservations.offerId, offerIds.slice(i, i + OBSERVATION_BATCH)),
            gte(priceObservations.observedOn, windowStart),
          ),
        )
        .orderBy(priceObservations.observedOn)),
    );
  }

  const historyByOffer = new Map<string, PricePoint[]>();
  for (const obs of observations) {
    const list = historyByOffer.get(obs.offerId) ?? [];
    list.push({ date: obs.observedOn, priceMinor: obs.priceMinor });
    historyByOffer.set(obs.offerId, list);
  }

  const grouped = new Map<string, ProductWithOffers>();
  for (const { offer, supplier, product } of rows) {
    const history = historyByOffer.get(offer.id) ?? [];
    const past = history.filter((point) => point.date < today).map((point) => point.priceMinor);
    const verdict = verifyDiscount(offer.priceMinor, past, offer.listPriceMinor);

    const costInput: LandedCostInput = {
      priceMinor: offer.priceMinor,
      currency: offer.currency as CurrencyCode,
      shippingMinor: offer.shippingMinor,
      weightKg: product.weightKg ?? getCategory(product.categorySlug as CategorySlug).defaultWeightKg,
      scope: supplier.scope,
      originCountry: supplier.originCountry,
    };

    const view: OfferView = {
      offerId: offer.id,
      supplier: {
        id: supplier.id,
        name: supplier.name,
        scope: supplier.scope,
        trustScore: supplier.trustScore,
        originCountry: supplier.originCountry,
      },
      url: offer.url,
      title: offer.title,
      priceMinor: offer.priceMinor,
      currency: offer.currency as CurrencyCode,
      listPriceMinor: offer.listPriceMinor,
      inStock: offer.inStock,
      sizes: offer.sizes ?? null,
      costInput,
      landed: computeLandedCost(costInput, market),
      usualLandedMinor: verdict
        ? computeLandedCost({ ...costInput, priceMinor: verdict.usualMinor }, market).totalMinor
        : null,
      listLandedMinor:
        offer.listPriceMinor && offer.listPriceMinor > offer.priceMinor
          ? computeLandedCost({ ...costInput, priceMinor: offer.listPriceMinor }, market).totalMinor
          : null,
      delivery: resolveDeliveryDays(offer, supplier.originCountry, market),
      verdict,
      history,
    };

    const entry = grouped.get(product.id) ?? { product, offers: [] };
    entry.offers.push(view);
    grouped.set(product.id, entry);
  }

  for (const entry of grouped.values()) {
    entry.offers = onePerStore(entry.offers.sort((a, b) => a.landed.totalMinor - b.landed.totalMinor));
  }
  return [...grouped.values()];
}

/**
 * One offer per store. A store often lists each colour of a product as its own
 * listing (Champion: navy, grey, red…); they are one product here, and a
 * shopper compares stores, not colours. Keeps each store's cheapest offer that
 * is in stock, else its cheapest. Expects offers sorted cheapest first.
 */
export function onePerStore<T extends { supplier: { id: string }; inStock: boolean }>(offers: T[]): T[] {
  const kept = new Map<string, T>();
  for (const offer of offers) {
    const current = kept.get(offer.supplier.id);
    if (!current || (!current.inStock && offer.inStock)) kept.set(offer.supplier.id, offer);
  }
  const keep = new Set(kept.values());
  return offers.filter((offer) => keep.has(offer));
}
