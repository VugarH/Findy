import { DEFAULT_LOCALE, LOCALES, type Locale } from "./config";
import { localePath } from "./format";

/**
 * A page's main address and its other languages, for search engines: the
 * same page in az/en/ru is one page in three languages, not three duplicates.
 * Relative paths; the layout's metadataBase makes them absolute.
 */
export function pageAlternates(locale: Locale, path = "/") {
  return {
    canonical: localePath(locale, path),
    languages: {
      ...Object.fromEntries(LOCALES.map((other) => [other, localePath(other, path)])),
      "x-default": localePath(DEFAULT_LOCALE, path),
    },
  };
}
