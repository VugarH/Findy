"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { isCurrencyCode } from "@/config/currencies";
import { useI18n } from "@/i18n/client";
import { deleteOfferAction } from "@/modules/admin/actions/products";
import type { AdminOffer } from "@/modules/admin/products";
import { useAdminT } from "./admin-i18n";
import { HiddenFields, SubmitButton } from "./fields";
import { OfferForm, Reveal, type StoreChoice } from "./product-forms";
import { Badge, EmptyState } from "./ui";

/** A product's offers: every store that lists it, with the hand-entered ones editable. */
export function OfferList({
  productId,
  offers,
  stores,
  dates,
}: {
  productId: string;
  offers: AdminOffer[];
  stores: StoreChoice[];
  dates: Record<string, string>;
}) {
  const t = useAdminT();
  const { href, money } = useI18n();
  const d = t.products.detail;
  const price = (minor: number, currency: string) =>
    isCurrencyCode(currency) ? money(minor, currency) : `${minor / 100} ${currency}`;

  return (
    <div>
      {offers.length === 0 ? (
        <EmptyState>{d.noOffers}</EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {offers.map((offer) => (
            <li key={offer.id} className="px-5 py-3">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link href={href(`/admin/stores/${offer.supplierId}`)} className="font-semibold hover:underline">
                      {offer.supplierName}
                    </Link>
                    {offer.manual && <Badge tone="info">{d.byHand}</Badge>}
                    {!offer.live && <Badge>{d.expired}</Badge>}
                    {!offer.supplierActive && <Badge tone="bad">{d.storeOff}</Badge>}
                    {!offer.inStock && <Badge>{d.outOfStock}</Badge>}
                  </div>
                  <a
                    href={offer.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-0.5 flex max-w-xl items-center gap-1 truncate text-xs text-muted hover:underline"
                  >
                    <span className="truncate">{offer.title}</span>
                    <ExternalLink className="size-3 shrink-0" aria-hidden />
                  </a>
                </div>
                <div className="text-right">
                  <p className="font-bold tabular-nums">{price(offer.priceMinor, offer.currency)}</p>
                  {offer.listPriceMinor && (
                    <p className="text-xs text-muted line-through">{price(offer.listPriceMinor, offer.currency)}</p>
                  )}
                  <p className="text-xs text-muted">
                    {d.lastSeen}: {dates[offer.id]}
                  </p>
                </div>
              </div>
              {offer.manual && (
                <div className="mt-2 flex flex-wrap items-start gap-3">
                  <Reveal label={d.editOffer} variant="link">
                    {(close) => <OfferForm productId={productId} stores={stores} offer={offer} onDone={close} />}
                  </Reveal>
                  <form action={deleteOfferAction}>
                    <HiddenFields values={{ productId, offerId: offer.id }} />
                    <SubmitButton
                      variant="ghost"
                      size="sm"
                      confirm={d.deleteConfirm}
                      className="h-auto px-0 text-xs font-semibold text-deal hover:bg-transparent hover:underline"
                    >
                      {d.deleteOffer}
                    </SubmitButton>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="border-t border-line px-5 py-4">
        <Reveal label={d.addOffer}>
          {(close) => <OfferForm productId={productId} stores={stores} onDone={close} />}
        </Reveal>
        <p className="mt-2 text-xs text-muted">{d.offerHint}</p>
      </div>
    </div>
  );
}
