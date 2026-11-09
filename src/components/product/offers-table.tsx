import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { OfferView } from "@/modules/catalog/offer-view";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/format";
import { CartButton } from "@/components/cart/cart-button";
import { ScopeTag } from "@/components/ui/scope-tag";
import { scopeLabel } from "@/i18n/scope-label";

export async function OffersTable({ offers }: { offers: OfferView[] }) {
  const { t, money, href } = await getI18n();

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b border-line text-left text-xs text-muted">
          <tr>
            <th className="px-4 py-3 font-semibold">{t.product.store}</th>
            <th className="px-4 py-3 text-right font-semibold">{t.product.storePrice}</th>
            <th className="px-4 py-3 text-right font-semibold">{t.product.totalPrice}</th>
            <th className="px-4 py-3 font-semibold">{t.product.delivery}</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {offers.map((offer) => (
            <tr key={offer.offerId} className="border-b border-line last:border-0">
              <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={href(`/deals?store=${encodeURIComponent(offer.supplier.id)}`)}
                    className="font-semibold text-ink hover:text-brand-strong hover:underline underline-offset-2"
                  >
                    {offer.supplier.name}
                  </Link>
                  <ScopeTag
                    scope={offer.supplier.scope}
                    label={scopeLabel(t, offer.supplier.scope, offer.supplier.originCountry)}
                  />
                </div>
                <p className="mt-0.5 max-w-xs truncate text-xs text-muted">{offer.title}</p>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-muted">
                {offer.listPriceMinor !== null && offer.listPriceMinor > offer.priceMinor && (
                  <span className="block text-xs line-through">{money(offer.listPriceMinor, offer.currency)}</span>
                )}
                {money(offer.priceMinor, offer.currency)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums text-ink">{money(offer.landed.totalMinor)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-muted">{fmt(t.product.deliveryRange, offer.delivery)}</td>
              <td className="px-4 py-3 text-right">
                {offer.inStock ? (
                  <div className="flex flex-col items-end gap-1.5">
                    <a
                      href={`/go/${offer.offerId}`}
                      target="_blank"
                      rel="nofollow sponsored noopener"
                      className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-brand-strong hover:underline"
                    >
                      {t.product.goToStore}
                      <ArrowUpRight className="size-4" aria-hidden />
                    </a>
                    <CartButton offerId={offer.offerId} variant="text" />
                  </div>
                ) : (
                  <span className="whitespace-nowrap text-muted">{t.product.outOfStock}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
