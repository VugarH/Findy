import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { BadgeCheck, ChevronRight, Info, Search, TrendingDown } from "lucide-react";
import type { CategorySlug } from "@/config/categories";
import { isSubcategoryOf } from "@/config/subcategories";
import { fmt } from "@/i18n/format";
import { LOCALE_TAGS } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { toMinor } from "@/lib/money";
import { findMergeTargetSlug } from "@/modules/catalog/merge";
import { getProductDetail } from "@/modules/catalog/queries";
import { WatchButton } from "@/components/alerts/watch-button";
import { CartButton } from "@/components/cart/cart-button";
import { FollowButton } from "@/components/follows/follow-button";
import { AssistCard } from "@/components/orders/assist-card";
import { OfferPanel } from "@/components/product/offer-panel";
import { OffersTable } from "@/components/product/offers-table";
import { PriceHistoryChart } from "@/components/product/price-history-chart";
import { ProductImage } from "@/components/product/product-image";
import { SizeFinder, type SizedOffer } from "@/components/product/size-finder";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export async function generateMetadata({ params }: PageProps<"/[lang]/product/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { market } = await getI18n();
  const detail = await getProductDetail(slug, market);
  return detail ? { title: detail.product.title } : {};
}

export default async function ProductPage({ params }: PageProps<"/[lang]/product/[slug]">) {
  const { slug } = await params;
  const { t, money, href, market, locale } = await getI18n();

  const detail = await getProductDetail(slug, market);
  if (!detail) {
    // A duplicate merged into another product: its old address leads to that product.
    const target = await findMergeTargetSlug(slug);
    if (target) permanentRedirect(href(`/product/${target}`));
    notFound();
  }

  const { product, offers, summary, lastSeenAt } = detail;
  const category = product.categorySlug as CategorySlug;
  const subcategory = isSubcategoryOf(category, product.subcategorySlug) ? product.subcategorySlug : null;
  const best = summary?.best ?? null;
  const local = summary?.bestLocal ?? null;
  const global = summary?.bestGlobal ?? null;

  const gap = local && global ? Math.abs(local.landed.totalMinor - global.landed.totalMinor) : 0;
  const winnerOf = (offer: typeof best) => (offer && offer === best ? { savingsMinor: gap } : null);
  const threshold = market.customs.dutyFreeThreshold;
  // Clothes and shoes: the stores that list sizes, for "Find your size".
  const sizedOffers: SizedOffer[] = offers.flatMap((offer) =>
    offer.inStock && offer.sizes
      ? [
          {
            offerId: offer.offerId,
            storeName: offer.supplier.name,
            scope: offer.supplier.scope,
            landedMinor: offer.landed.totalMinor,
            delivery: offer.delivery,
            sizes: offer.sizes,
          },
        ]
      : [],
  );

  return (
    <Container className="py-8">
      <nav className="flex items-center gap-1 text-sm text-muted">
        <Link href={href("/deals")} className="hover:text-ink">
          {t.nav.deals}
        </Link>
        <ChevronRight className="size-4" aria-hidden />
        <Link href={href(`/category/${category}`)} className="hover:text-ink">
          {t.categories[category].name}
        </Link>
        {subcategory && (
          <>
            <ChevronRight className="size-4" aria-hidden />
            <Link href={href(`/category/${category}?sub=${subcategory}`)} className="hover:text-ink">
              {t.subcategories[subcategory]}
            </Link>
          </>
        )}
      </nav>

      <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_2fr]">
        <div className="aspect-square overflow-hidden rounded-3xl border border-line lg:sticky lg:top-40 lg:self-start">
          <ProductImage imageUrl={product.imageUrl} title={product.title} category={category} />
        </div>

        <div className="min-w-0 space-y-8">
          <header>
            {product.brand && (
              <p className="text-sm font-semibold uppercase tracking-wide text-muted">{product.brand}</p>
            )}
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">{product.title}</h1>
            {best && (
              <div className="mt-4 flex flex-wrap gap-2">
                <CartButton offerId={best.offerId} variant="button" />
                <WatchButton productId={product.id} variant="button" />
              </div>
            )}
            {best && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted">{t.follows.productLine}</span>
                {product.brand && <FollowButton kind="brand" value={product.brand} name={product.brand} />}
                <FollowButton kind="store" value={best.supplier.id} name={best.supplier.name} />
              </div>
            )}

            {best && (
              <div className="mt-4 space-y-2">
                {summary?.deal?.verified ? (
                  <>
                    <p className="flex items-start gap-2 rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold text-brand-strong">
                      <BadgeCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
                      {fmt(t.product.verified, { pct: summary.deal.discountPct })}
                      {" · "}
                      {fmt(t.deal.save, { amount: money(summary.deal.savingsMinor) })}
                    </p>
                    {best.verdict?.isLowest && (
                      <p className="flex items-center gap-2 px-1 text-sm font-semibold text-deal">
                        <TrendingDown className="size-4" aria-hidden />
                        {t.product.lowest}
                      </p>
                    )}
                  </>
                ) : summary?.deal ? (
                  <p className="flex items-start gap-2 rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">
                    <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {fmt(t.product.storeClaim, {
                      store: best.supplier.name,
                      pct: summary.deal.discountPct,
                      days: best.verdict?.historyDays ?? 0,
                      min: market.deals.minHistoryDays,
                    })}
                  </p>
                ) : (
                  <p className="flex items-start gap-2 rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">
                    <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {best.verdict ? t.product.notDeal : t.product.noHistory}
                  </p>
                )}
              </div>
            )}
          </header>

          {best ? (
            <>
              {sizedOffers.length > 0 && <SizeFinder offers={sizedOffers} />}

              <div className="grid gap-4 md:grid-cols-2">
                <OfferPanel title={t.product.bestLocal} offer={local} emptyText={t.product.noLocal} winner={winnerOf(local)} />
                <OfferPanel title={t.product.bestGlobal} offer={global} emptyText={t.product.noGlobal} winner={winnerOf(global)} />
              </div>

              {global && <AssistCard offer={global} productSlug={product.slug} />}

              {global && (
                <p className="flex items-start gap-2 text-xs leading-5 text-muted">
                  <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {fmt(t.product.customsNote, {
                    threshold: money(toMinor(threshold.amount), threshold.currency),
                  })}
                </p>
              )}

              {best.history.length >= 2 && (
                <section className="rounded-2xl border border-line bg-surface p-5">
                  <h2 className="text-lg font-bold">{t.product.historyTitle}</h2>
                  <p className="mb-4 text-sm text-muted">
                    {fmt(t.product.historySubtitle, {
                      store: best.supplier.name,
                      days: market.deals.historyWindowDays,
                    })}
                  </p>
                  <PriceHistoryChart
                    points={best.history}
                    currency={best.currency}
                    usualMinor={best.verdict?.usualMinor ?? null}
                  />
                </section>
              )}
            </>
          ) : (
            <p className="rounded-2xl border border-dashed border-line px-6 py-12 text-center text-muted">
              {lastSeenAt
                ? fmt(t.product.staleOffers, {
                    date: new Intl.DateTimeFormat(LOCALE_TAGS[locale], { day: "numeric", month: "long" }).format(lastSeenAt),
                  })
                : t.product.noOffers}
            </p>
          )}

          <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-5">
            <p className="max-w-md text-sm text-muted">{t.product.findElsewhereHint}</p>
            <ButtonLink href={href(`/product/${product.slug}/similar`)} variant="secondary">
              <Search className="size-4" aria-hidden />
              {t.product.findElsewhere}
            </ButtonLink>
          </section>

          {offers.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-bold">{t.product.allOffers}</h2>
              <OffersTable offers={offers} />
            </section>
          )}
        </div>
      </div>
    </Container>
  );
}
