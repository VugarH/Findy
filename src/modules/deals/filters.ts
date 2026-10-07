import { isAudience } from "@/config/audience";
import { hasAudienceFilter, isCategorySlug, isSizedCategory } from "@/config/categories";
import { BRAND_SEPARATOR, brandKey } from "@/modules/catalog/brand";
import { isSubcategoryOf } from "@/config/subcategories";
import type { FilterSwitches } from "@/modules/settings/filter-switches";
import { sizeKey } from "@/modules/suppliers/sizes";
import { DEAL_SORTS, type DealFilters, type DealSort } from "./queries";

export const PAGE_SIZES = [20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = PAGE_SIZES[0];
/** The discount slider: 0 (any) up to MAX in steps. */
export const DISCOUNT_SLIDER = { max: 70, step: 5 } as const;
/** At most this many brands can be ticked at once (keeps URLs and queries small). */
export const MAX_BRANDS = 20;
/** At most this many sizes can be ticked at once. */
export const MAX_SIZES = 12;
/** Sizes in the URL: "sizes=42,42.5" (sizeKey form). */
export const SIZE_SEPARATOR = ",";

export type RawSearchParams = Record<string, string | string[] | undefined>;

export interface ParsedDealFilters extends DealFilters {
  sort: DealSort;
  page: number;
  size: number;
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * Turns URL search params into validated filters; anything unknown is ignored,
 * and so are filters an admin switched off (`switches`, from modules/settings).
 */
export function parseDealFilters(
  params: RawSearchParams,
  lockedCategory?: DealFilters["category"],
  switches?: FilterSwitches,
): ParsedDealFilters {
  return withoutSwitchedOff(readDealFilters(params, lockedCategory), switches, lockedCategory !== undefined);
}

function withoutSwitchedOff(filters: ParsedDealFilters, switches: FilterSwitches | undefined, locked: boolean): ParsedDealFilters {
  if (!switches) return filters;
  const off = (name: keyof FilterSwitches) => !switches[name];
  return {
    ...filters,
    // A category page's own category is not a filter: it always applies.
    category: off("category") && !locked ? undefined : filters.category,
    subcategory: off("subcategory") ? undefined : filters.subcategory,
    audience: off("audience") ? undefined : filters.audience,
    brands: off("brand") ? undefined : filters.brands,
    sizes: off("sizes") ? undefined : filters.sizes,
    minDiscount: off("discount") ? undefined : filters.minDiscount,
    priceMin: off("price") ? undefined : filters.priceMin,
    priceMax: off("price") ? undefined : filters.priceMax,
    scope: off("source") ? undefined : filters.scope,
    country: off("country") ? undefined : filters.country,
  };
}

function readDealFilters(params: RawSearchParams, lockedCategory?: DealFilters["category"]): ParsedDealFilters {
  const categoryParam = first(params.category);
  const category = lockedCategory ?? (categoryParam && isCategorySlug(categoryParam) ? categoryParam : undefined);
  const subcategory = first(params.sub);
  const audience = first(params.for);
  const brands = [
    ...new Set(
      (first(params.brand) ?? "")
        .split(BRAND_SEPARATOR)
        .map(brandKey)
        .filter((key) => key.length > 0 && key.length <= 60),
    ),
  ].slice(0, MAX_BRANDS);
  // Sizes only mean something inside a category sold by size.
  const sizes = isSizedCategory(category)
    ? [
        ...new Set(
          (first(params.sizes) ?? "")
            .split(SIZE_SEPARATOR)
            .map(sizeKey)
            .filter((key) => key.length > 0 && key.length <= 12),
        ),
      ].slice(0, MAX_SIZES)
    : [];
  const scope = first(params.scope);
  const sort = first(params.sort);
  const country = first(params.country)?.toUpperCase();
  const discount = Math.floor(Number(first(params.discount)));
  const priceMin = wholeAmount(first(params.min));
  const priceMax = wholeAmount(first(params.max));
  const sizeParam = Number(first(params.size));
  const size = (PAGE_SIZES as readonly number[]).includes(sizeParam) ? sizeParam : DEFAULT_PAGE_SIZE;
  const page = Math.max(1, Math.floor(Number(first(params.page))) || 1);

  return {
    category,
    // A subcategory only makes sense inside its own category.
    subcategory: category && subcategory && isSubcategoryOf(category, subcategory) ? subcategory : undefined,
    // Who a product is for is offered only where titles say it (see AUDIENCE_CATEGORIES).
    audience: hasAudienceFilter(category) && audience && isAudience(audience) ? audience : undefined,
    brands: brands.length > 0 ? brands : undefined,
    sizes: sizes.length > 0 ? sizes : undefined,
    scope: scope === "local" || scope === "global" ? scope : undefined,
    country: country && /^[A-Z]{2}$/.test(country) ? country : undefined,
    minDiscount: discount > 0 && discount <= 95 ? discount : undefined,
    priceMin,
    priceMax: priceMax !== undefined && priceMin !== undefined && priceMax < priceMin ? undefined : priceMax,
    sort: (DEAL_SORTS as readonly string[]).includes(sort ?? "") ? (sort as DealSort) : "best",
    page,
    size,
    limit: size,
    offset: (page - 1) * size,
  };
}

/** A whole, positive amount in the market currency, or undefined. */
function wholeAmount(value: string | undefined): number | undefined {
  const amount = Math.floor(Number(value));
  return amount > 0 && amount < 10_000_000 ? amount : undefined;
}

export type FilterKey = "category" | "sub" | "for" | "brand" | "sizes" | "scope" | "country" | "discount" | "min" | "max" | "sort" | "size" | "page";

/**
 * The current filters as URL params (defaults omitted), without the page.
 * `extra` carries params that belong to the page rather than the filters,
 * such as the search query.
 */
export function filterParams(
  current: ParsedDealFilters,
  includeCategory: boolean,
  extra: Record<string, string | undefined> = {},
): Record<string, string> {
  const entries: [string, string | number | undefined][] = [
    ...Object.entries(extra),
    ["category", includeCategory ? current.category : undefined],
    ["sub", current.subcategory],
    ["for", current.audience],
    ["brand", current.brands?.join(BRAND_SEPARATOR)],
    ["sizes", current.sizes?.join(SIZE_SEPARATOR)],
    ["scope", current.scope],
    ["country", current.country],
    ["discount", current.minDiscount],
    ["min", current.priceMin],
    ["max", current.priceMax],
    ["sort", current.sort === "best" ? undefined : current.sort],
    ["size", current.size === DEFAULT_PAGE_SIZE ? undefined : current.size],
  ];
  return Object.fromEntries(entries.filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]));
}

/** Query string for the current filters with some of them changed. Changing a filter returns to page 1. */
export function filterQuery(
  current: ParsedDealFilters,
  includeCategory: boolean,
  patch: Partial<Record<FilterKey, string | number | undefined>>,
  extra?: Record<string, string | undefined>,
): string {
  const merged: Record<string, string | number | undefined> = {
    ...filterParams(current, includeCategory, extra),
    ...patch,
  };
  // A different category invalidates the chosen subcategory, audience, brands and sizes.
  if ("category" in patch && !("sub" in patch)) delete merged.sub;
  if ("category" in patch && !("brand" in patch)) delete merged.brand;
  if ("category" in patch && !("sizes" in patch)) delete merged.sizes;
  if ("category" in patch && !("for" in patch)) delete merged.for;

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === "" || (key === "page" && Number(value) <= 1)) continue;
    query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}
