import { toMinor } from "@/lib/money";
import { hashUnit } from "@/lib/hash";
import { slugify } from "@/lib/slug";
import type { CurrencyCode } from "@/config/currencies";
import type { AdapterContext, RawOffer, SupplierAdapter, SupplierDefinition } from "../../types";
import { DEMO_PRODUCTS, demoGtin, type DemoProduct } from "./catalog";

/** Rough USD rates, only for turning the demo base price into a store currency. */
const USD_TO: Record<CurrencyCode, number> = {
  USD: 1,
  AZN: 1.7,
  EUR: 0.92,
  GBP: 0.79,
  TRY: 40.5,
  CNY: 7.2,
};

const DAY_MS = 86_400_000;
const PROMO_BLOCK_DAYS = 6;

export interface DemoSupplierProfile {
  definition: SupplierDefinition;
  /** Store price level relative to the product's base price. */
  priceLevel: number;
  /** Share of the matching catalog this store carries. */
  coverage: number;
  /** Chance that a product is on promotion in any given promo window. */
  promoRate: number;
  /** Shipping to the market in the store currency; null = no direct shipping. */
  shipping: number | null;
  deliveryDays?: { min: number; max: number };
  /** Some stores publish no GTIN, which exercises brand+model matching. */
  publishesGtin: boolean;
  /** Stores that always show a crossed-out price far above what they ever charged. */
  inflatesListPrice: boolean;
  titleStyle: "brand-first" | "model-first";
  /** Simulated response time range for live search, in ms. */
  latencyMs: [number, number];
}

/**
 * A supplier whose prices are a deterministic function of (store, product, day).
 * That makes the daily job repeatable and lets the seed script back-fill a
 * realistic price history by replaying past days.
 */
export class DemoSupplierAdapter implements SupplierAdapter {
  readonly definition: SupplierDefinition;

  constructor(private readonly profile: DemoSupplierProfile) {
    this.definition = profile.definition;
  }

  async fetchCatalog(ctx: AdapterContext): Promise<RawOffer[]> {
    return DEMO_PRODUCTS.filter((product) => !product.webOnly && this.carries(product)).map(
      (product) => this.toOffer(product, ctx.now),
    );
  }

  async search(query: string, ctx: AdapterContext): Promise<RawOffer[]> {
    const [min, max] = this.profile.latencyMs;
    const delay = min + hashUnit(`${this.definition.id}|${query}`) * (max - min);
    await new Promise((resolve) => setTimeout(resolve, delay));

    const tokens = slugify(query).split("-").filter(Boolean);
    if (tokens.length === 0) return [];

    return DEMO_PRODUCTS.filter((product) => {
      if (!this.carries(product)) return false;
      const haystack = slugify(`${product.brand} ${product.model}`);
      return tokens.every((token) => haystack.includes(token));
    }).map((product) => this.toOffer(product, ctx.now));
  }

  private carries(product: DemoProduct): boolean {
    if (!this.definition.categories.includes(product.category)) return false;
    return hashUnit(`carry|${this.definition.id}|${product.key}`) < this.profile.coverage;
  }

  private toOffer(product: DemoProduct, now: Date): RawOffer {
    const { definition, profile } = this;
    const seed = `${definition.id}|${product.key}`;
    const day = Math.floor(now.getTime() / DAY_MS);

    const storeBias = 0.96 + hashUnit(`bias|${seed}`) * 0.08;
    const drift = 1 + Math.sin(day / 17 + hashUnit(`phase|${seed}`) * 6.28) * 0.025;
    const regular = product.baseUsd * USD_TO[definition.currency] * profile.priceLevel * storeBias;

    const promoBlock = Math.floor((day + Math.floor(hashUnit(`offset|${seed}`) * PROMO_BLOCK_DAYS)) / PROMO_BLOCK_DAYS);
    const onPromo = hashUnit(`promo|${seed}|${promoBlock}`) < profile.promoRate;
    const promoDepth = onPromo ? 0.1 + hashUnit(`depth|${seed}|${promoBlock}`) * 0.28 : 0;

    const price = prettyPrice(regular * drift * (1 - promoDepth));

    let listPrice: number | undefined;
    if (profile.inflatesListPrice) listPrice = prettyPrice(regular * 1.45);
    else if (onPromo) listPrice = prettyPrice(regular);

    const title =
      profile.titleStyle === "brand-first"
        ? `${product.brand} ${product.model}`
        : `${product.model} – ${product.brand}`;

    return {
      externalId: slugify(product.key),
      url: `${definition.websiteUrl}/p/${slugify(product.key)}`,
      title,
      brand: product.brand,
      model: product.model,
      gtin: profile.publishesGtin ? demoGtin(product) : undefined,
      categorySlug: product.category,
      priceMinor: toMinor(price),
      currency: definition.currency,
      listPriceMinor: listPrice ? toMinor(listPrice) : undefined,
      shippingMinor: profile.shipping === null ? null : toMinor(profile.shipping),
      weightKg: product.weightKg,
      inStock: hashUnit(`stock|${seed}|${Math.floor(day / 9)}`) > 0.06,
      deliveryDays: profile.deliveryDays,
    };
  }
}

/** Shop-style rounding: 1 234.99 rather than 1 234.5617. */
function prettyPrice(value: number): number {
  if (value < 20) return Math.round(value * 100) / 100;
  if (value < 2000) return Math.floor(value) + 0.99;
  return Math.round(value / 10) * 10 - 1;
}
