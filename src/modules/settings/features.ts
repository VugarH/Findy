/**
 * Site features admins can switch off (Settings → Features) without a deploy.
 * Client-safe: no database here (see ./service.ts).
 */
export interface FeatureSwitches {
  /** "Recommended for you" (modules/recommendations): rows of deals picked from a visitor's interests. */
  recommendations: boolean;
}

export const DEFAULT_FEATURE_SWITCHES: FeatureSwitches = { recommendations: true };

/** A stored value as switches: unknown keys dropped, missing ones at their default. */
export function toFeatureSwitches(value: unknown): FeatureSwitches {
  const stored = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    recommendations:
      typeof stored.recommendations === "boolean" ? stored.recommendations : DEFAULT_FEATURE_SWITCHES.recommendations,
  };
}
