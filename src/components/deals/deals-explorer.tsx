import { SearchX } from "lucide-react";
import { Suspense, type ReactNode } from "react";
import type { CategorySlug } from "@/config/categories";
import { LOCALE_TAGS } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/format";
import { filterParams, filterQuery, PAGE_SIZES, parseDealFilters, type RawSearchParams } from "@/modules/deals/filters";
import { getDealFacets, listDeals } from "@/modules/deals/queries";
import { getFilterSwitches } from "@/modules/settings/service";
import { FollowButton } from "@/components/follows/follow-button";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { FilterDrawerButton, FilterDrawerPanel, FilterDrawerProvider } from "./filter-drawer";
import { ActiveFilters, countActiveFilters, FilterSidebar, type FilterLink } from "./filter-sidebar";
import { Pagination } from "./pagination";
import { ProductGrid } from "./product-grid";
import { ParamSelect } from "./sort-select";

interface Props {
  title: string;
  subtitle: string;
  searchParams: RawSearchParams;
  /** Base path without locale, e.g. "/deals" or "/category/toys". */
  basePath: string;
  /** When set, the page is scoped to one category and the category filter is hidden. */
  lockedCategory?: CategorySlug;
  /** Shown beside the title, e.g. "Follow Shoes". */
  action?: ReactNode;
}

/** The filterable deal listing behind /deals and every category page. */
export async function DealsExplorer({ title, subtitle, searchParams, basePath, lockedCategory, action }: Props) {
  const { t, money, href, market, locale } = await getI18n();
  const switches = await getFilterSwitches();
  const filters = parseDealFilters(searchParams, lockedCategory, switches);
  const showCategory = !lockedCategory && switches.category;

  const [{ items, total }, facets] = await Promise.all([
    listDeals(market, filters),
    getDealFacets(market, filters.category),
  ]);

  const pages = Math.max(1, Math.ceil(total / filters.size));
  const link: FilterLink = (patch) => href(basePath) + filterQuery(filters, showCategory, patch);
  const params = filterParams(filters, showCategory);
  const activeCount = countActiveFilters(filters, showCategory, true);

  const from = total === 0 ? 0 : filters.offset! + 1;
  const to = Math.min(total, filters.offset! + items.length);
  const totalLabel = total.toLocaleString(LOCALE_TAGS[locale]);

  const pagination = (
    <Pagination
      page={Math.min(filters.page, pages)}
      pages={pages}
      hrefFor={(page) => link({ page })}
      jump={{ action: href(basePath), params }}
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
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {action}
          {filters.brands?.length === 1 && (
            <FollowButton
              kind="brand"
              value={filters.brands[0]}
              name={facets.brands.find((brand) => brand.key === filters.brands![0])?.name ?? filters.brands[0]}
            />
          )}
        </div>
      </div>

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
                action: href(basePath),
                carried: Object.entries(params).filter(([key]) => key !== "min" && key !== "max"),
              }}
              showCategory={showCategory}
              showSource
            />
          </FilterDrawerPanel>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <FilterDrawerButton label={t.filters.filters} activeCount={activeCount} />
                <p className="text-sm">
                  <span className="font-semibold">{fmt(t.filters.results, { count: totalLabel })}</span>
                  {total > 0 && (
                    <span className="hidden text-muted sm:inline"> · {fmt(t.filters.showing, { from, to, total })}</span>
                  )}
                </p>
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
                    label={t.filters.sort}
                    value={filters.sort}
                    options={[
                      { value: "best", label: t.filters.sortBest },
                      { value: "discount", label: t.filters.sortDiscount },
                      { value: "savings", label: t.filters.sortSavings },
                      { value: "price_asc", label: t.filters.sortPriceAsc },
                      { value: "price_desc", label: t.filters.sortPriceDesc },
                      { value: "newest", label: t.filters.sortNewest },
                      { value: "oldest", label: t.filters.sortOldest },
                    ]}
                  />
                </Suspense>
              </div>
            </div>

            <ActiveFilters
              filters={filters}
              link={link}
              resetHref={href(basePath)}
              showCategory={showCategory}
              showSource
              brands={facets.brands}
            />

            {pages > 1 && <div className="mt-4">{pagination}</div>}

            {items.length > 0 ? (
              <div className="mt-5">
                <ProductGrid cards={items} density="compact" t={t} money={money} href={href} />
              </div>
            ) : (
              <div className="mt-6 grid place-items-center rounded-2xl border border-dashed border-line px-6 py-16 text-center">
                <SearchX className="size-8 text-muted" aria-hidden />
                <p className="mt-3 font-semibold">{t.filters.empty}</p>
                <p className="mt-1 max-w-sm text-sm text-muted">{t.filters.emptyHint}</p>
                {activeCount > 0 && (
                  <ButtonLink href={href(basePath)} variant="secondary" size="sm" className="mt-4">
                    {t.filters.reset}
                  </ButtonLink>
                )}
              </div>
            )}

            {pages > 1 && items.length > 0 && <div className="mt-8">{pagination}</div>}
          </div>
        </div>
      </FilterDrawerProvider>
    </Container>
  );
}
