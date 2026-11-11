import Link from "next/link";
import { Flame, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ProductCardData } from "@/modules/catalog/card";
import { shownPrice } from "@/modules/catalog/price-parts";
import { ProductImage } from "@/components/product/product-image";
import { brandLabel } from "@/lib/text";

/**
 * A deal floating beside the hero title on wide screens: half see-through and
 * tilted so it stays behind the headline, solid and straight on hover. Shown
 * from 1100 px, sized to the room beside the title; narrower screens have the
 * full featured deal further down.
 */
export function HeroDealCard({
  card,
  label,
  money,
  href,
  side = "right",
}: {
  card: ProductCardData;
  label: string;
  /** Right: the deal of the day; left: a pick for this visitor, tilted the other way. */
  side?: "left" | "right";
  money: (amountMinor: number) => string;
  href: (path?: string) => string;
}) {
  const price = shownPrice({ totalMinor: card.landedMinor, itemMinor: card.itemMinor, usualItemMinor: card.usualItemMinor, usualTotalMinor: card.usualLandedMinor });

  return (
    <div
      className={cn(
        "hero-float pointer-events-none absolute hidden min-[1100px]:block",
        side === "right" ? "right-[max(1rem,calc((100vw-80rem)/2))] top-12" : "left-[max(1rem,calc((100vw-80rem)/2))] top-32 [animation-delay:-3s]",
      )}
    >
      <Link
        href={href(`/product/${card.slug}`)}
        className={cn(
          "pointer-events-auto block w-[clamp(9rem,calc((100vw-48rem)/2-2.5rem),12rem)] rounded-3xl border border-line bg-surface/40 p-3 opacity-70 shadow-card backdrop-blur-md transition-all duration-300 hover:rotate-0 hover:scale-105 hover:border-brand/60 hover:bg-surface hover:opacity-100 hover:shadow-2xl",
          side === "right" ? "rotate-6" : "-rotate-[5deg]",
        )}
      >
        <span
          className={cn(
            "mb-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
            side === "right" ? "bg-deal text-on-deal" : "bg-brand text-on-brand",
          )}
        >
          {side === "right" ? <Flame className="size-3" aria-hidden /> : <Sparkles className="size-3" aria-hidden />}
          {label}
        </span>
        <span className="relative block aspect-square overflow-hidden rounded-2xl bg-surface-2">
          <ProductImage imageUrl={card.imageUrl} title={card.title} category={card.categorySlug} />
          {card.discountPct !== null && (
            <span className="absolute left-2 top-2 rounded-full bg-deal px-2 py-0.5 text-xs font-bold text-on-deal">−{card.discountPct}%</span>
          )}
        </span>
        {card.brand && <span className="mt-2 block truncate text-[11px] font-semibold text-brand-strong">{brandLabel(card.brand)}</span>}
        <span className="mt-0.5 line-clamp-2 text-left text-sm font-semibold leading-5 text-ink">{card.title}</span>
        <span className="mt-1 flex items-baseline gap-2">
          <span className="text-lg font-extrabold text-ink">{money(price.mainMinor)}</span>
          {price.wasMinor !== null && <span className="text-xs text-muted line-through">{money(price.wasMinor)}</span>}
        </span>
      </Link>
    </div>
  );
}
