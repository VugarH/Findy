import type { Metadata } from "next";
import { Search, SearchX } from "lucide-react";
import { Suspense } from "react";
import { LOCALE_TAGS } from "@/i18n/config";
import { fmt } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { filterParams, filterQuery, PAGE_SIZES, parseDealFilters } from "@/modules/deals/filters";
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
import { getLiveSearchAdapters } from "@/modules/suppliers/registry";
import type { SupplierScope } from "@/modules/suppliers/types";
import { FilterDrawerButton, FilterDrawerPanel, FilterDrawerProvider } from "@/components/deals/filter-drawer";
import { ActiveFilters, countActiveFilters, FilterSidebar, type FilterLink } from "@/components/deals/filter-sidebar";
import { Pagination } from "@/components/deals/pagination";
import { ProductGrid } from "@/components/deals/product-grid";
import { ParamSelect } from "@/components/deals/sort-select";
import { LiveSearch } from "@/components/search/live-search";
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
  const filters = parseDealFilters({ ...params, sort: undefined }, undefined, await getFilterSwitches());

  // The local/abroad choice changes which offer represents a product, so it is applied
  // while building the cards; everything else filters the finished list.
  const found = await searchCatalog(query, market, filters.scope);
  await recordSearch(query, market, found.length, false);

  const facets = facetsOfCards(found, filters.category);
  const matching = sortCards(filterCards(found, filters), sort);
  const total = matching.length;
  const pages = Math.max(1, Math.ceil(total / filters.size));
  const page = Math.min(filters.page, pages);
  const items = matching.slice((page - 1) * filters.size, page * filters.size);

  // Params that belong to the search itself and must survive every filter change.
  const extra = { q: query, sort: sort === "relevance" ? undefined : sort };
  const link: FilterLink = (patch) => href("/search") + filterQuery(filters, true, patch, extra);
  const carried = filterParams(filters, true, extra);
  const resetHref = `${href("/search")}?${new URLSearchParams({ q: query })}`;
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
      <h1 className="text-2xl font-extrabold tracking-tight">{fmt(t.search.resultsFor, { query })}</h1>
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
              <div className="flex items-center gap-3">
                <FilterDrawerButton label={t.filters.filters} activeCount={activeCount} />
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
              // Without the text, the same filters over all deals.
              query={{ text: query, remove: href("/deals") + filterQuery(filters, true, {}) }}
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
