import type { Locale } from "../../config";
import az from "./az";
import en, { type AdminDictionary } from "./en";
import ru from "./ru";

export type { AdminDictionary };

const DICTIONARIES: Record<Locale, AdminDictionary> = { az, en, ru };

/** The admin panel's text. Only the admin layout loads it. */
export function getAdminDictionary(locale: Locale): AdminDictionary {
  return DICTIONARIES[locale];
}
