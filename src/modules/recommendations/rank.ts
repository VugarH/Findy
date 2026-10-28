import { brandKey } from "@/modules/catalog/brand";
import type { InterestProfile } from "./profile";

/**
 * Ordering deals for one visitor, pure: how well a deal fits their interests,
 * then how good a deal it is (its place in "Best deals"), mixed so no brand or
 * store fills the row.
 */

export interface Candidate {
  productId: string;
  categorySlug: string;
  subcategorySlug: string;
  brand: string | null;
  supplierId: string;
}

/** How much each kind of match counts: a brand someone likes says the most. */
const MATCH_WEIGHT = { category: 1, subcategory: 1.5, brand: 2 } as const;
/** A better deal (earlier in "Best deals") wins among equally fitting ones. */
const DEAL_RANK_WEIGHT = 0.3;
const MAX_PER_BRAND = 2;
const MAX_PER_STORE = 3;

/** Fit with the visitor's interests, 0 when nothing matches. */
export function interestScore(candidate: Candidate, profile: InterestProfile): number {
  const relative = (map: Record<string, number>, key: string | null) => {
    const top = Math.max(0, ...Object.values(map));
    return key && top > 0 ? (map[key] ?? 0) / top : 0;
  };
  return (
    MATCH_WEIGHT.category * relative(profile.categories, candidate.categorySlug) +
    MATCH_WEIGHT.subcategory * relative(profile.subcategories, `${candidate.categorySlug}/${candidate.subcategorySlug}`) +
    MATCH_WEIGHT.brand * relative(profile.brands, candidate.brand ? brandKey(candidate.brand) : null)
  );
}

/**
 * The `limit` candidates to show, best first. `candidates` come in deal order
 * (best deal first); products the visitor opened recently are left out.
 */
export function rankForVisitor<T extends Candidate>(candidates: T[], profile: InterestProfile, limit: number): T[] {
  const viewed = new Set(profile.viewed);
  const scored = candidates
    .filter((c) => !viewed.has(c.productId))
    .map((candidate, index, list) => ({
      candidate,
      score: interestScore(candidate, profile) + DEAL_RANK_WEIGHT * (1 - index / Math.max(1, list.length)),
    }))
    .filter(({ score }) => score > DEAL_RANK_WEIGHT)
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
