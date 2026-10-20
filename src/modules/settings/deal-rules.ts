/**
 * Which discounts count as deals, switched by admins (Settings → Deal rules).
 * Client-safe: no database here (see ./service.ts).
 */
export interface DealRules {
  /** Store discounts stay listed after our history is long enough, unless they are confirmed. */
  keepStoreClaims: boolean;
}

export const DEFAULT_DEAL_RULES: DealRules = { keepStoreClaims: true };

/** A stored value as rules: unknown keys dropped, missing ones at their default. */
export function toDealRules(value: unknown): DealRules {
  const stored = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    keepStoreClaims: typeof stored.keepStoreClaims === "boolean" ? stored.keepStoreClaims : DEFAULT_DEAL_RULES.keepStoreClaims,
  };
}
