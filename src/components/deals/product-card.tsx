import Link from "next/link";
import { BadgeCheck, Store, TrendingDown, Truck } from "lucide-react";
import type { ProductCardData } from "@/modules/catalog/card";
import type { Dictionary } from "@/i18n/dictionaries";
import { fmt } from "@/i18n/format";
import { cn } from "@/lib/cn";
import { WatchButton } from "@/components/alerts/watch-button";
import { CartButton } from "@/components/cart/cart-button";
import { FavoriteButton } from "@/components/favorites/favorite-button";
import { ProductImage } from "@/components/product/product-image";
import { ScopeTag } from "@/components/ui/scope-tag";
import { brandLabel } from "@/lib/text";
import { priceParts } from "@/modules/catalog/price-parts";

export interface CardLabels {
  t: Dictionary;
  money: (amountMinor: number) => string;
  href: (path?: string) => string;
}

/**
 * The one card used everywhere a product is listed. It takes formatters as
 * props so the same component works from Server and Client Components.
 */
/** An extra line on a card, e.g. how its price compares with another product. */
export interface CardNote {
  text: string;
  tone: "good" | "neutral";
}

export function ProductCard({
  card,
  note,
  compact = false,
  t,
  money,
  href,
}: { card: ProductCardData; note?: CardNote | null; compact?: boolean } & CardLabels) {
  // The badge and crossed-out total are the store's own discount; our own check is the line below.
  const checked = Boolean(card.fresh) || card.verified;
  const isDeal = card.discountPct !== null && card.usualLandedMinor !== null;
  const lowest = card.badges.includes("lowest_price");
  // Sold locally and abroad: say so, and show both prices instead of only the cheaper one.
  const inBoth = card.bestLocalLandedMinor !== null && card.bestGlobalLandedMinor !== null;
  // "35,00 ₼ + 10,20 ₼ delivery/customs" under the total, when something is added to the store's price.
  const parts = priceParts(card.landedMinor, card.itemMinor);

  return (
    // The buttons are siblings of the link, not inside it: a button within a link is invalid.
    <article className="relative flex w-full">
      {/* Same box as the photo, so the buttons sit in its bottom-right corner at any card width. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 aspect-square md:aspect-[4/3]">
        <div
          className={cn(
            "pointer-events-auto absolute flex gap-1.5",
            compact ? "bottom-2 right-2 md:bottom-2.5 md:right-2.5" : "bottom-2 right-2 md:bottom-3 md:right-3",
          )}
        >
          <CartButton offerId={card.offerId} className="max-md:size-8" />
          {/* Three buttons would cover a phone-sized photo: the alert is on the product page. */}
          <WatchButton productId={card.productId} className="max-md:hidden" />
          <FavoriteButton productId={card.productId} className="max-md:size-8" />
        </div>
      </div>
      <Link
        href={href(`/product/${card.slug}`)}
        className={cn(
          "group flex w-full flex-col overflow-hidden border border-line bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/70 hover:shadow-card hover:ring-1 hover:ring-brand/30",
          compact ? "rounded-xl" : "rounded-2xl",
        )}
      >
      <div className="relative aspect-square overflow-hidden md:aspect-[4/3]">
        <ProductImage
          imageUrl={card.imageUrl}
          title={card.title}
          category={card.categorySlug}
          className="transition-transform duration-300 group-hover:scale-105"
        />
        {isDeal && (
          <span
            className={cn(
              "absolute rounded-full font-bold",
              compact ? "left-2 top-2 px-2 py-0.5 text-xs md:left-2.5 md:top-2.5 md:text-sm" : "left-2 top-2 px-2 py-0.5 text-xs md:left-3 md:top-3 md:px-2.5 md:py-1 md:text-sm",
              "bg-deal text-on-deal shadow-sm",
            )}
          >
            −{card.discountPct}%
          </span>
        )}
        <ScopeTag
          scope={inBoth ? "both" : card.scope}
          label={inBoth ? t.deal.bothMarkets : card.scope === "local" ? t.deal.local : t.deal.global}
          iconOnPhones
          className={cn("absolute max-md:px-1.5 max-md:py-1.5", compact ? "right-2 top-2 md:right-2.5 md:top-2.5" : "right-2 top-2 md:right-3 md:top-3")}
        />
      </div>

      <div className={cn("flex flex-1 flex-col gap-1.5 p-3 md:gap-2", compact ? "md:p-3.5" : "md:p-4")}>
        {card.brand && (
          <p className={cn("truncate font-semibold tracking-wide text-muted", compact ? "text-[11px]" : "text-xs")}>
            {brandLabel(card.brand)}
          </p>
        )}
        <h3
          className={cn(
            "line-clamp-2 font-semibold text-ink group-hover:underline",
            "min-h-9 text-[13px] leading-[18px] md:min-h-10 md:text-sm md:leading-5",
          )}
        >
          {card.title}
        </h3>

        <div className="mt-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className={cn("text-base font-bold tracking-tight text-ink", compact ? "md:text-lg" : "md:text-xl")}>
              {money(card.landedMinor)}
            </span>
            {isDeal && (
              <span className={cn("text-xs text-muted line-through", !compact && "md:text-sm")}>
                {money(card.usualLandedMinor!)}
              </span>
            )}
            {/* The saving in money, beside the price: "610 ₼ cheaper" reads stronger than a percent. */}
            {isDeal && (card.savingsMinor ?? 0) > 0 && (
              // Just "−83,14 ₼", so it fits beside the price; the full "83,14 ₼ saved" is its label.
              <span
                title={fmt(t.deal.save, { amount: money(card.savingsMinor!) })}
                aria-label={fmt(t.deal.save, { amount: money(card.savingsMinor!) })}
                className={cn("whitespace-nowrap text-xs font-semibold text-deal", !compact && "md:text-sm")}
              >
                −{money(card.savingsMinor!)}
              </span>
            )}
          </div>
          {parts ? (
            <p className="text-[11px] leading-4 text-muted md:text-xs">
              {fmt(t.deal.breakdown, { item: money(parts.itemMinor), extra: money(parts.extraMinor) })}
            </p>
          ) : (
            !compact && <p className="text-xs text-muted max-md:hidden">{t.deal.totalHint}</p>
          )}
        </div>

        {inBoth && (
          <p className="text-xs text-muted">
            {fmt(t.deal.localFrom, { price: money(card.bestLocalLandedMinor!) })}
            {" · "}
            {fmt(t.deal.globalFrom, { price: money(card.bestGlobalLandedMinor!) })}
          </p>
        )}

        {note && (
          <p className={cn("text-sm font-semibold", note.tone === "good" ? "text-brand-strong" : "text-muted")}>
            {note.text}
          </p>
        )}

        {checked && (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-strong">
            <BadgeCheck className="size-3.5 shrink-0" aria-hidden />
            {t.fresh.cardCheck}
          </p>
        )}

        {lowest && (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-deal">
            <TrendingDown className="size-3.5" aria-hidden />
            {t.badges.lowest_price}
          </p>
        )}

        <div
          className={cn(
            "mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line text-muted",
            "pt-2 text-[11px] md:text-xs",
            compact ? "md:pt-2.5" : "md:pt-3",
          )}
        >
          <span className="flex min-w-0 items-center gap-1">
            <Store className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{card.supplierName}</span>
          </span>
          <span className="flex items-center gap-1">
            <Truck className="size-3.5 shrink-0" aria-hidden />
            {fmt(t.deal.deliveryDays, { days: card.deliveryMaxDays })}
          </span>
        </div>
      </div>
      </Link>
    </article>
  );
}
