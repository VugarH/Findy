import { slugify } from "@/lib/slug";
import type { RawOffer } from "@/modules/suppliers/types";

/**
 * Product matching decides when listings from different stores are the same
 * product. Today: exact GTIN, then brand + maker's article number, then
 * normalised brand+model. The natural next step is an LLM / embedding matcher
 * for listings that have none of these — add it here and the rest of the
 * pipeline is unaffected.
 */
const MAX_KEY_LENGTH = 96;

export interface MatchKeys {
  gtin: string | null;
  modelKey: string;
}

export function matchKeysOf(raw: Pick<RawOffer, "gtin" | "mpn" | "brand" | "model" | "title">): MatchKeys {
  const gtin = raw.gtin?.replace(/\D/g, "") || null;
  // A maker's article number beats any wording: stores title the same sneaker differently.
  const modelKey =
    raw.brand && raw.mpn
      ? slugify(`${raw.brand} ${raw.mpn}`)
      : raw.brand && raw.model
        ? slugify(`${raw.brand} ${raw.model}`)
        : slugify(raw.title);
  // The key doubles as the product URL slug, so keep it a sane length.
  return { gtin, modelKey: modelKey.slice(0, MAX_KEY_LENGTH).replace(/-+$/, "") };
}

export function canonicalTitle(raw: Pick<RawOffer, "brand" | "model" | "title">): string {
  return raw.brand && raw.model ? `${raw.brand} ${raw.model}` : raw.title;
}
