/**
 * Which filters the deal lists offer. Admins switch them in the panel
 * (Settings); a switched-off filter is hidden and its URL parameter ignored.
 * Client-safe: no database here (see ./service.ts).
 */

export const FILTER_NAMES = [
  "category",
  "subcategory",
  "audience",
  "brand",
  "sizes",
  "discount",
  "price",
  "source",
  "country",
] as const;
export type FilterName = (typeof FILTER_NAMES)[number];

export type FilterSwitches = Record<FilterName, boolean>;

/**
 * Sizes start switched off: while a size is chosen, deals from stores that
 * publish no sizes disappear, which is misleading until most stores have them.
 */
export const DEFAULT_FILTER_SWITCHES: FilterSwitches = {
  category: true,
  subcategory: true,
  audience: true,
  brand: true,
  sizes: false,
  discount: true,
  price: true,
  source: true,
  country: true,
};

/** A stored value as switches: unknown keys dropped, missing ones at their default. */
export function toFilterSwitches(value: unknown): FilterSwitches {
  const stored = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return Object.fromEntries(
    FILTER_NAMES.map((name) => [name, typeof stored[name] === "boolean" ? stored[name] : DEFAULT_FILTER_SWITCHES[name]]),
  ) as FilterSwitches;
}
