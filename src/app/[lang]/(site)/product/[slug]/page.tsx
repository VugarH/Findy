import { usableImage } from "@/config/images";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { BadgeCheck, ChevronRight, Info, Search, Sparkles, TrendingDown } from "lucide-react";
import type { CategorySlug } from "@/config/categories";
import { isSubcategoryOf } from "@/config/subcategories";
import { siteConfig } from "@/config/site";
import { fmt, formatDay } from "@/i18n/format";
import { LOCALE_TAGS } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { toMinor } from "@/lib/money";
import { findMergeTargetSlug } from "@/modules/catalog/merge";
import { historyInMarketCurrency, toMarketCurrency } from "@/modules/catalog/offer-view";
import { getProductDetail } from "@/modules/catalog/queries";
import { storeDiscount } from "@/modules/catalog/summary";
import { offerFreshDrop } from "@/modules/deals/fresh-drop";
import { sameBrand } from "@/modules/catalog/normalizers/fashion";
import { WatchButton } from "@/components/alerts/watch-button";
import { FollowButton } from "@/components/follows/follow-button";
import { AssistCard } from "@/components/orders/assist-card";
import { OfferPanel } from "@/components/product/offer-panel";
import { OffersTable } from "@/components/product/offers-table";
import { OtherSideLine } from "@/components/product/other-side-line";
import { ShareButton } from "@/components/product/share-button";
import { PriceHistoryChart } from "@/components/product/price-history-chart";
import { ProductImage } from "@/components/product/product-image";
import { productGallery } from "@/modules/catalog/gallery";
import { PHOTO_FRAME, ProductGallery } from "@/components/product/product-gallery";
import { SizeFinder, type SizedOffer } from "@/components/product/size-finder";
import { Container } from "@/components/ui/container";
import { brandLabel } from "@/lib/text";

export async function generateMetadata({ params }: PageProps<"/[lang]/product/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { market, t, money } = await getI18n();
  const detail = await getProductDetail(slug, market);
  if (!detail) return {};
  // What a shared link shows: the product photo, its best price and where.
  const best = detail.summary?.best;
  const store = best ? storeDiscount(best) : null;
  const description = best
    ? fmt(store ? t.meta.productPreviewDeal : t.meta.productPreview, {
        price: money(best.landed.totalMinor),
        store: best.supplier.name,
        pct: store?.pct ?? 0,
      })
    : t.meta.description;
  const image = usableImage(detail.product.imageUrl);
  return {
    title: detail.product.title,
    description,
    // A page's openGraph replaces the layout's, so the site-wide fields are repeated here.
    openGraph: { siteName: siteConfig.name, type: "website", title: detail.product.title, description, ...(image ? { images: [{ url: image, alt: detail.product.title }] } : {}) },
  };
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
  const gallery = await productGallery(product.id, product.imageUrl);
  const category = product.categorySlug as CategorySlug;
  const subcategory = isSubcategoryOf(category, product.subcategorySlug) ? product.subcategorySlug : null;
  const best = summary?.best ?? null;
  const local = summary?.bestLocal ?? null;
  const global = summary?.bestGlobal ?? null;

  // The best offer gets the full box; the other side (local or abroad) a single line.
  const bestIsLocal = best?.supplier.scope === "local";
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

  const deal = summary?.deal ?? null;
  const storeClaim = best && deal && !deal.verified;
  const hasHistory = (best?.history.length ?? 0) >= 2;
  const showAssist = Boolean(best && global);
  // "Usual price 70,13 ₼ ($41,25) at Champion": the store's own usual price, in manat and in its currency.
  const usualStore = best?.verdict?.usualMinor ?? null;
  const usual =
    best && usualStore !== null
      ? {
          minor: toMarketCurrency(usualStore, best, market),
          label: fmt(t.product.usualPriceAt, {
            price: money(toMarketCurrency(usualStore, best, market)),
            original: best.currency === market.currency ? "" : ` (${money(usualStore, best.currency)})`,
            store: best.supplier.name,
          }),
        }
      : null;

  // A recent drop by our own checks (Verified discounts): shown only when there is no verified-discount line.
  const fresh = best ? offerFreshDrop(best, market) : null;
  const freshLine = fresh && (
    <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-strong">
      <BadgeCheck className="size-4 shrink-0" aria-hidden />
      {fmt(t.fresh.productNote, { pct: fresh.dropPct, date: formatDay(fresh.fromOn, locale, "long") })}
    </p>
  );

  // One short line under the price; the longer explanation sits with the price history.
  const dealNote = !best ? null : fresh && !deal?.verified ? (
    freshLine
  ) : deal?.verified ? (
    <div className="space-y-1">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-strong">
        <BadgeCheck className="size-4 shrink-0" aria-hidden />
        {fmt(t.product.verified, { pct: deal.discountPct })} · {fmt(t.deal.save, { amount: money(deal.savingsMinor) })}
      </p>
      {best.verdict?.isLowest && (
        <p className="flex items-center gap-1.5 text-sm font-semibold text-deal">
          <TrendingDown className="size-4" aria-hidden />
          {t.product.lowest}
        </p>
      )}
    </div>
  ) : (
    <p className="flex items-center gap-1.5 text-xs text-muted">
      <Info className="size-3.5 shrink-0" aria-hidden />
      {deal ? t.deal.storeClaim : best.verdict ? t.product.notDeal : t.product.noHistory}
    </p>
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

      {/* First screen: the photo and everything needed to decide and buy. */}
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,11fr)_minmax(0,13fr)] lg:gap-10">
        <div className="lg:sticky lg:top-40 lg:self-start">
          {gallery.length > 0 ? (
            <ProductGallery images={gallery} title={product.title} labels={{ photo: t.product.photo }} />
          ) : (
            <div className={PHOTO_FRAME}>
              <ProductImage imageUrl={null} title={product.title} category={category} />
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <header>
            {product.brand && <p className="text-sm font-semibold tracking-wide text-muted">{brandLabel(product.brand)}</p>}
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{product.title}</h1>
            {/* Pre-owned items (The Luxury Closet): never mistaken for new. */}
            {product.attributes.condition === "pre-owned" && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink">
                <Sparkles className="size-3.5 text-cat-jewelry" aria-hidden />
                {t.product.preowned}
                {product.attributes.conditionGrade &&
                  ` · ${fmt(t.product.conditionGrade, {
                    grade: t.product.conditions[product.attributes.conditionGrade as keyof typeof t.product.conditions] ?? product.attributes.conditionGrade,
                  })}`}
              </p>
            )}
            {best && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted">{t.follows.productLine}</span>
                {product.brand && <FollowButton kind="brand" value={product.brand} name={product.brand} />}
                {/* A brand's own store (Champion on champion.com) needs one button, not two. */}
                {!(product.brand && sameBrand(product.brand, best.supplier.name)) && (
                  <FollowButton kind="store" value={best.supplier.id} name={best.supplier.name} />
                )}
              </div>
            )}
          </header>

          {best ? (
            <>
              <OfferPanel
                offer={best}
                note={dealNote}
                extraActions={
                  <>
                    <WatchButton productId={product.id} variant="button" />
                    <ShareButton title={product.title} />
                  </>
                }
              >
                {sizedOffers.length > 0 && <SizeFinder offers={sizedOffers} />}
              </OfferPanel>
              {bestIsLocal ? (
                <OtherSideLine title={t.product.bestGlobal} offer={global} emptyText={t.product.noGlobal} />
              ) : (
                <OtherSideLine title={t.product.bestLocal} offer={local} emptyText={t.product.noLocal} />
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
        </div>
      </div>

      {/* Second: how the price moved, then ordering it through us. */}
      {best && (hasHistory || showAssist) && (
        <div className="mt-10 space-y-6">
          {hasHistory && (
            <section className="min-w-0 rounded-2xl border border-line bg-surface p-5">
              <h2 className="text-lg font-bold">{t.product.historyTitle}</h2>
              <p className="mb-4 text-sm text-muted">
                {fmt(t.product.historySubtitle, { store: best.supplier.name, days: market.deals.historyWindowDays })}
              </p>
              <PriceHistoryChart points={historyInMarketCurrency(best, market)} currency={market.currency} usual={usual} />
              {storeClaim && deal && (
                <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-muted">
                  <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {fmt(t.product.storeClaim, {
                    store: best.supplier.name,
                    pct: storeDiscount(best)?.pct ?? deal.discountPct,
                    days: best.verdict?.historyDays ?? 0,
                    min: market.deals.minHistoryDays,
                  })}
                </p>
              )}
            </section>
          )}
          {showAssist && global && (
            <div className="min-w-0 space-y-3">
              <AssistCard offer={global} />
              <p className="flex items-start gap-2 text-xs leading-5 text-muted">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {fmt(t.product.customsNote, { threshold: money(toMinor(threshold.amount), threshold.currency) })}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Last: every store, when there is more than one; and the search for the same item elsewhere. */}
      <section className="mt-10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          {offers.length > 1 && <h2 className="text-lg font-bold">{t.product.allOffers}</h2>}
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span>{t.product.findElsewhereHint}</span>
            <Link href={href(`/product/${product.slug}/similar`)} className="inline-flex items-center gap-1.5 font-semibold text-brand-strong hover:underline">
              <Search className="size-4" aria-hidden />
              {t.product.findElsewhere}
            </Link>
          </p>
        </div>
        {offers.length > 1 && <OffersTable offers={offers} />}
      </section>
    </Container>
  );
}
