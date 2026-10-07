import Link from "next/link";
import { ArrowRight, Handshake } from "lucide-react";
import type { OfferView } from "@/modules/catalog/offer-view";
import { fmt } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { estimateAssistedOrder } from "@/modules/orders/pricing";
import { buttonClass } from "@/components/ui/button";

/**
 * Shown on a product page next to an offer from abroad: the offer that we
 * can buy and ship on the person's behalf, with what that would cost.
 */
export async function AssistCard({ offer, productSlug }: { offer: OfferView; productSlug: string }) {
  const { t, money, href, market } = await getI18n();
  if (!market.assistedOrder.enabled || offer.supplier.scope !== "global" || !offer.inStock) return null;

  const estimate = estimateAssistedOrder(offer.costInput, market, 1);

  return (
    <section className="rounded-2xl border border-global/30 bg-global-soft p-5">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1 basis-72">
          <p className="flex items-center gap-2 text-sm font-bold text-global">
            <Handshake className="size-4" aria-hidden />
            {t.order.badge}
          </p>
          <h2 className="mt-2 text-lg font-bold text-ink">{t.order.cardTitle}</h2>
          <p className="mt-1.5 text-sm leading-6 text-ink/80">{fmt(t.order.cardText, { store: offer.supplier.name })}</p>
          <Link
            href={href("/ordering-abroad")}
            className="mt-2 inline-block text-sm font-semibold text-global hover:underline"
          >
            {t.order.howLink}
          </Link>
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          <p className="text-lg font-extrabold tracking-tight text-ink">
            {fmt(t.order.cardEstimate, { total: money(estimate.totalMinor) })}
          </p>
          <p className="-mt-1.5 text-xs text-ink/70">{fmt(t.order.cardFee, { fee: money(estimate.feeMinor) })}</p>
          <Link
            href={`${href(`/product/${productSlug}/order`)}?offer=${offer.offerId}`}
            className={buttonClass({}, "bg-global text-surface hover:bg-global hover:opacity-90")}
          >
            {t.order.cardCta}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
