import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { LOCALE_TAGS } from "@/i18n/config";
import { fmt } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { listSuppliers, type SupplierOverview } from "@/modules/suppliers/queries";
import { FollowButton } from "@/components/follows/follow-button";
import { Container } from "@/components/ui/container";
import { ScopeTag } from "@/components/ui/scope-tag";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.stores.title, description: t.stores.subtitle };
}

export default async function StoresPage() {
  const { t, locale } = await getI18n();
  const stores = await listSuppliers();
  const groups = [
    { title: t.stores.local, stores: stores.filter((s) => s.scope === "local") },
    { title: t.stores.global, stores: stores.filter((s) => s.scope === "global") },
  ].filter((group) => group.stores.length > 0);

  const time = new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Baku",
  });

  const card = (store: SupplierOverview) => (
    <li key={store.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-bold">{store.name}</h3>
        <ScopeTag scope={store.scope} label={store.scope === "local" ? t.deal.local : t.deal.global} />
      </div>
      {store.scope === "global" && (
        <p className="text-xs font-medium text-muted">
          {store.accessMethod?.reliability?.basis === "established-retailer" ? t.stores.retailer : t.stores.official}
          {" · "}
          {store.accessMethod?.shipsToMarket ? t.stores.shipsDirect : t.stores.forwarder}
        </p>
      )}
      <p className="text-sm text-muted">
        {fmt(t.stores.offers, { count: store.offerCount.toLocaleString(LOCALE_TAGS[locale]) })}
        {store.lastSuccessAt && (
          <>
            <br />
            {fmt(t.stores.lastChecked, { time: time.format(store.lastSuccessAt) })}
          </>
        )}
      </p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        <a
          href={store.websiteUrl}
          target="_blank"
          rel="noopener"
          className="inline-flex min-w-0 items-center gap-1 text-sm font-semibold text-brand-strong hover:underline"
        >
          <span className="truncate">{new URL(store.websiteUrl).hostname}</span>
          <ArrowUpRight className="size-4 shrink-0" aria-hidden />
        </a>
        <FollowButton kind="store" value={store.id} name={store.name} />
      </div>
    </li>
  );

  return (
    <Container className="py-8">
      <h1 className="text-3xl font-extrabold tracking-tight">{t.stores.title}</h1>
      <p className="mt-1 max-w-2xl text-muted">{t.stores.subtitle}</p>

      {groups.length === 0 && (
        <p className="mt-8 rounded-2xl border border-dashed border-line px-6 py-12 text-center text-muted">
          {t.stores.empty}
        </p>
      )}
      {groups.map((group) => (
        <section key={group.title} className="mt-8">
          <h2 className="mb-4 text-xl font-bold">
            {group.title}{" "}
            <span className="text-base font-normal text-muted">· {fmt(t.stores.count, { count: group.stores.length })}</span>
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{group.stores.map(card)}</ul>
        </section>
      ))}
    </Container>
  );
}
