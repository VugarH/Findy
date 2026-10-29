import { foldForMatching } from "@/lib/text";
import { brandKey } from "./brand";
import type { ProductCardData } from "./card";
import { namesDescribeSameItem } from "./same-item";

/**
 * Ranking "Similar items" (./related.ts), pure: a similar name counts most,
 * then a similar price, the same brand a little, and how good a deal it is.
 */

/** Price band: from half to twice the product's price. */
export const PRICE_BAND = { low: 0.5, high: 2 };
const WEIGHT = { name: 0.5, price: 0.3, brand: 0.15, deal: 0.2 } as const;
const MAX_PER_BRAND = 2;
const MAX_PER_STORE = 3;

/** Title words that say what a product is: folded, without the brand and very short words. */
function nameWords(title: string, brand: string | null): Set<string> {
  const brandWords = new Set(brand ? foldForMatching(brand).split(/\s+/) : []);
  return new Set(
    foldForMatching(title)
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length >= 3 && !brandWords.has(word)),
  );
}

/** Share of words two titles have in common (Jaccard), 0–1. */
function sharedWords(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let common = 0;
  for (const word of a) if (b.has(word)) common++;
  return common / (a.size + b.size - common);
}

/**
 * The `limit` best alternatives, pure. `candidates` come in deal order (best
 * deal first). The product itself and the same item at another store are left
 * out; brands and stores are mixed.
 */
export function rankRelated<T extends Pick<ProductCardData, "productId" | "title" | "brand" | "supplierId" | "landedMinor">>(
  source: { productId: string; title: string; brand: string | null; landedMinor: number },
  candidates: T[],
  limit: number,
): T[] {
  const words = nameWords(source.title, source.brand);
  const sourceBrand = source.brand ? brandKey(source.brand) : null;
  const scored = candidates
    .filter((c) => c.productId !== source.productId)
    .map((candidate, index, list) => {
      const name = sharedWords(words, nameWords(candidate.title, candidate.brand));
      const sameBrand = sourceBrand !== null && candidate.brand !== null && brandKey(candidate.brand) === sourceBrand;
      // The same item under a slightly different name, from another store: "Find elsewhere" shows those.
      const sameItem = sameBrand && name >= 0.6 && namesDescribeSameItem(source.title, candidate.title);
      const priceGap = Math.abs(Math.log(candidate.landedMinor / Math.max(1, source.landedMinor)));
      const score =
        WEIGHT.name * name +
        WEIGHT.price * Math.max(0, 1 - priceGap / Math.log(PRICE_BAND.high)) +
        WEIGHT.brand * Number(sameBrand) +
        WEIGHT.deal * (1 - index / Math.max(1, list.length));
      return { candidate, score, sameItem };
    })
    .filter(({ sameItem }) => !sameItem)
    .sort((a, b) => b.score - a.score);

  const perBrand = new Map<string, number>();
  const perStore = new Map<string, number>();
  const picked: T[] = [];
  for (const { candidate } of scored) {
    if (picked.length >= limit) break;
    const brand = candidate.brand ? brandKey(candidate.brand) : "";
    if (brand && (perBrand.get(brand) ?? 0) >= MAX_PER_BRAND) continue;
    if ((perStore.get(candidate.supplierId) ?? 0) >= MAX_PER_STORE) continue;
    if (brand) perBrand.set(brand, (perBrand.get(brand) ?? 0) + 1);
    perStore.set(candidate.supplierId, (perStore.get(candidate.supplierId) ?? 0) + 1);
    picked.push(candidate);
  }
  return picked;
}
