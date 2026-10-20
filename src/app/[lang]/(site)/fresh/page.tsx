import type { Metadata } from "next";
import { Suspense } from "react";
import { BadgeCheck, CalendarCheck, SearchX, ShieldCheck, TrendingDown } from "lucide-react";
import type { CategorySlug } from "@/config/categories";
import { LOCALE_TAGS } from "@/i18n/config";
import { fmt } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_COOKIE, PAGE_SIZES, parseDealFilters } from "@/modules/deals/filters";
import { countFreshDeals, listFreshDeals } from "@/modules/deals/fresh";
import { withPageSizeCookie } from "@/modules/deals/page-size";
import { orderedCategories } from "@/modules/settings/display-order";
import { getDisplayOrder } from "@/modules/settings/service";
import { FilterDrawerButton, FilterDrawerPanel, FilterDrawerProvider } from "@/components/deals/filter-drawer";
import { FilterGroup, FilterOption } from "@/components/deals/filter-panel";
import { Pagination } from "@/components/deals/pagination";
import { ProductGrid } from "@/components/deals/product-grid";
import { ParamSelect } from "@/components/deals/sort-select";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

type Props = PageProps<"/[lang]/fresh">;

export async function generateMetadata(): Promise<Metadata> {
  const { t, market } = await getI18n();
  return { title: t.fresh.title, description: fmt(t.fresh.intro, { days: market.deals.freshDrop.windowDays }) };
}

/** Verified discounts (modules/deals/fresh.ts): prices our own checks saw fall in the last days. */
export default async function VerifiedDiscountsPage({ searchParams }: Props) {
  const { t, href, money, market, locale } = await getI18n();
  // Only the category, page and page size apply here; the deal-list parser reads them the same way.
  const { category, page: askedPage, size } = parseDealFilters(await withPageSizeCookie(await searchParams));
  const [counts, order] = await Promise.all([countFreshDeals(market), getDisplayOrder()]);
  const total = category ? (counts.byCategory[category] ?? 0) : counts.total;
  const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(askedPage, pages);
  const cards = await listFreshDeals(market, { category, limit: size, offset: (page - 1) * size });

  const link = (patch: { category?: CategorySlug | null; page?: number }) => {
    const query = new URLSearchParams();
    const nextCategory = patch.category === null ? undefined : (patch.category ?? category);
    if (nextCategory) query.set("category", nextCategory);
    if (size !== DEFAULT_PAGE_SIZE) query.set("size", String(size));
    if (patch.page && patch.page > 1) query.set("page", String(patch.page));
    const text = query.toString();
    return href("/fresh") + (text ? `?${text}` : "");
  };
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
      jump={{
        action: href("/fresh"),
        params: Object.fromEntries([
          ...(category ? [["category", category]] : []),
          ...(size !== DEFAULT_PAGE_SIZE ? [["size", String(size)]] : []),
        ]),
      }}
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
            {counts.total > 0 ? fmt(t.fresh.countTitle, { count: counts.total.toLocaleString(LOCALE_TAGS[locale]) }) : t.fresh.title}
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
                <FilterOption href={link({ category: null })} active={!category} count={counts.total}>
                  {t.filters.all}
                </FilterOption>
                {/* Every category stays listed, so the panel keeps its height; those without any go last. */}
                {withDeals.map((c) => (
                  <FilterOption
                    key={c.slug}
                    href={link({ category: c.slug })}
                    active={category === c.slug}
                    count={counts.byCategory[c.slug] ?? 0}
                  >
                    {t.categories[c.slug].name}
                  </FilterOption>
                ))}
              </FilterGroup>
            </FilterDrawerPanel>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <FilterDrawerButton label={t.filters.filters} activeCount={category ? 1 : 0} />
                  <p className="text-sm font-semibold">{fmt(t.filters.results, { count: totalLabel })}</p>
                </div>
                <Suspense>
                  <ParamSelect
                    param="size"
                    cookie={PAGE_SIZE_COOKIE}
                    label={t.filters.perPage}
                    value={String(size)}
                    options={PAGE_SIZES.map((n) => ({ value: String(n), label: String(n) }))}
                  />
                </Suspense>
              </div>

              {pages > 1 && <div className="mt-4">{pagination}</div>}

              {cards.length > 0 ? (
                <div className="mt-5">
                  <ProductGrid cards={cards} density="compact" t={t} money={money} href={href} />
                </div>
              ) : (
                <div className="mt-6 grid place-items-center rounded-2xl border border-dashed border-line px-6 py-16 text-center">
                  <SearchX className="size-8 text-muted" aria-hidden />
                  <p className="mt-3 max-w-sm text-sm text-muted">{t.fresh.none}</p>
                  <ButtonLink href={href("/deals")} variant="secondary" size="sm" className="mt-4">
                    {t.top.seeAll}
                  </ButtonLink>
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
