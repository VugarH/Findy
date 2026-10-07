import { z } from "zod";
import { CATEGORY_SLUGS, type CategorySlug } from "@/config/categories";
import type { CurrencyCode } from "@/config/currencies";
import { LIST_PRICE_SOURCES } from "./adapters/structured-data/list-price";
import { RELIABILITY_BASES } from "./types";

/**
 * The settings of a store added in the admin panel (`suppliers.custom_config`)
 * and how they are validated. Free of server code, so admin forms in the
 * browser can use the same lists; ./custom.ts turns the settings into an adapter.
 *
 *   shopify          a Shopify store: its /products.json
 *   structured-data  a store with a product sitemap and schema.org data on product pages
 *   manual           no connection: prices are entered by hand (catalog/manual-offers.ts)
 *
 * A new connector type = one more entry in `connectionSchema` and one more
 * case in `createCustomAdapter` (./custom.ts).
 */
export const CONNECTION_TYPES = ["shopify", "structured-data", "manual"] as const;
export type ConnectionType = (typeof CONNECTION_TYPES)[number];

const pattern = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .refine((value) => {
    try {
      new RegExp(value);
      return true;
    } catch {
      return false;
    }
  }, "invalidPattern");

/** An optional short text: empty means "not set". */
const optionalText = z
  .string()
  .trim()
  .max(80)
  .transform((value) => value || undefined)
  .optional();

export const connectionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("shopify"),
    /** Single-brand store whose `vendor` field is unreliable. */
    brand: optionalText,
  }),
  z.object({
    type: z.literal("structured-data"),
    sitemap: z.url(),
    /** Regular expression: which sitemap URLs are product pages. */
    productUrl: pattern,
    /** Regular expression: in a sitemap index, which child sitemaps list products. */
    productSitemaps: pattern.optional(),
    /** Regular expression: product URLs read first. */
    focus: pattern.optional(),
    listPrice: z.enum(LIST_PRICE_SOURCES).optional(),
    brand: optionalText,
    brandFromTitle: z.boolean().default(false),
    productsPerRun: z.number().int().min(10).max(1000).optional(),
  }),
  z.object({ type: z.literal("manual") }),
]);

export type Connection = z.infer<typeof connectionSchema>;

export const customConfigSchema = z.object({
  reliability: z.object({ basis: z.enum(RELIABILITY_BASES), note: z.string().trim().max(500) }),
  shipsToMarket: z.boolean(),
  /** The first is the store's main category; products that fit none of the others go there. */
  categories: z.array(z.enum(CATEGORY_SLUGS as [CategorySlug, ...CategorySlug[]])).min(1),
  connection: connectionSchema,
});

export type CustomConfig = z.infer<typeof customConfigSchema>;

export interface CustomStore {
  id: string;
  name: string;
  /** Scheme + host, e.g. "https://www.example.com". */
  websiteUrl: string;
  originCountry: string;
  currency: CurrencyCode;
  config: CustomConfig;
}

export const trustScoreFor = (basis: CustomConfig["reliability"]["basis"]) =>
  basis === "official-brand-store" ? 86 : 82;
