"use client";

import { ArrowUpRight, Ruler } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { cn } from "@/lib/cn";
import { sortSizes } from "@/modules/suppliers/sizes";
import { CartButton } from "@/components/cart/cart-button";
import { ScopeTag } from "@/components/ui/scope-tag";

export interface SizedOffer {
  offerId: string;
  storeName: string;
  scope: "local" | "global";
  landedMinor: number;
  delivery: { min: number; max: number };
  sizes: { label: string; inStock: boolean }[];
}

/**
 * "Find your size": every size any store lists for this product. Picking one
 * shows the stores that have it in stock, cheapest first — the deal is only
 * a deal if your size is there.
 */
export function SizeFinder({ offers }: { offers: SizedOffer[] }) {
  const { t, money } = useI18n();
  const p = t.product;
  const [selected, setSelected] = useState<string | null>(null);

  const all = new Map<string, boolean>();
  for (const offer of offers) for (const size of offer.sizes) all.set(size.label, (all.get(size.label) ?? false) || size.inStock);
  const sizes = sortSizes([...all].map(([label, inStock]) => ({ label, inStock })));
  const stores = selected
    ? offers
        .filter((offer) => offer.sizes.some((size) => size.label === selected && size.inStock))
        .sort((a, b) => a.landedMinor - b.landedMinor)
    : [];

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="flex items-center gap-2 font-bold">
        <Ruler className="size-4 text-brand" aria-hidden />
        {p.sizeFinderTitle}
      </h2>
      <p className="mt-1 text-sm text-muted">{p.sizeFinderHint}</p>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={p.sizes}>
        {sizes.map((size) => (
          <button
            key={size.label}
            type="button"
            disabled={!size.inStock}
            aria-pressed={selected === size.label}
            onClick={() => setSelected(selected === size.label ? null : size.label)}
            className={cn(
              "h-9 min-w-11 rounded-lg border px-3 text-sm font-semibold tabular-nums transition-colors",
              selected === size.label
                ? "border-ink bg-ink text-bg"
                : size.inStock
                  ? "border-line bg-surface text-ink hover:border-ink"
                  : "cursor-not-allowed border-dashed border-line text-muted line-through",
            )}
          >
            {size.label}
            {!size.inStock && <span className="sr-only"> ({p.soldOut})</span>}
          </button>
        ))}
      </div>

      {selected && (
        <div className="mt-4 border-t border-line pt-4" aria-live="polite">
          <p className="text-sm font-semibold">{fmt(p.sizeAvailableAt, { size: selected })}</p>
          <ul className="mt-2 divide-y divide-line">
            {stores.map((offer) => (
              <li key={offer.offerId} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    {offer.storeName}
                    <ScopeTag scope={offer.scope} label={offer.scope === "local" ? t.deal.local : t.deal.global} />
                  </span>
                  <span className="text-xs text-muted">{fmt(p.deliveryRange, offer.delivery)}</span>
                </span>
                <span className="text-sm font-bold tabular-nums">{money(offer.landedMinor)}</span>
                <a
                  href={`/go/${offer.offerId}`}
                  target="_blank"
                  rel="nofollow sponsored noopener"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-brand-strong hover:underline"
                >
                  {p.goToStore}
                  <ArrowUpRight className="size-4" aria-hidden />
                </a>
                <CartButton offerId={offer.offerId} variant="text" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
