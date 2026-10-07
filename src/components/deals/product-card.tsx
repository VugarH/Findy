import Link from "next/link";
import { Store, TrendingDown, Truck } from "lucide-react";
import type { ProductCardData } from "@/modules/catalog/card";
import type { Dictionary } from "@/i18n/dictionaries";
import { fmt } from "@/i18n/format";
import { cn } from "@/lib/cn";
import { WatchButton } from "@/components/alerts/watch-button";
import { CartButton } from "@/components/cart/cart-button";
import { ProductImage } from "@/components/product/product-image";
import { ScopeTag } from "@/components/ui/scope-tag";

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
  const isDeal = card.discountPct !== null && card.usualLandedMinor !== null;
  const lowest = card.badges.includes("lowest_price");
  // Sold locally and abroad: say so, and show both prices instead of only the cheaper one.
  const inBoth = card.bestLocalLandedMinor !== null && card.bestGlobalLandedMinor !== null;

  return (
    // The buttons are siblings of the link, not inside it: a button within a link is invalid.
    <article className="relative flex w-full">
      {/* Same box as the photo, so the buttons sit in its bottom-right corner at any card width. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 aspect-[4/3]">
        <div
          className={cn(
            "pointer-events-auto absolute flex gap-1.5",
            compact ? "bottom-2.5 right-2.5" : "bottom-3 right-3",
          )}
        >
          <CartButton offerId={card.offerId} />
          <WatchButton productId={card.productId} />
        </div>
      </div>
      <Link
        href={href(`/product/${card.slug}`)}
        className={cn(
          "group flex w-full flex-col overflow-hidden border border-line bg-surface transition-shadow hover:shadow-card",
          compact ? "rounded-xl" : "rounded-2xl",
        )}
      >
      <div className={cn("relative overflow-hidden", "aspect-[4/3]")}>
        <ProductImage imageUrl={card.imageUrl} title={card.title} category={card.categorySlug} />
        {isDeal && (
          <span
            className={cn(
              "absolute rounded-full font-bold",
              compact ? "left-2.5 top-2.5 px-2 py-0.5 text-sm" : "left-3 top-3 px-2.5 py-1 text-sm",
              card.verified ? "bg-deal text-on-deal" : "border border-line bg-surface text-ink",
            )}
          >
            −{card.discountPct}%
          </span>
        )}
        <ScopeTag
          scope={inBoth ? "both" : card.scope}
          label={inBoth ? t.deal.bothMarkets : card.scope === "local" ? t.deal.local : t.deal.global}
          className={cn("absolute", compact ? "right-2.5 top-2.5" : "right-3 top-3")}
        />
      </div>

      <div className={cn("flex flex-1 flex-col", compact ? "gap-2 p-3.5" : "gap-2 p-4")}>
        {card.brand && (
          <p className={cn("truncate font-semibold uppercase tracking-wide text-muted", compact ? "text-[11px]" : "text-xs")}>
            {card.brand}
          </p>
        )}
        <h3
          className={cn(
            "line-clamp-2 font-semibold text-ink group-hover:underline",
            "min-h-10 text-sm leading-5",
          )}
        >
          {card.title}
        </h3>

        <div className="mt-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className={cn("font-bold tracking-tight text-ink", compact ? "text-lg" : "text-xl")}>
              {money(card.landedMinor)}
            </span>
            {isDeal && (
              <span className={cn("text-muted line-through", compact ? "text-xs" : "text-sm")}>
                {money(card.usualLandedMinor!)}
              </span>
            )}
          </div>
          {!compact && <p className="text-xs text-muted">{t.deal.totalHint}</p>}
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

        {isDeal && !card.verified && (
          <p className={cn("text-muted", "text-xs")}>{t.deal.storeClaim}</p>
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
            compact ? "pt-2.5 text-xs" : "pt-3 text-xs",
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
