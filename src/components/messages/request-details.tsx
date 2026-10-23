import Link from "next/link";
import { ArrowUpRight, Package } from "lucide-react";
import type { ConversationDetails } from "@/db/schema";
import { fmt } from "@/i18n/format";

interface Props {
  details: ConversationDetails;
  money: (amountMinor: number) => string;
  /** Our product page for a slug. */
  productHref: (slug: string) => string;
  labels: {
    title: string;
    /** "From {store}" / "Parcel from {store}". */
    parcelFrom: string;
    estimatedTotal: string;
    /** Left out to hide the service fee. */
    fee?: string;
    note?: string;
  };
}

/** The items attached to a request, parcel by parcel, as priced when it was sent. */
export function RequestDetails({ details, money, productHref, labels }: Props) {
  return (
    <section className="rounded-2xl border border-global/30 bg-global-soft p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-sm font-bold text-global">
        <Package className="size-4" aria-hidden />
        {labels.title}
      </h2>
      <div className="mt-3 space-y-3">
        {details.parcels.map((parcel) => (
          <div key={parcel.store} className="rounded-xl border border-line bg-surface p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <a href={parcel.storeUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold hover:underline">
                {fmt(labels.parcelFrom, { store: parcel.store })}
              </a>
              <span className="text-sm font-bold tabular-nums">{money(parcel.totalMinor)}</span>
            </div>
            <ul className="mt-2 space-y-1.5">
              {parcel.lines.map((line) => (
                <li key={line.url} className="flex items-start gap-2 text-sm">
                  <span className="shrink-0 tabular-nums text-muted">{line.quantity} ×</span>
                  <Link href={productHref(line.slug)} className="min-w-0 flex-1 hover:underline">
                    {line.title}
                  </Link>
                  <a
                    href={line.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={parcel.store}
                    title={line.url}
                    className="shrink-0 text-muted hover:text-ink"
                  >
                    <ArrowUpRight className="size-4" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between gap-4 font-bold">
          <dt>{labels.estimatedTotal}</dt>
          <dd className="tabular-nums">{money(details.totalMinor)}</dd>
        </div>
        {labels.fee && (
          <div className="flex justify-between gap-4 text-muted">
            <dt>{labels.fee}</dt>
            <dd className="tabular-nums">{money(details.feeMinor)}</dd>
          </div>
        )}
      </dl>
      {labels.note && <p className="mt-2 text-xs text-muted">{labels.note}</p>}
    </section>
  );
}
