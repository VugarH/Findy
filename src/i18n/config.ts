export const LOCALES = ["az", "en", "ru"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "az";

export const LOCALE_LABELS: Record<Locale, string> = {
  az: "Azərbaycanca",
  en: "English",
  ru: "Русский",
};

/** BCP 47 tags used for number and date formatting. */
export const LOCALE_TAGS: Record<Locale, string> = {
  az: "az-AZ",
  en: "en-GB",
  ru: "ru-RU",
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}
