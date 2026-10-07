import Link from "next/link";
import { ArrowRight, Flame, Store, Truck } from "lucide-react";
import type { ProductCardData } from "@/modules/catalog/card";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/format";
import { ProductImage } from "@/components/product/product-image";
import { buttonClass } from "@/components/ui/button";
import { ScopeTag } from "@/components/ui/scope-tag";

/** The day's highest-scoring deal, given the most room on the home page. */
export async function FeaturedDeal({ card }: { card: ProductCardData }) {
  const { t, money, href } = await getI18n();
  const compare = [
    { label: t.product.bestLocal, value: card.bestLocalLandedMinor },
    { label: t.product.bestGlobal, value: card.bestGlobalLandedMinor },
  ];

  return (
    <Link
      href={href(`/product/${card.slug}`)}
      className="group grid overflow-hidden rounded-3xl border border-line bg-surface transition-shadow hover:shadow-card md:grid-cols-[2fr_3fr]"
    >
      <div className="relative aspect-[4/3] md:aspect-auto md:min-h-72">
        <ProductImage imageUrl={card.imageUrl} title={card.title} category={card.categorySlug} />
        <span className="absolute left-4 top-4 rounded-full bg-deal px-3 py-1 text-base font-bold text-on-deal">
          −{card.discountPct}%
        </span>
      </div>

      <div className="flex flex-col gap-4 p-6 md:p-8">
        <p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-deal">
          <Flame className="size-4" aria-hidden />
          {t.home.dealOfDay}
        </p>
        <div>
          {card.brand && <p className="text-xs font-semibold uppercase tracking-wide text-muted">{card.brand}</p>}
          <h3 className="mt-1 text-2xl font-bold tracking-tight group-hover:underline">{card.title}</h3>
        </div>

        <div>
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="text-4xl font-extrabold tracking-tight">{money(card.landedMinor)}</span>
            {card.usualLandedMinor !== null && (
              <span className="text-lg text-muted line-through">{money(card.usualLandedMinor)}</span>
            )}
          </div>
          {!card.verified && <p className="mt-1 text-sm text-muted">{t.deal.storeClaim}</p>}
          <p className="mt-1 text-sm text-muted">
            {t.deal.totalHint}
            {card.savingsMinor !== null && (
              <span className="font-semibold text-deal"> · {fmt(t.deal.save, { amount: money(card.savingsMinor) })}</span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
          <ScopeTag scope={card.scope} label={card.scope === "local" ? t.deal.local : t.deal.global} />
          <span className="flex items-center gap-1.5">
            <Store className="size-4" aria-hidden />
            {card.supplierName}
          </span>
          <span className="flex items-center gap-1.5">
            <Truck className="size-4" aria-hidden />
            {fmt(t.deal.deliveryDays, { days: card.deliveryMaxDays })}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
          {compare.map((row) => (
            <div key={row.label}>
              <dt className="text-muted">{row.label}</dt>
              <dd className="mt-0.5 font-bold tabular-nums">{row.value !== null ? money(row.value) : "—"}</dd>
            </div>
          ))}
        </dl>

        <span className={buttonClass({}, "mt-auto self-start")}>
          {t.deal.view}
          <ArrowRight className="size-4" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
