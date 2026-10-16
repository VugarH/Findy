import { ArrowUpRight, ShieldCheck, Truck } from "lucide-react";
import type { OfferView } from "@/modules/catalog/offer-view";
import { priceBeforeDiscount } from "@/modules/catalog/summary";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/format";
import { CartButton } from "@/components/cart/cart-button";
import { buttonClass } from "@/components/ui/button";
import { ScopeTag } from "@/components/ui/scope-tag";

/** The best offer for a product, with the full cost breakdown and the way to the store. */
export async function OfferPanel({ title, offer }: { title: string; offer: OfferView }) {
  const { t, money, market } = await getI18n();

  const { landed, supplier } = offer;
  const before = priceBeforeDiscount(offer, market);
  const storeDiscounted = offer.listPriceMinor !== null && offer.listPriceMinor > offer.priceMinor;
  const lines = [
    { label: t.product.item, value: landed.itemMinor, always: true },
    { label: landed.shippingEstimated ? t.product.shippingEstimated : t.product.shipping, value: landed.shippingMinor, always: true },
    { label: t.product.duty, value: landed.dutyMinor },
    { label: t.product.vat, value: landed.vatMinor },
    { label: t.product.fee, value: landed.feeMinor },
  ].filter((line) => line.always || line.value > 0);

  return (
    <section className="flex flex-col rounded-2xl border border-brand bg-surface p-5 shadow-card ring-1 ring-brand">
      <h2 className="text-sm font-semibold text-muted">{title}</h2>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-3xl font-extrabold tracking-tight text-ink">{money(landed.totalMinor)}</p>
        {before && (
          <>
            <span className="text-lg font-medium tabular-nums text-muted line-through">{money(before.wasMinor)}</span>
            <span className="rounded-md bg-deal px-2 py-0.5 text-sm font-bold text-on-deal">−{before.discountPct}%</span>
          </>
        )}
      </div>
      {before && (
        <p className="mt-1 text-xs text-muted">
          {before.verified ? t.product.wasUsual : fmt(t.product.wasStore, { store: supplier.name })}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
        <span className="font-semibold text-ink">{supplier.name}</span>
        <ScopeTag scope={supplier.scope} label={supplier.scope === "local" ? t.deal.local : t.deal.global} />
        <span className="flex items-center gap-1 text-muted">
          <ShieldCheck className="size-4" aria-hidden />
          {t.product.trust} {supplier.trustScore}/100
        </span>
        <span className="flex items-center gap-1 text-muted">
          <Truck className="size-4" aria-hidden />
          {fmt(t.product.deliveryRange, offer.delivery)}
        </span>
      </div>

      <dl className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">{fmt(t.product.storePriceAt, { store: supplier.name })}</dt>
          <dd className="flex items-baseline gap-2 tabular-nums">
            {storeDiscounted && (
              <span className="text-xs text-muted line-through">{money(offer.listPriceMinor!, offer.currency)}</span>
            )}
            <span className="font-semibold text-ink">{money(offer.priceMinor, offer.currency)}</span>
          </dd>
        </div>
        {lines.map((line) => (
          <div key={line.label} className="flex justify-between gap-4">
            <dt className="text-muted">{line.label}</dt>
            <dd className="tabular-nums text-ink">{money(line.value)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 border-t border-line pt-2 font-bold">
          <dt>{t.product.total}</dt>
          <dd className="tabular-nums">{money(landed.totalMinor)}</dd>
        </div>
      </dl>

      <a
        href={`/go/${offer.offerId}`}
        target="_blank"
        rel="nofollow sponsored noopener"
        className={buttonClass({}, "mt-5 w-full")}
      >
        {t.product.goToStore}
        <ArrowUpRight className="size-4" aria-hidden />
      </a>
      <CartButton offerId={offer.offerId} variant="button" className="mt-2 w-full" />
    </section>
  );
}
