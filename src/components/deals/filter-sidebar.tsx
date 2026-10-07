import Link from "next/link";
import { X } from "lucide-react";
import { Suspense } from "react";
import { AUDIENCES } from "@/config/audience";
import { CATEGORIES, hasAudienceFilter } from "@/config/categories";
import { CURRENCIES } from "@/config/currencies";
import { subcategoriesOf } from "@/config/subcategories";
import { LOCALE_TAGS } from "@/i18n/config";
import { fmt } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { BRAND_SEPARATOR } from "@/modules/catalog/brand";
import {
  DISCOUNT_SLIDER,
  MAX_BRANDS,
  MAX_SIZES,
  SIZE_SEPARATOR,
  type FilterKey,
  type ParsedDealFilters,
} from "@/modules/deals/filters";
import type { BrandFacet, DealFacets } from "@/modules/deals/queries";
import { getFilterSwitches } from "@/modules/settings/service";
import { BrandFilter } from "./brand-filter";
import { DiscountSlider } from "./discount-slider";
import { FilterGroup, FilterOption } from "./filter-panel";
import { SizeFilter } from "./size-filter";

export type FilterLink = (patch: Partial<Record<FilterKey, string | number | undefined>>) => string;

interface SidebarProps {
  filters: ParsedDealFilters;
  facets: DealFacets;
  /** Builds the URL for the current filters with some changed. */
  link: FilterLink;
  /** Where the price form submits, and the params it must carry along (without min/max). */
  priceForm: { action: string; carried: [string, string][] };
  showCategory: boolean;
  /** Off where the page offers its own local/abroad switch. */
  showSource: boolean;
}

/** The filter groups shared by the deal listings and the search results. */
export async function FilterSidebar({ filters, facets, link, priceForm, showCategory, showSource }: SidebarProps) {
  const { t, market, locale } = await getI18n();
  // Filters an admin switched off are not offered (their URL params are already ignored).
  const on = await getFilterSwitches();
  const countryName = new Intl.DisplayNames([LOCALE_TAGS[locale]], { type: "region" });
  const subcategories = filters.category
    ? subcategoriesOf(filters.category).filter((slug) => facets.subcategories[slug] || slug === filters.subcategory)
    : [];
  // Only in clothing and shoes, where titles say who a product is for (see AUDIENCE_CATEGORIES).
  const audiences = hasAudienceFilter(filters.category)
    ? AUDIENCES.filter((audience) => facets.audiences[audience] || audience === filters.audience)
    : [];
  const selectedBrands = filters.brands ?? [];
  const toggleBrand = (key: string) => {
    const next = selectedBrands.includes(key)
      ? selectedBrands.filter((brand) => brand !== key)
      : [...selectedBrands, key].slice(-MAX_BRANDS);
    return link({ brand: next.length ? next.join(BRAND_SEPARATOR) : undefined });
  };
  // A ticked brand with no deals left under the other filters still needs its box, to untick it.
  const brandOptions = [
    ...facets.brands,
    ...selectedBrands
      .filter((key) => !facets.brands.some((facet) => facet.key === key))
      .map((key) => ({ key, name: key, total: 0 })),
  ].map((facet) => ({ ...facet, href: toggleBrand(facet.key), active: selectedBrands.includes(facet.key) }));
  const selectedSizes = filters.sizes ?? [];
  const toggleSize = (key: string) => {
    const next = selectedSizes.includes(key)
      ? selectedSizes.filter((size) => size !== key)
      : [...selectedSizes, key].slice(-MAX_SIZES);
    return link({ sizes: next.length ? next.join(SIZE_SEPARATOR) : undefined });
  };
  // A ticked size with no deals left under the other filters still needs its button, to untick it.
  const sizeOptions = [
    ...facets.sizes,
    ...selectedSizes.filter((key) => !facets.sizes.some((size) => size.key === key)).map((key) => ({ key, total: 0 })),
  ].map((size) => ({ ...size, href: toggleSize(size.key), active: selectedSizes.includes(size.key) }));
  const priceInput =
    "h-9 w-full min-w-0 rounded-lg border border-line bg-surface px-2.5 text-sm tabular-nums";

  return (
    <>
      {showCategory && on.category && (
        <FilterGroup title={t.filters.category}>
          <FilterOption href={link({ category: undefined })} active={!filters.category}>
            {t.filters.all}
          </FilterOption>
          {CATEGORIES.map((category) => (
            <FilterOption
              key={category.slug}
              href={link({ category: category.slug })}
              active={filters.category === category.slug}
              count={facets.categories[category.slug] ?? 0}
            >
              {t.categories[category.slug].name}
            </FilterOption>
          ))}
        </FilterGroup>
      )}

      {on.audience && audiences.length > 1 && (
        <FilterGroup title={t.filters.audience}>
          <FilterOption href={link({ for: undefined })} active={!filters.audience}>
            {t.filters.anyAudience}
          </FilterOption>
          {audiences.map((audience) => (
            <FilterOption
              key={audience}
              href={link({ for: audience })}
              active={filters.audience === audience}
              count={facets.audiences[audience] ?? 0}
            >
              {t.audiences[audience]}
            </FilterOption>
          ))}
        </FilterGroup>
      )}

      {on.brand && brandOptions.length > 1 && (
        <FilterGroup title={t.filters.brand}>
          <BrandFilter
            options={brandOptions}
            labels={{
              showAll: fmt(t.filters.showAllBrands, { count: brandOptions.length }),
              showFewer: t.filters.showFewerBrands,
              search: t.filters.searchBrands,
              none: t.filters.noBrands,
            }}
          />
        </FilterGroup>
      )}

      {on.sizes && sizeOptions.length > 0 && (
        <FilterGroup title={t.filters.sizes}>
          <SizeFilter options={sizeOptions} hint={t.filters.sizeHint} />
        </FilterGroup>
      )}

      {on.subcategory && subcategories.length > 1 && (
        <FilterGroup title={t.filters.subcategory}>
          <FilterOption href={link({ sub: undefined })} active={!filters.subcategory}>
            {t.filters.all}
          </FilterOption>
          {subcategories.map((slug) => (
            <FilterOption
              key={slug}
              href={link({ sub: slug })}
              active={filters.subcategory === slug}
              count={facets.subcategories[slug] ?? 0}
            >
              {t.subcategories[slug]}
            </FilterOption>
          ))}
        </FilterGroup>
      )}

      {on.discount && (
        <FilterGroup title={t.filters.minDiscount}>
          <div className="px-2">
            <Suspense>
              <DiscountSlider
                value={filters.minDiscount ?? 0}
                max={DISCOUNT_SLIDER.max}
                step={DISCOUNT_SLIDER.step}
                anyLabel={t.filters.anyDiscount}
                atLeastLabel={t.filters.discountAtLeast}
                ariaLabel={t.filters.minDiscount}
              />
            </Suspense>
          </div>
        </FilterGroup>
      )}

      {on.price && (
        <FilterGroup title={fmt(t.filters.price, { currency: CURRENCIES[market.currency].symbol })}>
          <form action={priceForm.action} className="space-y-2 px-2">
            {priceForm.carried.map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <div className="flex items-center gap-2">
              <input
                type="number"
                name="min"
                min={0}
                defaultValue={filters.priceMin}
                placeholder={t.filters.priceMin}
                aria-label={t.filters.priceMin}
                className={priceInput}
              />
              <span className="text-muted">–</span>
              <input
                type="number"
                name="max"
                min={0}
                defaultValue={filters.priceMax}
                placeholder={t.filters.priceMax}
                aria-label={t.filters.priceMax}
                className={priceInput}
              />
            </div>
            <button
              type="submit"
              className="h-9 w-full rounded-lg border border-line bg-surface text-sm font-semibold hover:bg-surface-2"
            >
              {t.filters.apply}
            </button>
          </form>
        </FilterGroup>
      )}

      {showSource && on.source && (
        <FilterGroup title={t.filters.source}>
          <FilterOption href={link({ scope: undefined })} active={!filters.scope}>
            {t.filters.anySource}
          </FilterOption>
          <FilterOption href={link({ scope: "local" })} active={filters.scope === "local"}>
            {t.deal.local}
          </FilterOption>
          <FilterOption href={link({ scope: "global" })} active={filters.scope === "global"}>
            {t.deal.global}
          </FilterOption>
        </FilterGroup>
      )}

      {on.country && facets.countries.length > 1 && (
        <FilterGroup title={t.filters.country}>
          <FilterOption href={link({ country: undefined })} active={!filters.country}>
            {t.filters.anyCountry}
          </FilterOption>
          {facets.countries.map(({ country, total }) => (
            <FilterOption key={country} href={link({ country })} active={filters.country === country} count={total}>
              {countryName.of(country) ?? country}
            </FilterOption>
          ))}
        </FilterGroup>
      )}
    </>
  );
}

interface ActiveProps {
  filters: ParsedDealFilters;
  link: FilterLink;
  /** URL with every filter removed. */
  resetHref: string;
  showCategory: boolean;
  showSource: boolean;
  /** Display names for ticked brands (the URL holds lower-case keys). */
  brands?: BrandFacet[];
  /** The search text as a removable chip, on the search page. */
  query?: { text: string; remove: string };
}

/** How many filters are applied (for the phone "Filters" button badge). */
export function countActiveFilters(filters: ParsedDealFilters, showCategory: boolean, showSource: boolean): number {
  return [
    showCategory && filters.category,
    filters.subcategory,
    filters.audience,
    ...(filters.brands ?? []),
    ...(filters.sizes ?? []),
    showSource && filters.scope,
    filters.country,
    filters.minDiscount,
    filters.priceMin,
    filters.priceMax,
  ].filter(Boolean).length;
}

/** The applied filters as chips, each removable with one click. */
export async function ActiveFilters({ filters, link, resetHref, showCategory, showSource, brands = [], query }: ActiveProps) {
  const { t, money, locale } = await getI18n();
  const brandNames = new Map(brands.map((brand) => [brand.key, brand.name]));
  const countryName = new Intl.DisplayNames([LOCALE_TAGS[locale]], { type: "region" });

  const active = [
    query ? { label: `“${query.text}”`, remove: query.remove } : null,
    showCategory && filters.category
      ? { label: t.categories[filters.category].name, remove: link({ category: undefined }) }
      : null,
    filters.subcategory ? { label: t.subcategories[filters.subcategory], remove: link({ sub: undefined }) } : null,
    filters.audience ? { label: t.audiences[filters.audience], remove: link({ for: undefined }) } : null,
    ...(filters.brands ?? []).map((key) => {
      const rest = (filters.brands ?? []).filter((brand) => brand !== key);
      return {
        label: brandNames.get(key) ?? key,
        remove: link({ brand: rest.length ? rest.join(BRAND_SEPARATOR) : undefined }),
      };
    }),
    ...(filters.sizes ?? []).map((key) => {
      const rest = (filters.sizes ?? []).filter((size) => size !== key);
      return {
        label: fmt(t.filters.sizeChip, { size: key }),
        remove: link({ sizes: rest.length ? rest.join(SIZE_SEPARATOR) : undefined }),
      };
    }),
    showSource && filters.scope
      ? { label: filters.scope === "local" ? t.deal.local : t.deal.global, remove: link({ scope: undefined }) }
      : null,
    filters.country
      ? { label: countryName.of(filters.country) ?? filters.country, remove: link({ country: undefined }) }
      : null,
    filters.minDiscount
      ? { label: fmt(t.filters.discountAtLeast, { pct: filters.minDiscount }), remove: link({ discount: undefined }) }
      : null,
    filters.priceMin
      ? { label: fmt(t.filters.priceFrom, { amount: money(filters.priceMin * 100) }), remove: link({ min: undefined }) }
      : null,
    filters.priceMax
      ? { label: fmt(t.filters.priceTo, { amount: money(filters.priceMax * 100) }), remove: link({ max: undefined }) }
      : null,
  ].filter((entry) => entry !== null);

  if (active.length === 0) return null;

  return (
    <ul className="mt-3 flex flex-wrap items-center gap-2">
      {active.map((entry) => (
        <li key={entry.label}>
          <Link
            href={entry.remove}
            scroll={false}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-ink pl-3 pr-2 text-sm font-medium text-bg"
          >
            {entry.label}
            <X className="size-3.5" aria-hidden />
          </Link>
        </li>
      ))}
      {/* "Clear filters" keeps the search text, so it is only useful with a filter besides it. */}
      {active.length > (query ? 1 : 0) && (
        <li>
          <Link href={resetHref} className="px-2 text-sm font-semibold text-muted hover:text-ink">
            {t.filters.reset}
          </Link>
        </li>
      )}
    </ul>
  );
}
