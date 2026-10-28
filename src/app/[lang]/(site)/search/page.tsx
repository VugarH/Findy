import type { Metadata } from "next";
import { headers } from "next/headers";
import { after } from "next/server";
import { recordSearchEvent, visitorOf } from "@/modules/analytics/record";
import { getCurrentUser } from "@/modules/auth/session";
import { Search, SearchX } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { LOCALE_TAGS } from "@/i18n/config";
import { fmt } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { filterParams, filterQuery, PAGE_SIZE_COOKIE, PAGE_SIZES, parseDealFilters } from "@/modules/deals/filters";
import { withPageSizeCookie } from "@/modules/deals/page-size";
import { getFilterSwitches } from "@/modules/settings/service";
import {
  facetsOfCards,
  filterCards,
  parseSearchSort,
  recordSearch,
  searchCatalog,
  sortCards,
} from "@/modules/search/catalog-search";
import { MIN_QUERY_LENGTH, normalizeQuery } from "@/modules/search/normalize";
import { correctSearch } from "@/modules/search/terms";
import { getLiveSearchAdapters } from "@/modules/suppliers/registry";
import type { SupplierScope } from "@/modules/suppliers/types";
import { FilterDrawerButton, FilterDrawerPanel, FilterDrawerProvider } from "@/components/deals/filter-drawer";
import { ActiveFilters, countActiveFilters, FilterSidebar, type FilterLink } from "@/components/deals/filter-sidebar";
import { Pagination } from "@/components/deals/pagination";
import { ProductGrid } from "@/components/deals/product-grid";
import { ParamSelect } from "@/components/deals/sort-select";
import { LiveSearch } from "@/components/search/live-search";
import { CheckLink } from "@/components/search/check-link";
import { MarketFilter } from "@/components/search/market-filter";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { robots: { index: false } };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function SearchPage({ searchParams }: PageProps<"/[lang]/search">) {
  const params = await searchParams;
  const query = normalizeQuery(first(params.q));
  const { t, money, href, market, locale } = await getI18n();

  if (query.length < MIN_QUERY_LENGTH) {
    return (
      <Container className="grid place-items-center py-24 text-center">
        <Search className="size-8 text-muted" aria-hidden />
        <h1 className="mt-4 text-2xl font-bold">{t.search.emptyTitle}</h1>
        <p className="mt-2 max-w-md text-muted">{query ? t.search.tooShort : t.search.emptyHint}</p>
      </Container>
    );
  }

  // Search has its own sort options, so the deal-list sort is left at its default here.
  const sort = parseSearchSort(first(params.sort));
  const filters = parseDealFilters(await withPageSizeCookie({ ...params, sort: undefined }), undefined, await getFilterSwitches());

  // The local/abroad choice changes which offer represents a product, so it is applied
  // while building the cards; everything else filters the finished list.
  const asTyped = await searchCatalog(query, market, filters.scope);
  // Nothing found: perhaps a typo ("adidsa"). The corrected words are searched instead,
  // unless the visitor asked for exactly what they typed (?exact=1).
  const exact = first(params.exact) === "1";
  const corrected = asTyped.length === 0 && !exact ? await correctSearch(market, query) : null;
  const fixed = corrected ? await searchCatalog(corrected, market, filters.scope) : [];
  const shownQuery = fixed.length > 0 ? corrected! : query;
  const found = fixed.length > 0 ? fixed : asTyped;
  // Recorded as typed and with what the typed words found, so a typo never becomes a suggestion.
  await recordSearch(query, market, asTyped.length, false);
  // Analytics: the search itself, not every filter click on its results.
  if (Object.keys(params).every((key) => key === "q")) {
    const visitor = visitorOf(await headers(), await getCurrentUser());
    if (visitor) after(() => recordSearchEvent(visitor, query, asTyped.length));
  }

  // "Discounts only": results, counts and filters all come from the discounted products.
  const dealsOnly = first(params.deals) === "1";
  const pool = dealsOnly ? found.filter((card) => card.discountPct !== null) : found;
  const facets = facetsOfCards(pool, filters.category, filters.stores);
  const matching = sortCards(filterCards(pool, filters), sort, shownQuery);
  const total = matching.length;
  const pages = Math.max(1, Math.ceil(total / filters.size));
  const page = Math.min(filters.page, pages);
  const items = matching.slice((page - 1) * filters.size, page * filters.size);

  // Params that belong to the search itself and must survive every filter change.
  const extra = {
    q: shownQuery,
    sort: sort === "relevance" ? undefined : sort,
    deals: dealsOnly ? "1" : undefined,
    exact: exact ? "1" : undefined,
  };
  const link: FilterLink = (patch) => href("/search") + filterQuery(filters, true, patch, extra);
  const dealsOnlyHref = href("/search") + filterQuery(filters, true, {}, { ...extra, deals: dealsOnly ? undefined : "1" });
  const carried = filterParams(filters, true, extra);
  const resetHref = `${href("/search")}?${new URLSearchParams({ q: shownQuery })}`;
  const exactHref = `${href("/search")}?${new URLSearchParams({ q: query, exact: "1" })}`;
  const activeCount = countActiveFilters(filters, true, false);
  const liveSearchAvailable = getLiveSearchAdapters().length > 0;
  const totalLabel = total.toLocaleString(LOCALE_TAGS[locale]);

  const pagination = (
    <Pagination
      page={page}
      pages={pages}
      hrefFor={(target) => link({ page: target })}
      jump={{ action: href("/search"), params: carried }}
      labels={{
        prev: t.filters.prev,
        next: t.filters.next,
        goToPage: t.filters.goToPage,
        go: t.filters.go,
        pagination: t.filters.pagination,
      }}
    />
  );

  return (
    <Container className="max-w-[88rem] py-6">
      <h1 className="text-2xl font-extrabold tracking-tight">{fmt(t.search.resultsFor, { query: shownQuery })}</h1>
      {shownQuery !== query && (
        <p className="mt-1 text-sm">
          {fmt(t.search.showingFor, { query: shownQuery })}.{" "}
          <Link href={exactHref} className="text-brand underline-offset-2 hover:underline">
            {fmt(t.search.searchInstead, { query })}
          </Link>
        </p>
      )}
      <p className="mt-1 text-sm text-muted">
        {found.length > 0
          ? fmt(t.search.catalogCount, { count: found.length })
          : filters.scope
            ? t.search.noneInMarket
            : liveSearchAvailable
              ? `${t.search.noCatalog}. ${t.search.noCatalogHint}`
              : t.search.noCatalog}
      </p>

      <FilterDrawerProvider>
        <div className="mt-5 md:grid md:grid-cols-[12rem_minmax(0,1fr)] md:gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <FilterDrawerPanel
            title={t.filters.filters}
            closeLabel={t.filters.close}
            showResultsLabel={fmt(t.filters.showResults, { count: totalLabel })}
          >
            <FilterSidebar
              filters={filters}
              facets={facets}
              link={link}
              priceForm={{
                action: href("/search"),
                carried: Object.entries(carried).filter(([key]) => key !== "min" && key !== "max"),
              }}
              showCategory
              showSource={false}
            />
          </FilterDrawerPanel>

          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <FilterDrawerButton label={t.filters.filters} activeCount={activeCount} />
                <CheckLink href={dealsOnlyHref} checked={dealsOnly}>
                  {t.search.dealsOnly}
                </CheckLink>
                <MarketFilter
                  scope={filters.scope}
                  hrefFor={(scope: SupplierScope | undefined) => link({ scope })}
                  labels={{ title: t.search.market, local: t.search.localMarket, global: t.search.globalMarket }}
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <Suspense>
                  <ParamSelect
                    param="size"
                    cookie={PAGE_SIZE_COOKIE}
                    label={t.filters.perPage}
                    value={String(filters.size)}
                    options={PAGE_SIZES.map((size) => ({ value: String(size), label: String(size) }))}
                  />
                  <ParamSelect
                    param="sort"
                    label={t.search.sort}
                    value={sort}
                    options={[
                      { value: "relevance", label: t.search.sortRelevance },
                      { value: "price_asc", label: t.search.sortPriceAsc },
                      { value: "price_desc", label: t.search.sortPriceDesc },
                      { value: "discount", label: t.search.sortDiscount },
                      { value: "newest", label: t.search.sortNewest },
                      { value: "oldest", label: t.search.sortOldest },
                    ]}
                  />
                </Suspense>
              </div>
            </div>

            <ActiveFilters
              filters={filters}
              link={link}
              resetHref={resetHref}
              showCategory
              showSource={false}
              brands={facets.brands}
              stores={facets.stores}
              // Without the text, the same filters over all deals.
              query={{ text: shownQuery, remove: href("/deals") + filterQuery(filters, true, {}) }}
            />

            {pages > 1 && pagination}

            {items.length > 0 ? (
              <ProductGrid cards={items} density="compact" t={t} money={money} href={href} />
            ) : (
              found.length > 0 && (
                <div className="grid place-items-center rounded-2xl border border-dashed border-line px-6 py-16 text-center">
                  <SearchX className="size-8 text-muted" aria-hidden />
                  <p className="mt-3 font-semibold">{t.filters.empty}</p>
                  <ButtonLink href={resetHref} variant="secondary" size="sm" className="mt-4">
                    {t.filters.reset}
                  </ButtonLink>
                </div>
              )
            )}

            {pages > 1 && items.length > 0 && pagination}

            {/* Keyed by query so a new search starts with a clean live panel. */}
            {liveSearchAvailable ? (
              <LiveSearch key={query} query={query} autoStart={found.length === 0} />
            ) : (
              found.length === 0 && (
                <p className="rounded-2xl border border-dashed border-line px-6 py-12 text-center text-muted">
                  {filters.scope ? t.search.noneInMarket : t.search.liveNone}
                </p>
              )
            )}
          </div>
        </div>
      </FilterDrawerProvider>
    </Container>
  );
}
