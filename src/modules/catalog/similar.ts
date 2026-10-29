import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { products, type Product } from "@/db/schema";
import type { MarketConfig } from "@/config/markets";
import { toCard, type ProductCardData } from "./card";
import { hasFreshOffer, loadProductsWithOffers } from "./offer-view";
import { namesDescribeSameItem } from "./same-item";
import { summarizeProduct } from "./summary";

export { namesDescribeSameItem };

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
  // Prices only: shown on every product page (and to crawlers), so no price history.
  const entries = await loadProductsWithOffers(market, new Date(), candidates.map((row) => row.id), { history: false });

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
