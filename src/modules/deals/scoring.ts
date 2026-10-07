export type DealBadge = "lowest_price" | "top_deal" | "fast_delivery";

export interface DealSignals {
  realDiscountPct: number;
  /** How much cheaper (landed) this offer is than the next-best store, in %. */
  vsNextBestPct: number;
  /** Supplier trust, 0–100. */
  trustScore: number;
  deliveryMaxDays: number;
  isLowest: boolean;
}

const WEIGHTS = { discount: 45, vsNextBest: 15, trust: 15, delivery: 10, lowest: 15 } as const;
const TOP_DEAL_SCORE = 70;

/**
 * 0–100 ranking score. Tune the weights here; nothing else depends on how the
 * number is made, only that higher means a better deal.
 */
export function scoreDeal(signals: DealSignals): number {
  const discount = clamp01(signals.realDiscountPct / 40) * WEIGHTS.discount;
  const vsNextBest = clamp01(signals.vsNextBestPct / 25) * WEIGHTS.vsNextBest;
  const trust = clamp01((signals.trustScore - 50) / 50) * WEIGHTS.trust;
  const delivery = deliveryFactor(signals.deliveryMaxDays) * WEIGHTS.delivery;
  const lowest = signals.isLowest ? WEIGHTS.lowest : 0;
  return Math.round(discount + vsNextBest + trust + delivery + lowest);
}

export function badgesFor(signals: DealSignals, score: number): DealBadge[] {
  const badges: DealBadge[] = [];
  if (signals.isLowest) badges.push("lowest_price");
  if (score >= TOP_DEAL_SCORE) badges.push("top_deal");
  if (signals.deliveryMaxDays <= 3) badges.push("fast_delivery");
  return badges;
}

function deliveryFactor(maxDays: number): number {
  if (maxDays <= 3) return 1;
  if (maxDays <= 10) return 0.6;
  if (maxDays <= 20) return 0.3;
  return 0;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
