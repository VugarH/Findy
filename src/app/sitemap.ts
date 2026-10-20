import type { MetadataRoute } from "next";
import { CATEGORIES } from "@/config/categories";
import { getMarket } from "@/config/markets";
import { siteUrl } from "@/config/site";
import { DEFAULT_LOCALE, LOCALES } from "@/i18n/config";
import { localePath } from "@/i18n/format";
import { listSitemapProducts } from "@/modules/deals/queries";

// Products with deals change every day.
export const dynamic = "force-dynamic";

/** Sitemaps take at most 50,000 addresses; each page is listed once, with its other languages as alternates. */
const MAX_PRODUCTS = 40_000;

/** The public pages for search engines: fixed pages, categories and every product that has a deal now. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const entry = (path: string, extra: Partial<MetadataRoute.Sitemap[number]> = {}): MetadataRoute.Sitemap[number] => ({
    url: base + localePath(DEFAULT_LOCALE, path),
    alternates: { languages: Object.fromEntries(LOCALES.map((locale) => [locale, base + localePath(locale, path)])) },
    ...extra,
  });

  const products = await listSitemapProducts(getMarket(), MAX_PRODUCTS);
  return [
    entry("/", { changeFrequency: "daily", priority: 1 }),
    entry("/deals", { changeFrequency: "daily", priority: 0.9 }),
    entry("/top", { changeFrequency: "daily", priority: 0.8 }),
    entry("/fresh", { changeFrequency: "daily", priority: 0.8 }),
    ...CATEGORIES.map((category) => entry(`/category/${category.slug}`, { changeFrequency: "daily", priority: 0.8 })),
    entry("/stores", { changeFrequency: "weekly", priority: 0.5 }),
    entry("/ordering-abroad", { changeFrequency: "monthly", priority: 0.5 }),
    entry("/terms", { changeFrequency: "yearly", priority: 0.2 }),
    entry("/privacy", { changeFrequency: "yearly", priority: 0.2 }),
    ...products.map((product) => entry(`/product/${product.slug}`, { lastModified: product.updatedAt, changeFrequency: "daily", priority: 0.6 })),
  ];
}
