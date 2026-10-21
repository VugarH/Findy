import type { CategorySlug } from "@/config/categories";
import { foldForMatching } from "@/lib/text";
import type { FeedOffer } from "./feed";

/**
 * Picks the few thousand offers worth showing out of a feed of hundreds of
 * thousands, while it streams by: our categories only, cheap enough, a real
 * discount, a share per category, and not too many from one seller. Pure.
 */
export interface SelectionRules {
  /** Offers kept per category; together the total. */
  quotas: Partial<Record<CategorySlug, number>>;
  /** Price bounds, in the feed's currency (whole units). */
  minPrice: number;
  maxPrice: number;
  /** Discount bounds in percent; above the maximum the "was" price is not believable. */
  minDiscountPct: number;
  maxDiscountPct: number;
  /** At most this many offers from one seller in a category. */
  maxPerShop: number;
  /** Titles that are never wanted: spare parts, wholesale lots, medical claims (matched on the folded title). */
  excludeTitle?: RegExp;
  /** A title readable as a product name (marketplaces have slogans and other languages); true when unset. */
  titleCheck?: (title: string) => boolean;
  /** What "one seller" means for maxPerShop: the feed's shopId (marketplaces) or the brand (single shops). */
  groupBy?: "shopId" | "vendor";
  /** Extra points, e.g. for dearer items where the commission is worth more. */
  bonus?: (offer: FeedOffer) => number;
}

export interface Candidate {
  offer: FeedOffer;
  category: CategorySlug;
  discountPct: number;
  score: number;
}

/** Discount from the offer's own old price, in whole percent; 0 without one. */
export function discountOf(offer: FeedOffer): number {
  return offer.oldPrice ? Math.round((1 - offer.price / offer.oldPrice) * 100) : 0;
}

/**
 * Ranks an offer: mostly its discount, a little its commission (what it earns
 * us), never a discount past the believable maximum. Every offer of a "hot
 * products" feed is already a best seller, so popularity is not scored here.
 */
export function scoreOf(discountPct: number, commissionPct: number): number {
  return Math.min(discountPct, 80) + 0.5 * Math.min(commissionPct, 20);
}

/** Whether an offer passes the price and discount rules (category is checked by the caller). */
export function qualifies(offer: FeedOffer, rules: SelectionRules): boolean {
  const discount = discountOf(offer);
  return (
    offer.price >= rules.minPrice &&
    offer.price <= rules.maxPrice &&
    discount >= rules.minDiscountPct &&
    discount <= rules.maxDiscountPct &&
    offer.pictures.length > 0 &&
    !rules.excludeTitle?.test(foldForMatching(offer.name)) &&
    (rules.titleCheck?.(offer.name) ?? true)
  );
}

/**
 * A copy that owns its text. Parsed strings are slices of the downloaded
 * chunks and keep them alive; a kept offer would hold the whole feed in memory.
 */
function detach(offer: FeedOffer): FeedOffer {
  const own = (text: string) => Buffer.from(text, "utf8").toString("utf8");
  return {
    ...offer,
    id: own(offer.id),
    name: own(offer.name),
    url: own(offer.url),
    categoryId: offer.categoryId && own(offer.categoryId),
    pictures: offer.pictures.slice(0, 1).map(own),
    vendor: offer.vendor && own(offer.vendor),
    extra: Object.fromEntries(Object.entries(offer.extra).map(([key, value]) => [own(key), own(value)])),
    params: Object.fromEntries(Object.entries(offer.params).map(([key, value]) => [own(key), own(value)])),
  };
}

/**
 * Collects candidates as they stream in and keeps memory bounded: each
 * category holds a few times its quota, trimmed to the best as it grows.
 */
export class Selector {
  private readonly pools = new Map<CategorySlug, Candidate[]>();

  constructor(private readonly rules: SelectionRules) {}

  add(offer: FeedOffer, category: CategorySlug | null): void {
    if (!category) return;
    const quota = this.rules.quotas[category];
    if (!quota || !qualifies(offer, this.rules)) return;
    const discountPct = discountOf(offer);
    const pool = this.pools.get(category) ?? [];
    const score = scoreOf(discountPct, parseFloat(offer.params.commissionRate ?? "0") || 0) + (this.rules.bonus?.(offer) ?? 0);
    pool.push({ offer: detach(offer), category, discountPct, score });
    if (pool.length > quota * 6) trim(pool, quota * 3);
    this.pools.set(category, pool);
  }

  /** The final pick: per category the best, at most `maxPerShop` per seller, up to its quota. */
  result(): Candidate[] {
    const picked: Candidate[] = [];
    for (const [category, pool] of this.pools) {
      const quota = this.rules.quotas[category] ?? 0;
      const perShop = new Map<string, number>();
      let taken = 0;
      for (const candidate of pool.sort(byScore)) {
        if (taken >= quota) break;
        const shop = (this.rules.groupBy === "vendor" ? candidate.offer.vendor : candidate.offer.params.shopId) ?? candidate.offer.id;
        const count = perShop.get(shop) ?? 0;
        if (count >= this.rules.maxPerShop) continue;
        perShop.set(shop, count + 1);
        picked.push(candidate);
        taken++;
      }
    }
    return picked;
  }
}

const byScore = (a: Candidate, b: Candidate) => b.score - a.score || a.offer.price - b.offer.price;

function trim(pool: Candidate[], keep: number): void {
  pool.sort(byScore);
  pool.length = keep;
}
