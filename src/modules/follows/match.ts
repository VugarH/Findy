import type { FollowKind } from "./keys";

/**
 * Which new deals go to whom. Pure: the job (./notify.ts) loads the follows
 * and the deals that started since its last run, and this decides the messages.
 */

export interface NewDeal {
  productId: string;
  title: string;
  slug: string;
  /** brandKey() of the product's brand, or null. */
  brandKey: string | null;
  storeId: string;
  storeName: string;
  categorySlug: string;
  landedMinor: number;
  usualLandedMinor: number;
  discountPct: number;
  score: number;
  dealSince: Date;
}

export interface FollowRef {
  userId: string;
  kind: FollowKind;
  key: string;
  label: string;
  createdAt: Date;
}

export interface FollowGroup<F extends FollowRef = FollowRef> {
  follow: F;
  deals: NewDeal[];
}

export const NEW_DEAL_LIMITS = { perFollow: 5, perPerson: 15 } as const;

function matches(follow: FollowRef, deal: NewDeal): boolean {
  // Only deals that started after the person began following.
  if (deal.dealSince <= follow.createdAt) return false;
  if (follow.kind === "brand") return deal.brandKey === follow.key;
  if (follow.kind === "store") return deal.storeId === follow.key;
  return deal.categorySlug === follow.key;
}

/**
 * Groups each person's new deals by what they follow: the best deals first,
 * at most `perFollow` per follow and `perPerson` in all, and a product only
 * once even when it matches several follows (a brand and a store). Colour
 * variants (same title, same store) count as one: the best of them is sent.
 */
export function matchNewDeals<F extends FollowRef>(
  followList: F[],
  newDeals: NewDeal[],
  limits: { perFollow: number; perPerson: number } = NEW_DEAL_LIMITS,
): Map<string, FollowGroup<F>[]> {
  const ranked = [...newDeals].sort((a, b) => b.score - a.score);
  const byUser = new Map<string, FollowGroup<F>[]>();
  const sent = new Map<string, Set<string>>();
  const variant = (deal: NewDeal) => `${deal.storeId}|${deal.title.trim().toLowerCase()}`;

  for (const follow of followList) {
    const seen = sent.get(follow.userId) ?? new Set<string>();
    const total = () => (byUser.get(follow.userId) ?? []).reduce((sum, group) => sum + group.deals.length, 0);
    if (total() >= limits.perPerson) continue;
    const picked: NewDeal[] = [];
    for (const deal of ranked) {
      if (picked.length >= limits.perFollow || total() + picked.length >= limits.perPerson) break;
      if (seen.has(deal.productId) || seen.has(variant(deal)) || !matches(follow, deal)) continue;
      picked.push(deal);
      seen.add(deal.productId);
      seen.add(variant(deal));
    }
    sent.set(follow.userId, seen);
    if (picked.length) byUser.set(follow.userId, [...(byUser.get(follow.userId) ?? []), { follow, deals: picked }]);
  }
  return byUser;
}
