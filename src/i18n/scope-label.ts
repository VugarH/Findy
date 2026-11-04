import type { Dictionary } from "./dictionaries";

/**
 * Where a store sells from, as its tag says: "Local", "Turkey" for Turkish
 * stores (most of the stores abroad, and the country people know), else "Abroad".
 * Client-safe. The scope filter keeps the plain "Abroad", which covers Turkey too.
 */
export function scopeLabel(t: Dictionary, scope: "local" | "global", originCountry: string | null | undefined): string {
  if (scope === "local") return t.deal.local;
  return originCountry === "TR" ? t.deal.turkey : t.deal.global;
}
