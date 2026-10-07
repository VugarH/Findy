export interface DiscountVerdict {
  /** Median price over the history window — what this offer "usually" costs. */
  usualMinor: number;
  /** Discount against the usual price. This is the only number we advertise. */
  realDiscountPct: number;
  /** Discount the supplier advertises against its own crossed-out price. */
  claimedDiscountPct: number | null;
  /** Today's price is at or below every price seen in the window. */
  isLowest: boolean;
  /** The supplier's claim is far bigger than what the history supports. */
  inflatedClaim: boolean;
  historyDays: number;
}

/** A claimed discount this many points above the real one is flagged as inflated. */
const INFLATED_CLAIM_GAP_PCT = 12;

/**
 * Judges a price against the offer's own history instead of trusting the
 * supplier's crossed-out "was" price. `history` must not include today.
 */
export function verifyDiscount(
  currentMinor: number,
  history: number[],
  listPriceMinor?: number | null,
): DiscountVerdict | null {
  if (history.length === 0) return null;

  const usualMinor = median(history);
  const realDiscountPct = round1(((usualMinor - currentMinor) / usualMinor) * 100);
  const claimedDiscountPct =
    listPriceMinor && listPriceMinor > currentMinor
      ? round1(((listPriceMinor - currentMinor) / listPriceMinor) * 100)
      : null;

  return {
    usualMinor,
    realDiscountPct,
    claimedDiscountPct,
    isLowest: currentMinor < usualMinor && currentMinor <= Math.min(...history),
    inflatedClaim:
      claimedDiscountPct !== null &&
      claimedDiscountPct - Math.max(realDiscountPct, 0) > INFLATED_CLAIM_GAP_PCT,
    historyDays: history.length,
  };
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
