import { z } from "zod";
import { AUDIENCES } from "@/config/audience";
import { CATEGORY_SLUGS, type CategorySlug } from "@/config/categories";
import { CURRENCIES, type CurrencyCode } from "@/config/currencies";
import { isSubcategoryOf } from "@/config/subcategories";
import type { AudienceChoice, SubcategoryChoice } from "@/modules/catalog/placement";
import { customConfigSchema, CONNECTION_TYPES, type CustomConfig } from "@/modules/suppliers/custom-config";
import { checked, fieldErrors, parseAmountToMinor, text, type AdminErrorKey } from "./forms";
import type { NewProduct, ProductEdit } from "./products";
import type { CustomStoreInput } from "./stores";

/**
 * Reading the admin forms. Each parser takes the submitted FormData and
 * returns either clean input for the services in this module or an error key
 * per field. Field names in the forms are the keys used here.
 */
export type Parsed<T> = { ok: true; data: T } | { ok: false; errors: Record<string, AdminErrorKey> };

const categorySlug = z.enum(CATEGORY_SLUGS as [CategorySlug, ...CategorySlug[]], "chooseCategory");
const currency = z.enum(Object.keys(CURRENCIES) as [CurrencyCode, ...CurrencyCode[]], "invalid");
const optional = (value: string) => value || null;
const webUrl = z.url({ protocol: /^https?$/, error: "invalidUrl" });

// ——— Stores ———

export function parseStoreForm(form: FormData): Parsed<CustomStoreInput> {
  const errors: Record<string, AdminErrorKey> = {};

  const name = text(form, "name");
  if (!name) errors.name = "required";
  else if (name.length > 80) errors.name = "tooLong";

  const website = webUrl.safeParse(text(form, "websiteUrl"));
  if (!website.success) errors.websiteUrl = "invalidUrl";

  const originCountry = text(form, "originCountry").toUpperCase();
  if (!/^[A-Z]{2}$/.test(originCountry)) errors.originCountry = "invalidCountry";

  const money = currency.safeParse(text(form, "currency"));
  if (!money.success) errors.currency = "invalid";

  const main = text(form, "mainCategory");
  const others = form
    .getAll("otherCategories")
    .map(String)
    .filter((slug) => slug !== main);
  const type = text(form, "connection.type");
  const number = text(form, "connection.productsPerRun");

  const config = customConfigSchema.safeParse({
    reliability: { basis: text(form, "reliabilityBasis"), note: text(form, "reliabilityNote") },
    shipsToMarket: checked(form, "shipsToMarket"),
    categories: [main, ...others],
    connection:
      type === "structured-data"
        ? {
            type,
            sitemap: text(form, "connection.sitemap"),
            productUrl: text(form, "connection.productUrl"),
            productSitemaps: text(form, "connection.productSitemaps") || undefined,
            focus: text(form, "connection.focus") || undefined,
            listPrice: text(form, "connection.listPrice") || undefined,
            brand: text(form, "connection.brand"),
            brandFromTitle: checked(form, "connection.brandFromTitle"),
            productsPerRun: number ? Number(number) : undefined,
          }
        : type === "shopify"
          ? { type, brand: text(form, "connection.brand") }
          : { type: (CONNECTION_TYPES as readonly string[]).includes(type) ? type : "manual" },
  });
  if (!config.success) {
    for (const [field, key] of Object.entries(fieldErrors(config.error))) {
      // The form has one select for the main category; "categories.0" errors belong there.
      const name = field.startsWith("categories")
        ? "mainCategory"
        : field.startsWith("reliability")
          ? "reliabilityBasis"
          : field;
      errors[name] ??= field.startsWith("categories")
        ? "chooseCategory"
        : key === "invalid" && field === "connection.sitemap"
          ? "invalidUrl"
          : key;
    }
  }

  if (Object.keys(errors).length > 0 || !website.success || !money.success || !config.success)
    return { ok: false, errors };
  return {
    ok: true,
    data: {
      name,
      websiteUrl: new URL(website.data).origin,
      originCountry,
      currency: money.data,
      config: config.data satisfies CustomConfig,
    },
  };
}

// ——— Products ———

export function parseSubcategory(category: CategorySlug | undefined, value: string): SubcategoryChoice | null {
  if (value === "auto") return "auto";
  return category && isSubcategoryOf(category, value) ? value : null;
}

export function parseAudience(value: string): AudienceChoice | null {
  if (value === "auto" || value === "none") return value;
  return (AUDIENCES as readonly string[]).includes(value) ? (value as AudienceChoice) : null;
}

const GTIN = /^\d{8,14}$/;

export function parseProductForm(form: FormData): Parsed<ProductEdit> {
  const errors: Record<string, AdminErrorKey> = {};

  const title = text(form, "title");
  if (!title) errors.title = "required";
  else if (title.length > 200) errors.title = "tooLong";

  const brand = optional(text(form, "brand"));
  if (brand && brand.length > 80) errors.brand = "tooLong";

  const gtin = optional(text(form, "gtin").replace(/\s/g, ""));
  if (gtin && !GTIN.test(gtin)) errors.gtin = "invalid";

  const imageUrl = optional(text(form, "imageUrl"));
  if (imageUrl && !webUrl.safeParse(imageUrl).success) errors.imageUrl = "invalidUrl";

  const weightText = text(form, "weightKg").replace(",", ".");
  const weightKg = weightText ? Number(weightText) : null;
  if (weightKg !== null && !(weightKg > 0 && weightKg <= 500)) errors.weightKg = "invalid";

  const category = categorySlug.safeParse(text(form, "categorySlug"));
  if (!category.success) errors.categorySlug = "chooseCategory";
  const subcategory = parseSubcategory(category.data, text(form, "subcategory") || "auto");
  if (!subcategory) errors.subcategory = "chooseCategory";
  const audience = parseAudience(text(form, "audience") || "auto");
  if (!audience) errors.audience = "invalid";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: {
      title,
      brand,
      gtin,
      imageUrl,
      weightKg,
      categorySlug: category.data!,
      subcategory: subcategory!,
      audience: audience!,
    },
  };
}

// ——— Offers entered by hand ———

export interface OfferFormData {
  supplierId: string;
  url: string;
  priceMinor: number;
  listPriceMinor: number | null;
  shippingMinor: number | null;
  currency: CurrencyCode;
  inStock: boolean;
  deliveryMinDays: number | null;
  deliveryMaxDays: number | null;
}

function parseDays(value: string): number | null | undefined {
  if (!value) return null;
  const days = Number(value);
  return Number.isInteger(days) && days >= 0 && days <= 120 ? days : undefined;
}

/** Field names carry a prefix when the offer is part of a bigger form ("offer.price"). */
export function parseOfferForm(form: FormData, prefix = ""): Parsed<OfferFormData> {
  const errors: Record<string, AdminErrorKey> = {};
  const field = (name: string) => `${prefix}${name}`;

  const supplierId = text(form, field("supplierId"));
  if (!supplierId) errors[field("supplierId")] = "required";

  const url = webUrl.safeParse(text(form, field("url")));
  if (!url.success) errors[field("url")] = "invalidUrl";

  const priceMinor = parseAmountToMinor(text(form, field("price")));
  if (priceMinor === null) errors[field("price")] = "invalidPrice";

  const listText = text(form, field("listPrice"));
  const listPriceMinor = listText ? parseAmountToMinor(listText) : null;
  if (listText && listPriceMinor === null) errors[field("listPrice")] = "invalidPrice";
  else if (listPriceMinor !== null && priceMinor !== null && listPriceMinor <= priceMinor)
    errors[field("listPrice")] = "listBelowPrice";

  const shippingText = text(form, field("shipping"));
  const shippingMinor = !shippingText
    ? null
    : /^0+([.,]0+)?$/.test(shippingText)
      ? 0
      : parseAmountToMinor(shippingText);
  if (shippingText && shippingMinor === null) errors[field("shipping")] = "invalidPrice";

  const money = currency.safeParse(text(form, field("currency")));
  if (!money.success) errors[field("currency")] = "invalid";

  const deliveryMinDays = parseDays(text(form, field("deliveryMin")));
  const deliveryMaxDays = parseDays(text(form, field("deliveryMax")));
  if (deliveryMinDays === undefined) errors[field("deliveryMin")] = "invalid";
  if (
    deliveryMaxDays === undefined ||
    (deliveryMinDays != null && deliveryMaxDays != null && deliveryMaxDays < deliveryMinDays)
  ) {
    errors[field("deliveryMax")] = "invalid";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: {
      supplierId,
      url: url.data!,
      priceMinor: priceMinor!,
      listPriceMinor,
      shippingMinor,
      currency: money.data!,
      inStock: checked(form, field("inStock")),
      deliveryMinDays: deliveryMinDays ?? null,
      deliveryMaxDays: deliveryMaxDays ?? null,
    },
  };
}

export function parseNewProductForm(form: FormData): Parsed<NewProduct> {
  const product = parseProductForm(form);
  const offer = parseOfferForm(form, "offer.");
  const model = optional(text(form, "model"));
  if (!product.ok || !offer.ok) {
    return { ok: false, errors: { ...(product.ok ? {} : product.errors), ...(offer.ok ? {} : offer.errors) } };
  }
  return { ok: true, data: { ...product.data, model, offer: offer.data } };
}

// ——— Selections in lists ———

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_BULK = 500;

/** The ids ticked in a list (checkboxes named "ids"). */
export function selectedIds(form: FormData): string[] {
  return [
    ...new Set(
      form
        .getAll("ids")
        .map(String)
        .filter((id) => UUID.test(id)),
    ),
  ].slice(0, MAX_BULK);
}
