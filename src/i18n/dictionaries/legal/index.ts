import type { Locale } from "../../config";
import az from "./az";
import en, { type LegalDictionary } from "./en";
import ru from "./ru";

export type { LegalDictionary };

const DICTIONARIES: Record<Locale, LegalDictionary> = { az, en, ru };

/** The terms of use and privacy policy. Only the legal pages load them. */
export function getLegalDictionary(locale: Locale): LegalDictionary {
  return DICTIONARIES[locale];
}

/** When the texts last changed: shown on the pages. Update it with every change. */
export const LEGAL_UPDATED = "2026-10-28";
