import type { Metadata } from "next";
import { Suspense } from "react";
import { BadgeCheck, CalendarCheck, SearchX, ShieldCheck, TrendingDown } from "lucide-react";
import { isCategorySlug, type CategorySlug } from "@/config/categories";
import { LOCALE_TAGS } from "@/i18n/config";
import { fmt } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { DEFAULT_PAGE_SIZE, MAX_STORES, PAGE_SIZE_COOKIE, PAGE_SIZES, parseDealFilters, STORE_SEPARATOR } from "@/modules/deals/filters";
import { countFreshDeals, FRESH_SORTS, listFreshDeals, type FreshSort } from "@/modules/deals/fresh";
import { withPageSizeCookie } from "@/modules/deals/page-size";
import { orderedCategories } from "@/modules/settings/display-order";
import { getDisplayOrder } from "@/modules/settings/service";
import { MIN_QUERY_LENGTH, normalizeQuery } from "@/modules/search/normalize";
import { BrandFilter } from "@/components/deals/brand-filter";
import { FilterDrawerButton, FilterDrawerPanel, FilterDrawerProvider } from "@/components/deals/filter-drawer";
import { FilterGroup, FilterOption, FilterToggle } from "@/components/deals/filter-panel";
import { Pagination } from "@/components/deals/pagination";
import { ProductGrid } from "@/components/deals/product-grid";
import { ParamSelect } from "@/components/deals/sort-select";
import { SearchBar } from "@/components/search/search-bar";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

type Props = PageProps<"/[lang]/fresh">;

/** Categories in the URL: "category=shoes,fashion". */
const CATEGORY_SEPARATOR = ",";

export async function generateMetadata(): Promise<Metadata> {
  const { t, market } = await getI18n();
  return { title: t.fresh.title, description: fmt(t.fresh.intro, { days: market.deals.freshDrop.windowDays }) };
}

/** Verified discounts (modules/deals/fresh.ts): prices our own checks saw fall in the last days. */
export default async function VerifiedDiscountsPage({ searchParams }: Props) {
  const { t, href, money, market, locale } = await getI18n();
  // Page and page size read like the deal lists; categories (several), search and sort are this page's own.
  const params = await searchParams;
  const { page: askedPage, size } = parseDealFilters(await withPageSizeCookie(params));
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const selected = [...new Set((one(params.category) ?? "").split(CATEGORY_SEPARATOR).filter(isCategorySlug))];
  const selectedStores = [...new Set((one(params.store) ?? "").split(STORE_SEPARATOR).filter(Boolean))].slice(0, MAX_STORES);
  const typed = normalizeQuery(one(params.q));
  const query = typed.length >= MIN_QUERY_LENGTH ? typed : undefined;
  const sortParam = one(params.sort);
  const sort: FreshSort = (FRESH_SORTS as readonly string[]).includes(sortParam ?? "") ? (sortParam as FreshSort) : "drop";
  // The heading counts every verified discount; the panel and results follow the search and filters.
  const [counts, all, order] = await Promise.all([
    countFreshDeals(market, { query, categories: selected, stores: selectedStores }),
    query || selected.length || selectedStores.length ? countFreshDeals(market) : null,
    getDisplayOrder(),
  ]);
  const overall = (all ?? counts).total;
  const total = counts.total;
  const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(askedPage, pages);
  const cards = await listFreshDeals(market, { categories: selected, stores: selectedStores, query, sort, limit: size, offset: (page - 1) * size });

  // The current choices as URL params (defaults left out), with some changed.
  const paramsFor = (patch: { categories?: CategorySlug[]; stores?: string[]; page?: number } = {}) => {
    const nextCategories = patch.categories ?? selected;
    const nextStores = patch.stores ?? selectedStores;
    return Object.fromEntries(
      [
        ["q", query],
        ["category", nextCategories.length ? nextCategories.join(CATEGORY_SEPARATOR) : undefined],
        ["store", nextStores.length ? nextStores.join(STORE_SEPARATOR) : undefined],
        ["sort", sort === "drop" ? undefined : sort],
        ["size", size === DEFAULT_PAGE_SIZE ? undefined : String(size)],
        ["page", patch.page && patch.page > 1 ? String(patch.page) : undefined],
      ].filter((entry): entry is [string, string] => entry[1] !== undefined),
    );
  };
  const link = (patch: { categories?: CategorySlug[]; stores?: string[]; page?: number } = {}) => {
    const text = new URLSearchParams(paramsFor(patch)).toString();
    return href("/fresh") + (text ? `?${text}` : "");
  };
  const toggle = (slug: CategorySlug) =>
    link({ categories: selected.includes(slug) ? selected.filter((s) => s !== slug) : [...selected, slug] });
  const toggleStore = (key: string) =>
    link({ stores: selectedStores.includes(key) ? selectedStores.filter((s) => s !== key) : [...selectedStores, key].slice(-MAX_STORES) });
  // A ticked store with nothing left in the chosen categories still needs its box, to untick it.
  const storeOptions = [
    ...counts.stores,
    ...selectedStores.filter((key) => !counts.stores.some((store) => store.key === key)).map((key) => ({ key, name: key, total: 0 })),
  ].map((store) => ({ ...store, href: toggleStore(store.key), active: selectedStores.includes(store.key) }));
  const categories = orderedCategories(order);
  const withDeals = [
    ...categories.filter((c) => counts.byCategory[c.slug]),
    ...categories.filter((c) => !counts.byCategory[c.slug]),
  ];
  const { windowDays, minDropPct } = market.deals.freshDrop;
  const totalLabel = total.toLocaleString(LOCALE_TAGS[locale]);
  const trust = [
    { icon: ShieldCheck, title: t.fresh.trust1Title, text: fmt(t.fresh.trust1Text, { pct: minDropPct, days: windowDays }) },
    { icon: TrendingDown, title: t.fresh.trust2Title, text: t.fresh.trust2Text },
    { icon: CalendarCheck, title: t.fresh.trust3Title, text: fmt(t.fresh.trust3Text, { days: windowDays }) },
  ];

  const pagination = (
    <Pagination
      page={page}
      pages={pages}
      hrefFor={(n) => link({ page: n })}
      jump={{ action: href("/fresh"), params: paramsFor() }}
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
    <>
      <section className="hero-glow border-b border-line">
        <Container className="max-w-[88rem] py-8">
          <p className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-strong">
            <BadgeCheck className="size-3.5" aria-hidden />
            {t.fresh.badge}
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">
            {overall > 0 ? fmt(t.fresh.countTitle, { count: overall.toLocaleString(LOCALE_TAGS[locale]) }) : t.fresh.title}
          </h1>
          <p className="mt-2 max-w-3xl text-pretty text-muted">{fmt(t.fresh.intro, { days: windowDays })}</p>
          <ul className="mt-5 grid gap-3 md:grid-cols-3">
            {trust.map((item) => (
              <li key={item.title} className="flex gap-3 rounded-2xl border border-line bg-surface/70 p-4 backdrop-blur-sm">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong">
                  <item.icon className="size-[18px]" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-bold">{item.title}</span>
                  <span className="mt-0.5 block text-sm text-muted">{item.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <Container className="max-w-[88rem] py-6">
        <FilterDrawerProvider>
          <div className="md:grid md:grid-cols-[12rem_minmax(0,1fr)] md:gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
            <FilterDrawerPanel
              title={t.filters.filters}
              closeLabel={t.filters.close}
              showResultsLabel={fmt(t.filters.showResults, { count: totalLabel })}
            >
              <FilterGroup title={t.filters.category}>
                <FilterOption
                  href={link({ categories: [] })}
                  active={selected.length === 0}
                  count={Object.values(counts.byCategory).reduce((sum, n) => sum + n, 0)}
                >
                  {t.filters.all}
                </FilterOption>
                {/* Tick several; every category stays listed, those without any last. */}
                {withDeals.map((c) => (
                  <FilterToggle
                    key={c.slug}
                    href={toggle(c.slug)}
                    active={selected.includes(c.slug)}
                    count={counts.byCategory[c.slug] ?? 0}
                  >
                    {t.categories[c.slug].name}
                  </FilterToggle>
                ))}
              </FilterGroup>
              {storeOptions.length > 1 && (
                <FilterGroup title={t.filters.store}>
                  <BrandFilter
                    options={storeOptions}
                    labels={{
                      showAll: fmt(t.filters.showAllStores, { count: storeOptions.length }),
                      showFewer: t.filters.showFewerBrands,
                      search: t.filters.searchStores,
                      none: t.filters.noStores,
                    }}
                  />
                </FilterGroup>
              )}
            </FilterDrawerPanel>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <FilterDrawerButton label={t.filters.filters} activeCount={selected.length + selectedStores.length} />
                  <p className="text-sm font-semibold">{fmt(t.filters.results, { count: totalLabel })}</p>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <Suspense>
                    <ParamSelect
                      param="size"
                      cookie={PAGE_SIZE_COOKIE}
                      label={t.filters.perPage}
                      value={String(size)}
                      options={PAGE_SIZES.map((n) => ({ value: String(n), label: String(n) }))}
                    />
                    <ParamSelect
                      param="sort"
                      label={t.filters.sort}
                      value={sort}
                      options={[
                        { value: "drop", label: t.fresh.sortDrop },
                        { value: "store_discount", label: t.fresh.sortStoreDiscount },
                        { value: "price_asc", label: t.filters.sortPriceAsc },
                        { value: "price_desc", label: t.filters.sortPriceDesc },
                        { value: "newest", label: t.fresh.sortNewest },
                      ]}
                    />
                  </Suspense>
                </div>
              </div>

              <SearchBar
                action={href("/fresh")}
                placeholder={t.fresh.searchPlaceholder}
                buttonLabel={t.search.button}
                defaultValue={query}
                hidden={Object.fromEntries(Object.entries(paramsFor()).filter(([key]) => key === "category" || key === "store" || key === "sort"))}
                optional
                className="mt-4"
              />

              {pages > 1 && <div className="mt-4">{pagination}</div>}

              {cards.length > 0 ? (
                <div className="mt-5">
                  <ProductGrid cards={cards} density="compact" t={t} money={money} href={href} />
                </div>
              ) : (
                <div className="mt-6 grid place-items-center rounded-2xl border border-dashed border-line px-6 py-16 text-center">
                  <SearchX className="size-8 text-muted" aria-hidden />
                  <p className="mt-3 max-w-sm text-sm text-muted">
                    {query ? fmt(t.fresh.noMatch, { query }) : t.fresh.none}
                  </p>
                  {query ? (
                    <ButtonLink href={`${href("/search")}?q=${encodeURIComponent(query)}`} variant="secondary" size="sm" className="mt-4">
                      {t.fresh.searchAll}
                    </ButtonLink>
                  ) : (
                    <ButtonLink href={href("/deals")} variant="secondary" size="sm" className="mt-4">
                      {t.top.seeAll}
                    </ButtonLink>
                  )}
                </div>
              )}

              {pages > 1 && cards.length > 0 && <div className="mt-8">{pagination}</div>}
            </div>
          </div>
        </FilterDrawerProvider>
      </Container>
    </>
  );
}
