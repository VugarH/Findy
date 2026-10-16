import { ArrowUpRight } from "lucide-react";
import type { OfferView } from "@/modules/catalog/offer-view";
import { getI18n } from "@/i18n/server";

/**
 * One quiet line for the side that is not the best offer: the best local price
 * when the best is from abroad, or the other way round — or that there is none.
 */
export async function OtherSideLine({ title, offer, emptyText }: { title: string; offer: OfferView | null; emptyText: string }) {
  const { money } = await getI18n();
  if (!offer) return <p className="px-1 text-sm text-muted">{emptyText}</p>;
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-sm">
      <span className="text-muted">{title}:</span>
      <span className="font-semibold tabular-nums">{money(offer.landed.totalMinor)}</span>
      <span className="text-muted">· {offer.supplier.name}</span>
      <a
        href={`/go/${offer.offerId}`}
        target="_blank"
        rel="nofollow sponsored noopener"
        aria-label={offer.supplier.name}
        className="inline-flex items-center text-brand-strong hover:underline"
      >
        <ArrowUpRight className="size-4" aria-hidden />
      </a>
    </p>
  );
}
