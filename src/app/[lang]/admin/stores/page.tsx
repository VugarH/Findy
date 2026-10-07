import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { CATEGORIES, isCategorySlug } from "@/config/categories";
import { fmt } from "@/i18n/format";
import { setStoreActiveAction } from "@/modules/admin/actions/stores";
import { param, type SearchParams } from "@/modules/admin/forms";
import { getAdminI18n } from "@/modules/admin/i18n";
import { listAdminStores, STORE_STATUSES, type StoreStatus } from "@/modules/admin/stores";
import { StoreStatusBadge } from "@/components/admin/status-badges";
import { ActionButton } from "@/components/admin/action-button";
import { Badge, EmptyState, FilterBar, filterControl, PageHeader, Panel, Table, Td, Th } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const { a } = await getAdminI18n();
  return { title: a.nav.stores };
}

export default async function AdminStoresPage({ searchParams }: PageProps<"/[lang]/admin/stores">) {
  const params: SearchParams = await searchParams;
  const { a, t, href, dateTime, num } = await getAdminI18n();

  const status = param(params, "status");
  const source = param(params, "source");
  const category = param(params, "category");
  const q = param(params, "q");
  const stores = await listAdminStores({
    q: q || undefined,
    status: (STORE_STATUSES as readonly string[]).includes(status) ? (status as StoreStatus) : undefined,
    source: source === "code" || source === "admin" ? source : undefined,
    category: isCategorySlug(category) ? category : undefined,
  });
  const filtered = !!(q || status || source || category);

  return (
    <>
      <PageHeader
        title={a.nav.stores}
        intro={a.stores.intro}
        actions={
          <ButtonLink href={href("/admin/stores/new")} size="sm" className="rounded-lg">
            <Plus className="size-4" aria-hidden />
            {a.stores.add}
          </ButtonLink>
        }
      />

      <FilterBar
        action={href("/admin/stores")}
        resetHref={filtered ? href("/admin/stores") : undefined}
        labels={{ filter: a.common.filter, reset: a.common.reset }}
      >
        <input
          name="q"
          defaultValue={q}
          placeholder={a.stores.searchPlaceholder}
          aria-label={a.common.search}
          className={`${filterControl} w-56`}
        />
        <select name="status" defaultValue={status} aria-label={a.stores.status} className={filterControl}>
          <option value="">
            {a.stores.status}: {a.common.all}
          </option>
          {STORE_STATUSES.map((value) => (
            <option key={value} value={value}>
              {a.stores.statuses[value]}
            </option>
          ))}
        </select>
        <select name="source" defaultValue={source} aria-label={a.stores.source} className={filterControl}>
          <option value="">
            {a.stores.source}: {a.common.all}
          </option>
          <option value="code">{a.stores.sources.code}</option>
          <option value="admin">{a.stores.sources.admin}</option>
        </select>
        <select name="category" defaultValue={category} aria-label={a.products.category} className={filterControl}>
          <option value="">{a.stores.anyCategory}</option>
          {CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {t.categories[c.slug].name}
            </option>
          ))}
        </select>
      </FilterBar>

      <Panel flush title={fmt(a.common.total, { count: stores.length })}>
        {stores.length === 0 ? (
          <EmptyState>{a.common.noResults}</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{a.stores.columns.store}</Th>
                <Th>{a.stores.columns.connection}</Th>
                <Th>{a.stores.columns.status}</Th>
                <Th>{a.stores.columns.collected}</Th>
                <Th className="text-right">{a.stores.columns.offers}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {stores.map((store) => (
                <tr key={store.id} className="hover:bg-surface-2/50">
                  <Td>
                    <Link href={href(`/admin/stores/${store.id}`)} className="font-semibold hover:underline">
                      {store.name}
                    </Link>
                    <p className="text-xs text-muted">
                      {store.id} · {store.originCountry} · {store.currency}
                      {store.source === "admin" && (
                        <>
                          {" "}
                          · <Badge tone="info">{a.stores.sources.admin}</Badge>
                        </>
                      )}
                    </p>
                  </Td>
                  <Td className="whitespace-nowrap text-muted">
                    {a.stores.connections[store.connection as keyof typeof a.stores.connections] ?? store.connection}
                  </Td>
                  <Td>
                    <StoreStatusBadge status={store.status} labels={a.stores.statuses} />
                  </Td>
                  <Td className="max-w-72">
                    <span className="whitespace-nowrap">
                      {store.lastSuccessAt ? dateTime(store.lastSuccessAt) : a.common.never}
                    </span>
                    {store.status === "failing" && store.lastError && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-deal">{store.lastError}</p>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">
                    {fmt(a.stores.offersLine, { live: num(store.liveOffers), total: num(store.offers) })}
                  </Td>
                  <Td className="text-right">
                    <ActionButton
                      action={setStoreActiveAction}
                      fields={{ id: store.id, active: String(!store.active) }}
                      variant={store.active ? "ghost" : "secondary"}
                    >
                      {store.active ? a.common.switchOff : a.common.switchOn}
                    </ActionButton>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </>
  );
}
