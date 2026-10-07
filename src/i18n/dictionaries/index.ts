import type { Locale } from "../config";
import az from "./az";
import en, { type Dictionary } from "./en";
import ru from "./ru";

export type { Dictionary };

const DICTIONARIES: Record<Locale, Dictionary> = { az, en, ru };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}
