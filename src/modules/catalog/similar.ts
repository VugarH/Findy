import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { products, type Product } from "@/db/schema";
import type { MarketConfig } from "@/config/markets";
import { toCard, type ProductCardData } from "./card";
import { hasFreshOffer, loadProductsWithOffers } from "./offer-view";
import { summarizeProduct } from "./summary";

export interface SimilarProduct {
  card: ProductCardData;
  /** 0–1 name similarity to the reference product. */
  similarity: number;
  /** Close enough in name that it is most likely the same item. */
  likelySame: boolean;
}

const CANDIDATES = 60;
const MAX_RESULTS = 24;
const MIN_SIMILARITY = 0.3;
const LIKELY_SAME = 0.6;

/** Words that turn a product into a different model ("Pro", "Max"…). */
const VARIANT_WORDS = new Set(["pro", "max", "ultra", "plus", "lite", "mini", "fe", "se", "air", "note", "neo", "5g", "4g"]);

/**
 * Names can be nearly identical and still be different products: "Honor 600"
 * vs "Honor 600 Pro", "8/256GB" vs "12/256GB". Two names count as the same
 * item only if they also agree on every number and every variant word.
 */
export function namesDescribeSameItem(a: string, b: string): boolean {
  const signature = (title: string) => {
    const tokens = title.toLowerCase().match(/[a-z]+|\d+/g) ?? [];
    return tokens.filter((token) => /^\d+$/.test(token) || VARIANT_WORDS.has(token)).sort().join(" ");
  };
  return signature(a) === signature(b);
}

/**
 * "Is this sold elsewhere, and for how much?" — products in the same category
 * whose names are closest to the given one (trigram similarity), limited to
 * those available from at least one store other than `excludeSupplierId`.
 * Exact matches are already merged into one product at ingest; this catches
 * the ones stores name too differently for that.
 */
export async function findSimilarProducts(
  product: Product,
  market: MarketConfig,
  excludeSupplierId?: string,
): Promise<SimilarProduct[]> {
  const similarity = sql<number>`similarity(${products.title}, ${product.title})`;
  const candidates = await db
    .select({ id: products.id, similarity })
    .from(products)
    .where(
      and(
        ne(products.id, product.id),
        eq(products.categorySlug, product.categorySlug),
        sql`${similarity} >= ${MIN_SIMILARITY}`,
        hasFreshOffer(market),
      ),
    )
    .orderBy(desc(similarity))
    .limit(CANDIDATES);
  if (candidates.length === 0) return [];

  const score = new Map(candidates.map((row) => [row.id, Number(row.similarity)]));
  const entries = await loadProductsWithOffers(market, new Date(), candidates.map((row) => row.id));

  return entries
    .flatMap((entry): SimilarProduct[] => {
      const elsewhere = entry.offers.filter((offer) => offer.inStock && offer.supplier.id !== excludeSupplierId);
      const summary = summarizeProduct({ product: entry.product, offers: elsewhere }, market);
      if (!summary) return [];
      const value = score.get(entry.product.id) ?? 0;
      const likelySame = value >= LIKELY_SAME && namesDescribeSameItem(product.title, entry.product.title);
      return [{ card: toCard(entry.product, summary), similarity: value, likelySame }];
    })
    .sort(
      (a, b) =>
        Number(b.likelySame) - Number(a.likelySame) ||
        b.similarity - a.similarity ||
        a.card.landedMinor - b.card.landedMinor,
    )
    .slice(0, MAX_RESULTS);
}
