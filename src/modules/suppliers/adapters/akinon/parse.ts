import { detectCategory, type CategorySlug } from "@/config/categories";
import type { CurrencyCode } from "@/config/currencies";
import { toMinor } from "@/lib/money";
import { articleNumberOf, detectBrand, stripBrand } from "@/modules/catalog/normalizers/fashion";
import { isSizeOptionName, normalizeSizes, type SizeOption } from "../../sizes";
import type { RawOffer } from "../../types";

/**
 * Akinon (the platform behind several Turkish chains) renders category pages
 * with the listed products embedded in the page's Next.js data, each with its
 * price, crossed-out price, cart offers, stock, sizes and photos. One request
 * reads a whole page of products (48 on SuperStep).
 */
export interface AkinonListingProduct {
  pk: string;
  name: string;
  sku?: string;
  base_code?: string;
  price: string;
  retail_price?: string;
  in_stock?: boolean;
  absolute_url: string;
  attributes?: Record<string, unknown>;
  productimage_set?: { image?: string }[];
  basket_offers?: {
    label?: string;
    listing_kwargs?: { quantity?: string | number; discounted_total_price?: string | number };
    client_types?: unknown[];
  }[];
  extra_data?: { variants?: { attribute_key?: string; options?: { label?: string; in_stock?: boolean }[] }[] };
}

export interface AkinonPage {
  products: AkinonListingProduct[];
  /** Products in the whole listing, as the page states it. */
  totalCount: number | null;
}

/** The products a category page lists, and how many the listing has in all. */
export function readListingPage(html: string): AkinonPage {
  // The data sits inside JavaScript strings, with its quotes escaped.
  const text = html.replace(/\\"/g, '"');
  const products: AkinonListingProduct[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(/\{"pk":"?\d+"?,"name":"/g)) {
    const json = balancedObject(text, match.index);
    if (!json || !json.includes('"absolute_url"') || !json.includes('"basket_offers"')) continue;
    try {
      const product = JSON.parse(json) as AkinonListingProduct;
      // Variant entries nested inside a product repeat the same shape without cart offers; the outer one wins.
      if (typeof product.absolute_url !== "string" || seen.has(String(product.pk))) continue;
      seen.add(String(product.pk));
      products.push(product);
    } catch {
      // Not the shape we expect: skip it.
    }
  }
  const total = /"total_count":"?(\d+)/.exec(text);
  return { products, totalCount: total ? Number(total[1]) : null };
}

/**
 * The price a shopper pays for one item: the listed price, or less when a cart
 * offer for a single item applies to everyone ("SEPETTE %30 İNDİRİM").
 */
export function payablePrice(product: AkinonListingProduct): number {
  const listed = Number(product.price);
  const inCart = (product.basket_offers ?? [])
    .filter((offer) => Number(offer.listing_kwargs?.quantity ?? 1) === 1 && (offer.client_types ?? []).length === 0)
    .map((offer) => Number(offer.listing_kwargs?.discounted_total_price))
    .filter((price) => price > 0 && price < listed);
  return Math.min(listed, ...inCart);
}

export interface AkinonStoreShape {
  origin: string;
  currency: CurrencyCode;
  categories: CategorySlug[];
}

/** One listing as an offer, or null when it fits none of the store's categories. */
export function toRawOffer(product: AkinonListingProduct, store: AkinonStoreShape): RawOffer | null {
  const url = new URL(product.absolute_url, store.origin).toString();
  const category = detectCategory(store.categories, `${product.name} ${product.absolute_url.replace(/[-_/]+/g, " ")}`);
  if (!category) return null;

  const price = payablePrice(product);
  const regular = Math.max(Number(product.price), Number(product.retail_price ?? 0));
  // Stores name the brand field differently (SuperStep: integration_alt_marka "ADIDAS", Sportive:
  // integration_marka_label "NİKE"); a known brand gets its usual spelling.
  const statedBrand = [product.attributes?.integration_alt_marka, product.attributes?.integration_marka_label].find(
    (value): value is string => typeof value === "string" && value.trim() !== "",
  );
  const brand = detectBrand(product.name) ?? (statedBrand ? (detectBrand(statedBrand) ?? titleCase(statedBrand)) : undefined);
  const modelColour = product.attributes?.integration_model_renk;
  const sizes = sizesOf(product);

  return {
    // The listed entry is one size, picked by the store, so its SKU and barcode change from day
    // to day; the model + colour code names the product itself.
    externalId: (typeof modelColour === "string" && modelColour) || product.base_code || product.sku || product.absolute_url,
    url,
    title: product.name,
    brand,
    model: brand ? stripBrand(product.name, brand) : undefined,
    mpn: articleNumberOf(brand, [product.base_code, product.sku, product.absolute_url, product.name], category) ?? undefined,
    categorySlug: category,
    imageUrl: product.productimage_set?.[0]?.image,
    priceMinor: toMinor(price),
    currency: store.currency,
    listPriceMinor: regular > price ? toMinor(regular) : undefined,
    shippingMinor: null,
    // The listed entry is one size; the product is buyable when any size is.
    inStock: sizes ? sizes.some((size) => size.inStock) : product.in_stock === true,
    sizes,
  };
}

function sizesOf(product: AkinonListingProduct): SizeOption[] | undefined {
  for (const variant of product.extra_data?.variants ?? []) {
    if (!isSizeOptionName((variant.attribute_key ?? "").replace(/^integration_/, ""))) continue;
    const sizes = normalizeSizes(
      (variant.options ?? []).flatMap((option) =>
        typeof option.label === "string" ? [{ label: option.label, inStock: option.in_stock === true }] : [],
      ),
    );
    if (sizes) return sizes;
  }
  return undefined;
}

function titleCase(text: string): string {
  return text.toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

/** The JSON object starting at `start`, found by matching braces outside strings. */
function balancedObject(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  const limit = Math.min(text.length, start + 300_000);
  for (let i = start; i < limit; i++) {
    const char = text[i];
    if (inString) {
      if (char === "\\") i++;
      else if (char === '"') inString = false;
    } else if (char === '"') inString = true;
    else if (char === "{") depth++;
    else if (char === "}" && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}
