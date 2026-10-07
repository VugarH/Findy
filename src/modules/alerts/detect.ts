/**
 * Is a price change worth telling someone about? Only a real fall counts:
 * at least `minDropPct` percent, so a foreign price wobbling with the exchange
 * rate does not page anyone.
 */
export function isNotableDrop(previousMinor: number, currentMinor: number, minDropPct: number): boolean {
  if (previousMinor <= 0 || currentMinor >= previousMinor) return false;
  return ((previousMinor - currentMinor) / previousMinor) * 100 >= minDropPct;
}

export function dropPercent(previousMinor: number, currentMinor: number): number {
  return Math.round(((previousMinor - currentMinor) / previousMinor) * 100);
}
