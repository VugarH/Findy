/**
 * Sizes a store offers for a product, and which of them can be bought.
 * Read from data the daily job already downloads (no extra requests):
 * Shopify's product options, schema.org ProductGroup variants, and the
 * variant list Akinon-based Turkish stores embed in their product pages.
 */

export interface SizeOption {
  label: string;
  inStock: boolean;
}

/** Most sizes kept per listing; more is almost always noise (a colour list read as sizes). */
const MAX_SIZES = 40;

/** Option names that mean "size" in the stores' languages. */
const SIZE_NAME = /\b(size|sizes|beden|numara|ölçü|olcu|taglia|gr[öo]ße|talla|pointure|tamanho|razmer|размер)\b/i;

/** "One size" is not a choice worth showing. */
const ONE_SIZE = /^(one ?size|os|o\/s|tek ?beden|std|standart|standard|default title|n\/a|-)$/i;

export const isSizeOptionName = (name: string | null | undefined): boolean => !!name && SIZE_NAME.test(name);

/** Cleans a list: trims, merges duplicates (in stock if any copy is), keeps the store's order. Undefined when there is no real choice. */
export function normalizeSizes(list: SizeOption[]): SizeOption[] | undefined {
  const byLabel = new Map<string, SizeOption>();
  for (const { label, inStock } of list) {
    const clean = label.replace(/\s+/g, " ").trim();
    if (!clean || clean.length > 24) continue;
    const key = clean.toLowerCase();
    const known = byLabel.get(key);
    if (known) known.inStock ||= inStock;
    else byLabel.set(key, { label: clean, inStock });
  }
  const sizes = sortSizes([...byLabel.values()]).slice(0, MAX_SIZES);
  if (sizes.length === 0 || sizes.every((size) => ONE_SIZE.test(size.label))) return undefined;
  return sizes;
}

const LETTER_ORDER = ["xxxs", "xxs", "xs", "s", "m", "l", "xl", "xxl", "xxxl", "xxxxl"];

/** Letter sizes as XXS…4XL ("2XL" = "XXL"); -1 when the label is not one. */
function letterRank(label: string): number {
  const value = label
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/^(\d)x([ls])$/, (_, n: string, end: string) => `${"x".repeat(Number(n))}${end}`);
  return LETTER_ORDER.indexOf(value);
}

/** "42,5" / "8.5" / "42" as a number; NaN otherwise. */
const numeric = (label: string) => (/^\d+([.,]\d+)?$/.test(label) ? Number(label.replace(",", ".")) : Number.NaN);

/**
 * Stores list sizes in their own order (some jumbled: XL, XXL, L, M…). All
 * letter sizes or all numbers are put in size order; anything mixed stays as the store has it.
 */
export function sortSizes(sizes: SizeOption[]): SizeOption[] {
  if (sizes.every((size) => letterRank(size.label) >= 0)) {
    return [...sizes].sort((a, b) => letterRank(a.label) - letterRank(b.label));
  }
  if (sizes.every((size) => !Number.isNaN(numeric(size.label)))) {
    return [...sizes].sort((a, b) => numeric(a.label) - numeric(b.label));
  }
  return sizes;
}

/** Shopify: the option named like "Size", read from each variant's option1/2/3. */
export function sizesFromShopify(
  options: { name: string; position?: number }[] | undefined,
  variants: { option1?: string | null; option2?: string | null; option3?: string | null; available: boolean }[],
): SizeOption[] | undefined {
  const index = (options ?? []).findIndex((option) => isSizeOptionName(option.name));
  if (index < 0 || index > 2) return undefined;
  const field = (["option1", "option2", "option3"] as const)[index];
  return normalizeSizes(
    variants.flatMap((variant) => (variant[field] ? [{ label: String(variant[field]), inStock: variant.available }] : [])),
  );
}

/** schema.org ProductGroup: each hasVariant may carry a `size` and its own offer availability. */
export function sizesFromStructuredVariants(variants: Record<string, unknown>[]): SizeOption[] | undefined {
  return normalizeSizes(
    variants.flatMap((variant) => {
      const size = variant.size;
      const label = typeof size === "string" ? size : typeof size === "object" && size ? String((size as { name?: unknown }).name ?? "") : "";
      if (!label) return [];
      const offers = Array.isArray(variant.offers) ? variant.offers : [variant.offers];
      const inStock = offers.some(
        (offer) => !!offer && typeof offer === "object" && !/OutOfStock|SoldOut|Discontinued/i.test(String((offer as { availability?: unknown }).availability ?? "")),
      );
      return [{ label, inStock }];
    }),
  );
}

/**
 * Akinon (the platform behind several Turkish chains) embeds the product's
 * variants in the page's Next.js data: {"attribute_key":"integration_beden",
 * "attribute_name":"Beden","options":[{"label":"42","in_stock":true,…}]}.
 */
export function readEmbeddedSizes(html: string): SizeOption[] | undefined {
  // The data sits inside JavaScript strings, with its quotes escaped.
  const text = html.includes('\\"attribute_key\\"') ? html.replace(/\\"/g, '"') : html;
  for (const match of text.matchAll(/\{"attribute_key":"([^"]*)","attribute_name":"([^"]*)","options":\[/g)) {
    if (!isSizeOptionName(match[1].replace(/^integration_/, "")) && !isSizeOptionName(match[2])) continue;
    const json = balancedObject(text, match.index);
    if (!json) continue;
    try {
      const block = JSON.parse(json) as { options?: { label?: unknown; in_stock?: unknown }[] };
      const sizes = normalizeSizes(
        (block.options ?? []).flatMap((option) =>
          typeof option.label === "string" ? [{ label: option.label, inStock: option.in_stock === true }] : [],
        ),
      );
      if (sizes) return sizes;
    } catch {
      // Not the shape we expect: try the next block.
    }
  }
  return undefined;
}

/** The JSON object starting at `start`, found by matching braces outside strings. */
function balancedObject(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  const limit = Math.min(text.length, start + 200_000);
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

/**
 * One spelling per size, for filtering across stores: "42,5" = "42.5",
 * "2XL" = "XXL", "m" = "M". Shown as the filter's label.
 */
export function sizeKey(label: string): string {
  return label
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/^(\d)X([LS])$/, (_, n: string, end: string) => `${"X".repeat(Number(n))}${end}`);
}

/** The sizes that can be bought, as filter keys; null when the store lists none. */
export function inStockSizeKeys(sizes: SizeOption[] | null | undefined): string[] | null {
  if (!sizes) return null;
  return [...new Set(sizes.filter((size) => size.inStock).map((size) => sizeKey(size.label)))];
}
