import type { Metadata } from "next";
import Link from "next/link";
import { pageAlternates } from "@/i18n/alternates";
import { ArrowRight, BadgeCheck, Calculator, Flame, Handshake, RefreshCw, ShieldCheck } from "lucide-react";
import { LOCALE_TAGS } from "@/i18n/config";
import { fmt } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { getPopularCoverage } from "@/modules/catalog/popular";
import { countFreshDeals, listFreshDeals } from "@/modules/deals/fresh";
import { getDealStats, listDeals } from "@/modules/deals/queries";
import { DealTicker } from "@/components/deals/deal-ticker";
import { FeaturedDeal } from "@/components/deals/featured-deal";
import { HeroDealCard } from "@/components/deals/hero-deal-card";
import { ProductGrid } from "@/components/deals/product-grid";
import { OrderSteps } from "@/components/orders/steps";
import { ProductImage } from "@/components/product/product-image";
import { SearchBar } from "@/components/search/search-bar";
import { ButtonLink } from "@/components/ui/button";
import { CATEGORY_TEXT, CategoryIcon } from "@/components/ui/category-icon";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { orderedCategories } from "@/modules/settings/display-order";
import { getDisplayOrder, getFeatureSwitches } from "@/modules/settings/service";
import { HeroPick } from "@/components/recommendations/hero-pick";
import { RecommendedRow } from "@/components/recommendations/recommended-row";

/** Fresh real deals shown on the home page; the rest are on /fresh. */
const FRESH_ON_HOME = 8;

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  return { alternates: pageAlternates(locale) };
}

export default async function HomePage() {
  const { t, money, href, market, locale } = await getI18n();

  const [stats, top, lowest, popular, order, fresh, freshCount, features] = await Promise.all([
    getDealStats(market),
    listDeals(market, { sort: "best", limit: 9 }),
    listDeals(market, { badge: "lowest_price", sort: "discount", limit: 4 }),
    getPopularCoverage(market),
    getDisplayOrder(),
    listFreshDeals(market, { limit: FRESH_ON_HOME }),
    countFreshDeals(market),
    getFeatureSwitches(),
  ]);
  // Families sold by several stores come first: those are the ones worth comparing.
  const popularTiles = [...popular].sort((a, b) => b.stores.length - a.stores.length).slice(0, 12);
  const [featured, ...topDeals] = top.items;
  const tickerCards = [...top.items, ...lowest.items].filter((card, i, all) => all.findIndex((c) => c.productId === card.productId) === i);

  const dealCount = stats.dealCount.toLocaleString(LOCALE_TAGS[locale]);
  const statTiles: { value: string; label: string; href?: string }[] = [
    { value: dealCount, label: t.home.statDeals, href: href("/deals") },
    { value: stats.storeCount.toLocaleString(LOCALE_TAGS[locale]), label: t.home.statStores },
    { value: stats.productCount.toLocaleString(LOCALE_TAGS[locale]), label: t.home.statProducts },
    { value: `−${stats.maxDiscountPct}%`, label: t.home.statMaxDiscount },
  ];
  const steps = [
    { icon: RefreshCw, title: t.home.how1Title, text: t.home.how1Text },
    { icon: Calculator, title: t.home.how2Title, text: t.home.how2Text },
    { icon: ShieldCheck, title: t.home.how3Title, text: t.home.how3Text },
  ];
  const updatedAt = stats.lastRunAt
    ? new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
        day: "numeric",
        month: "long",
        timeZone: "Asia/Baku",
      }).format(stats.lastRunAt)
    : null;

  return (
    <>
      <section className="hero-glow border-b border-line">
        <div className="hero-dots" aria-hidden />
        {featured && <HeroDealCard card={featured} label={t.home.dealOfDay} money={money} href={href} />}
        <HeroPick fallback={tickerCards} recommendations={features.recommendations} excludeId={featured?.productId} />
        <Container className="py-6 md:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <p className="rise inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-strong">
              <span className="live-dot size-1.5 rounded-full bg-brand" aria-hidden />
              {t.home.heroBadge}
            </p>
            <h1 className="rise mt-3 [--i:1] text-balance text-3xl font-extrabold tracking-tight md:mt-5 md:text-5xl">{t.home.heroTitle}</h1>
            <p className="rise mx-auto mt-2 [--i:2] max-w-2xl text-pretty text-sm text-muted md:mt-4 md:text-lg">{t.home.heroSubtitle}</p>
            <SearchBar
              action={href("/search")}
              placeholder={t.search.placeholder}
              buttonLabel={t.search.button}
              suggest={{ suggestions: t.search.suggestions, brand: t.search.suggestionBrand }}
              size="lg"
              // Phones have the header's search right above it.
              className="rise mx-auto mt-8 max-w-2xl [--i:3] max-md:hidden"
            />
            {/* The way into the deal list, right where people start: no hunting for the small menu link. */}
            {stats.dealCount > 0 && (
              <div className="rise mt-4 flex flex-wrap items-center justify-center gap-2 [--i:4] md:mt-6 md:gap-3">
                <ButtonLink href={href("/deals")} size="lg" className="shadow-card max-md:w-full">
                  {fmt(t.home.browseAll, { count: dealCount })}
                  <ArrowRight className="size-5" aria-hidden />
                </ButtonLink>
                <ButtonLink href={href("/top")} size="lg" variant="secondary" className="max-md:hidden">
                  <Flame className="size-5 text-deal" aria-hidden />
                  {t.top.nav}
                </ButtonLink>
              </div>
            )}
          </div>

          <dl className="rise mx-auto mt-5 grid [--i:5] max-w-4xl grid-cols-4 gap-1.5 md:mt-12 md:gap-3">
            {statTiles.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-line bg-surface/70 px-1 py-2.5 text-center backdrop-blur-sm md:rounded-2xl md:px-4 md:py-5">
                <dd className="text-base font-extrabold tracking-tight md:text-3xl">
                  {stat.href ? (
                    <Link href={stat.href} className="hover:text-brand-strong hover:underline">
                      {stat.value}
                    </Link>
                  ) : (
                    stat.value
                  )}
                </dd>
                <dt className="mt-0.5 text-[10px] leading-tight text-muted md:mt-1 md:text-sm md:leading-5">{stat.label}</dt>
              </div>
            ))}
          </dl>
          <DealTicker cards={tickerCards} label={t.home.tickerLabel} money={money} href={href} />
          {updatedAt && (
            <p className="mt-3 text-center text-xs text-muted md:mt-6">{fmt(t.home.updated, { time: updatedAt })}</p>
          )}
        </Container>
      </section>

      <Container className="space-y-8 py-6 md:space-y-14 md:py-12">
        {/* Asked for after the page is shown; nothing for new visitors (components/recommendations). */}
        {features.recommendations && <RecommendedRow />}
        {/* Right after the hero: prices our own checks saw fall, the site's strongest promise. */}
        {fresh.length > 0 && (
          <section className="-mx-1 rounded-3xl border border-brand/25 p-3 shadow-card md:mx-0 md:p-7" style={{ background: "radial-gradient(60% 50% at 0% 0%, var(--brand-soft), transparent 70%), var(--surface)" }}>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div className="max-w-2xl">
                <p className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-strong">
                  <BadgeCheck className="size-3.5" aria-hidden />
                  {t.fresh.badge}
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight">{t.fresh.title}</h2>
                <p className="mt-1 text-sm text-muted">{fmt(t.fresh.homeHint, { days: market.deals.freshDrop.windowDays })}</p>
              </div>
            </div>
            <ProductGrid cards={fresh} t={t} money={money} href={href} />
            <div className="mt-6 flex justify-center">
              <ButtonLink href={href("/fresh")} size="lg" className="w-full sm:w-auto">
                {fmt(t.fresh.seeAll, { count: freshCount.total })}
                <ArrowRight className="size-5" aria-hidden />
              </ButtonLink>
            </div>
          </section>
        )}

        <section>
          <SectionHeading title={t.home.categoriesTitle} />
          <div className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-4">
            {orderedCategories(order).map((category) => (
              <Link
                key={category.slug}
                href={href(`/category/${category.slug}`)}
                className="group flex min-w-0 items-center gap-2.5 rounded-2xl border border-line bg-surface p-3 transition-all md:gap-4 md:p-5 duration-200 hover:-translate-y-0.5 hover:border-brand/70 hover:shadow-card hover:ring-1 hover:ring-brand/30"
              >
                <span
                  className={`relative grid size-9 shrink-0 place-items-center md:size-12 overflow-hidden rounded-xl transition-transform duration-200 group-hover:scale-105 ${CATEGORY_TEXT[category.slug]}`}
                >
                  <span aria-hidden className="absolute inset-0 bg-current opacity-10" />
                  <CategoryIcon category={category.slug} className="relative size-5 md:size-6" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold group-hover:underline md:text-base">{t.categories[category.slug].name}</span>
                  <span className="block truncate text-sm text-muted max-md:hidden">{t.categories[category.slug].description}</span>
                  <span
                    className={`mt-0.5 block truncate text-xs font-semibold md:mt-1 ${stats.byCategory[category.slug] ? "text-brand-strong" : "text-muted"}`}
                  >
                    {fmt(t.home.categoryDeals, { count: stats.byCategory[category.slug] ?? 0 })}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        {popularTiles.length > 0 && (
          <section>
            <SectionHeading title={t.home.popularTitle} hint={t.home.popularHint} />
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {popularTiles.map((row) => (
                <li
                  key={row.family.id}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card"
                >
                  {/* The photo and "from" price are the cheapest item, so they open it; the line below opens every variant. */}
                  <Link href={href(`/product/${row.cheapest.slug}`)} className="flex flex-1 flex-col">
                    <div className="aspect-[4/3] overflow-hidden">
                      <ProductImage
                        className="transition-transform duration-300 group-hover:scale-105"
                        imageUrl={row.cheapest.imageUrl}
                        title={row.cheapest.title}
                        category={row.cheapest.categorySlug}
                      />
                    </div>
                    <div className="flex flex-col gap-0.5 px-3 pt-3">
                      <span className="font-bold hover:underline">{row.family.label}</span>
                      <span className="text-sm font-semibold text-brand-strong">
                        {fmt(t.home.popularFrom, { price: money(row.fromMinor) })}
                      </span>
                    </div>
                  </Link>
                  <Link
                    href={`${href("/search")}?q=${encodeURIComponent(row.family.query)}`}
                    className="mt-auto px-3 pb-3 pt-1 text-xs text-muted hover:text-brand-strong hover:underline"
                  >
                    {fmt(t.home.popularMeta, { variants: row.variants, stores: row.stores.length })} ›
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {featured ? (
          <>
            <section>
              <FeaturedDeal card={featured} />
            </section>

            {market.assistedOrder.enabled && (
              <section className="rounded-3xl border border-global/30 bg-global-soft p-4 md:p-8">
                <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
                  <div className="max-w-2xl">
                    <p className="flex items-center gap-2 text-sm font-bold text-global">
                      <Handshake className="size-4" aria-hidden />
                      {t.order.badge}
                    </p>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight">{t.order.homeTitle}</h2>
                    <p className="mt-1.5 text-ink/80">{t.order.homeText}</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <ButtonLink href={`${href("/deals")}?scope=global`} className="bg-global text-surface hover:bg-global hover:opacity-90">
                      {t.order.browseAbroad}
                    </ButtonLink>
                    <ButtonLink href={href("/ordering-abroad")} variant="secondary">
                      {t.order.howLink}
                    </ButtonLink>
                  </div>
                </div>
                <div className="mt-6">
                  <OrderSteps t={t} compact />
                </div>
              </section>
            )}

            {topDeals.length > 0 && (
              <section>
                <SectionHeading
                  title={t.home.topDeals}
                  hint={t.home.topDealsHint}
                  action={{ href: href("/deals"), label: t.home.viewAll }}
                />
                <ProductGrid cards={topDeals} t={t} money={money} href={href} />
                <div className="mt-6 flex justify-center">
                  <ButtonLink href={href("/deals")} size="lg" variant="secondary" className="w-full sm:w-auto">
                    {fmt(t.home.seeAllDeals, { count: dealCount })}
                    <ArrowRight className="size-5" aria-hidden />
                  </ButtonLink>
                </div>
              </section>
            )}

            {lowest.items.length > 0 && (
              <section>
                <SectionHeading title={t.home.lowestTitle} hint={t.home.lowestHint} />
                <ProductGrid cards={lowest.items} t={t} money={money} href={href} />
              </section>
            )}
          </>
        ) : (
          <section className="rounded-2xl border border-dashed border-line px-6 py-16 text-center">
            <p className="font-semibold">{t.home.noDealsTitle}</p>
            <p className="mt-1 text-sm text-muted">{t.home.noDealsText}</p>
          </section>
        )}

        <section>
          <SectionHeading title={t.home.howTitle} />
          <ol className="grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="rounded-2xl border border-line bg-surface p-4 md:p-6">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand-strong">
                    <step.icon className="size-5" aria-hidden />
                  </span>
                  <span className="text-sm font-bold text-muted">0{index + 1}</span>
                </div>
                <h3 className="mt-4 font-bold">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </Container>
    </>
  );
}
