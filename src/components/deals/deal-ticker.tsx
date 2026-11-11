import Link from "next/link";
import type { ProductCardData } from "@/modules/catalog/card";
import { shownPrice } from "@/modules/catalog/price-parts";
import { ProductImage } from "@/components/product/product-image";

/**
 * A slowly moving strip of today's deals under the hero: the page shows real
 * products from the first second. The list is rendered twice so the loop has
 * no gap; the copy is hidden from screen readers and keyboard focus. Stops on
 * hover, and stands still (scrollable) for people who ask for less motion.
 */
export function DealTicker({
  cards,
  label,
  money,
  href,
}: {
  cards: ProductCardData[];
  label: string;
  money: (amountMinor: number) => string;
  href: (path?: string) => string;
}) {
  if (cards.length < 4) return null;

  const item = (card: ProductCardData, copy: boolean) => {
    const price = shownPrice({ totalMinor: card.landedMinor, itemMinor: card.itemMinor, usualItemMinor: card.usualItemMinor, usualTotalMinor: card.usualLandedMinor });
    return (
      <li key={`${copy ? "copy-" : ""}${card.productId}`} aria-hidden={copy || undefined}>
        <Link
          href={href(`/product/${card.slug}`)}
          tabIndex={copy ? -1 : undefined}
          className="flex w-64 items-center gap-3 rounded-2xl border border-line bg-surface/80 p-2 pr-3 backdrop-blur-sm transition-colors hover:border-brand/60"
        >
          <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-surface-2">
            <ProductImage imageUrl={card.imageUrl} title={card.title} category={card.categorySlug} />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-xs font-semibold text-ink">{card.title}</span>
            <span className="mt-0.5 flex items-center gap-1.5">
              <span className="text-sm font-bold text-ink">{money(price.mainMinor)}</span>
              {card.discountPct !== null && (
                <span className="rounded-md bg-deal px-1.5 text-[11px] font-bold text-on-deal">−{card.discountPct}%</span>
              )}
            </span>
          </span>
        </Link>
      </li>
    );
  };

  return (
    <div className="deal-ticker group mt-6 md:mt-10" aria-label={label} role="region">
      <ul className="deal-ticker-track flex w-max gap-3 group-hover:[animation-play-state:paused]">
        {cards.map((card) => item(card, false))}
        {cards.map((card) => item(card, true))}
      </ul>
    </div>
  );
}
