import Link from "next/link";
import { Calculator, Handshake, RefreshCw, ShieldCheck } from "lucide-react";
import { CATEGORIES } from "@/config/categories";
import { LOCALE_TAGS } from "@/i18n/config";
import { fmt } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { getPopularCoverage } from "@/modules/catalog/popular";
import { getDealStats, listDeals } from "@/modules/deals/queries";
import { FeaturedDeal } from "@/components/deals/featured-deal";
import { ProductGrid } from "@/components/deals/product-grid";
import { OrderSteps } from "@/components/orders/steps";
import { ProductImage } from "@/components/product/product-image";
import { SearchBar } from "@/components/search/search-bar";
import { ButtonLink } from "@/components/ui/button";
import { CATEGORY_TEXT, CategoryIcon } from "@/components/ui/category-icon";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";

export default async function HomePage() {
  const { t, money, href, market, locale } = await getI18n();

  const [stats, top, lowest, popular] = await Promise.all([
    getDealStats(market),
    listDeals(market, { sort: "best", limit: 9 }),
    listDeals(market, { badge: "lowest_price", sort: "discount", limit: 4 }),
    getPopularCoverage(market),
  ]);
  // Families sold by several stores come first: those are the ones worth comparing.
  const popularTiles = [...popular].sort((a, b) => b.stores.length - a.stores.length).slice(0, 12);
  const [featured, ...topDeals] = top.items;

  const statTiles = [
    { value: stats.dealCount.toLocaleString(LOCALE_TAGS[locale]), label: t.home.statDeals },
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
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Baku",
      }).format(stats.lastRunAt)
    : null;

  return (
    <>
      <section className="border-b border-line bg-surface">
        <Container className="py-12 md:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <p className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-strong">
              <span className="size-1.5 rounded-full bg-brand" aria-hidden />
              {t.home.heroBadge}
            </p>
            <h1 className="mt-5 text-balance text-4xl font-extrabold tracking-tight md:text-5xl">{t.home.heroTitle}</h1>
            <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg text-muted">{t.home.heroSubtitle}</p>
            <SearchBar
              action={href("/search")}
              placeholder={t.search.placeholder}
              buttonLabel={t.search.button}
              size="lg"
              className="mx-auto mt-8 max-w-2xl"
            />
          </div>

          <dl className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-x-6 gap-y-6 md:grid-cols-4">
            {statTiles.map((stat) => (
              <div key={stat.label} className="text-center">
                <dd className="text-3xl font-extrabold tracking-tight">{stat.value}</dd>
                <dt className="mt-1 text-sm text-muted">{stat.label}</dt>
              </div>
            ))}
          </dl>
          {updatedAt && (
            <p className="mt-6 text-center text-xs text-muted">{fmt(t.home.updated, { time: updatedAt })}</p>
          )}
        </Container>
      </section>

      <Container className="space-y-14 py-12">
        <section>
          <SectionHeading title={t.home.categoriesTitle} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CATEGORIES.map((category) => (
              <Link
                key={category.slug}
                href={href(`/category/${category.slug}`)}
                className="group flex items-center gap-4 rounded-2xl border border-line bg-surface p-5 transition-shadow hover:shadow-card"
              >
                <span className={`grid size-12 shrink-0 place-items-center rounded-xl bg-surface-2 ${CATEGORY_TEXT[category.slug]}`}>
                  <CategoryIcon category={category.slug} className="size-6" />
                </span>
                <span className="min-w-0">
                  <span className="block font-bold group-hover:underline">{t.categories[category.slug].name}</span>
                  <span className="block truncate text-sm text-muted">{t.categories[category.slug].description}</span>
                  <span className="mt-1 block text-xs font-semibold text-brand-strong">
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
                <li key={row.family.id}>
                  <Link
                    href={`${href("/search")}?q=${encodeURIComponent(row.family.query)}`}
                    className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-shadow hover:shadow-card"
                  >
                    <div className="aspect-[4/3] overflow-hidden">
                      <ProductImage
                        imageUrl={row.cheapest.imageUrl}
                        title={row.family.label}
                        category={row.cheapest.categorySlug}
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-0.5 p-3">
                      <span className="font-bold group-hover:underline">{row.family.label}</span>
                      <span className="text-sm font-semibold text-brand-strong">
                        {fmt(t.home.popularFrom, { price: money(row.fromMinor) })}
                      </span>
                      <span className="mt-auto pt-1 text-xs text-muted">
                        {fmt(t.home.popularMeta, { variants: row.variants, stores: row.stores.length })}
                      </span>
                    </div>
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
              <section className="rounded-3xl border border-global/30 bg-global-soft p-6 md:p-8">
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
              <li key={step.title} className="rounded-2xl border border-line bg-surface p-6">
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
