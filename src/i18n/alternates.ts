import { siteConfig } from "@/config/site";
import { DEFAULT_LOCALE, LOCALES, LOCALE_TAGS, type Locale } from "./config";
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

/**
 * The site-wide Open Graph fields plus this page's address (og:url, which Meta's
 * link checker asks for). A page's openGraph replaces the layout's, so every
 * page that sets one starts from this.
 */
export function pageOpenGraph(locale: Locale, path = "/") {
  return {
    siteName: siteConfig.name,
    type: "website" as const,
    locale: LOCALE_TAGS[locale].replace("-", "_"),
    url: localePath(locale, path),
    // The site's share picture ([lang]/opengraph-image); product pages put their photo instead.
    images: [{ url: localePath(locale, "/opengraph-image"), width: 1200, height: 630, alt: siteConfig.name }],
  };
}
