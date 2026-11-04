/**
 * The total split for display: "45,20 ₼ = 35,00 ₼ + 10,20 ₼ delivery/customs".
 * The item price is the store's own price in the market currency; the rest is
 * delivery, customs and fees. Null when there is nothing to add (a local store
 * that delivers for free) or the item price is unknown. Pure and client-safe.
 */
export function priceParts(totalMinor: number, itemMinor: number | null | undefined): { itemMinor: number; extraMinor: number } | null {
  if (itemMinor == null || itemMinor <= 0 || itemMinor >= totalMinor) return null;
  return { itemMinor, extraMinor: totalMinor - itemMinor };
}
