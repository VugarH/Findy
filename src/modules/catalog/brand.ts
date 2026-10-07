/**
 * Stores spell the same brand differently ("ADIDAS", "adidas", "Adidas "), so
 * brand filters compare this key, never the display name. Keep it in step
 * with the SQL in deals/queries.ts (lower(trim(brand))).
 */
export function brandKey(brand: string): string {
  return brand.trim().toLowerCase();
}

/** URL form of a brand selection: keys joined by commas ("adidas,new balance"). */
export const BRAND_SEPARATOR = ",";
