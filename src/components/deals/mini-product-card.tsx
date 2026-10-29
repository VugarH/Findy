import Link from "next/link";
import type { ProductCardData } from "@/modules/catalog/card";
import { brandLabel } from "@/lib/text";
import { ProductImage } from "@/components/product/product-image";
import type { CardLabels } from "./product-card";

/**
 * A small product card for sideways rows (Similar items): photo, discount,
 * brand, name and price only. The full card is ./product-card.tsx.
 */
export function MiniProductCard({ card, money, href }: { card: ProductCardData } & Omit<CardLabels, "t">) {
  const isDeal = card.discountPct !== null && card.usualLandedMinor !== null;
  return (
    <Link
      href={href(`/product/${card.slug}`)}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-card"
    >
      <div className="relative aspect-square overflow-hidden">
        <ProductImage
          imageUrl={card.imageUrl}
          title={card.title}
          category={card.categorySlug}
          className="transition-transform duration-300 group-hover:scale-105"
        />
        {isDeal && (
          <span className="absolute left-2 top-2 rounded-full bg-deal px-1.5 py-0.5 text-xs font-bold text-on-deal shadow-sm">
            −{card.discountPct}%
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        {card.brand && <p className="truncate text-[11px] font-semibold tracking-wide text-muted">{brandLabel(card.brand)}</p>}
        <h3 className="line-clamp-2 min-h-8 text-xs font-medium leading-4 text-ink group-hover:underline">{card.title}</h3>
        <div className="mt-auto flex flex-wrap items-baseline gap-x-1.5 pt-1">
          <span className="text-sm font-bold text-ink">{money(card.landedMinor)}</span>
          {isDeal && <span className="text-[11px] text-muted line-through">{money(card.usualLandedMinor!)}</span>}
        </div>
      </div>
    </Link>
  );
}
