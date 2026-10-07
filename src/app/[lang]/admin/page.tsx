import Link from "next/link";
import { fmt } from "@/i18n/format";
import { getDashboard } from "@/modules/admin/dashboard";
import { getAdminI18n } from "@/modules/admin/i18n";
import { ActivityList } from "@/components/admin/activity-list";
import { RunStatusBadge, StoreStatusBadge } from "@/components/admin/status-badges";
import { EmptyState, PageHeader, Panel, StatCard } from "@/components/admin/ui";

export default async function AdminDashboardPage() {
  const i18n = await getAdminI18n();
  const { a, href, dateTime, num: number } = i18n;
  const d = await getDashboard();

  return (
    <>
      <PageHeader title={a.nav.dashboard} intro={a.dashboard.intro} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label={a.dashboard.liveProducts}
          value={number(d.products.live)}
          line={fmt(a.dashboard.productsLine, { off: d.products.off, manual: d.products.manual })}
          href={href("/admin/products?live=1")}
        />
        <StatCard
          label={a.dashboard.deals}
          value={number(d.deals.total)}
          line={fmt(a.dashboard.dealsLine, { verified: number(d.deals.verified) })}
        />
        <StatCard
          label={a.dashboard.stores}
          value={`${d.stores.ok}/${d.stores.total}`}
          line={fmt(a.dashboard.storesLine, {
            failing: d.stores.failing,
            off: d.stores.off,
            waiting: d.stores.waiting,
          })}
          href={href("/admin/stores")}
          tone={d.stores.failing > 0 ? "warn" : undefined}
        />
        <StatCard
          label={a.dashboard.newOrders}
          value={d.newOrders}
          href={href("/admin/orders?status=new")}
          tone={d.newOrders > 0 ? "warn" : undefined}
        />
        <StatCard
          label={a.dashboard.unsorted}
          value={number(d.products.unsorted)}
          line={a.dashboard.unsortedLine}
          href={href("/admin/categories")}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel
          title={a.dashboard.failingStores}
          flush
          actions={
            <Link
              href={href("/admin/stores?status=failing")}
              className="text-xs font-semibold text-brand-strong hover:underline"
            >
              {a.common.seeAll}
            </Link>
          }
        >
          {d.failingStores.length === 0 ? (
            <EmptyState>{a.dashboard.noFailing}</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {d.failingStores.slice(0, 6).map((store) => (
                <li key={store.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={href(`/admin/stores/${store.id}`)}
                      className="truncate text-sm font-semibold hover:underline"
                    >
                      {store.name}
                    </Link>
                    <span className="shrink-0 text-xs text-muted">{dateTime(store.lastErrorAt)}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-deal">{store.lastError}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title={a.dashboard.lastRun}
          actions={
            <Link href={href("/admin/runs")} className="text-xs font-semibold text-brand-strong hover:underline">
              {a.common.seeAll}
            </Link>
          }
        >
          {d.lastRun ? (
            <div className="space-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <RunStatusBadge status={d.lastRun.status} labels={a.runs.statuses} />
                <span className="text-muted">{dateTime(d.lastRun.startedAt)}</span>
              </div>
              <p>
                {fmt(a.runs.storesLine, { ok: d.lastRun.storesOk, failed: d.lastRun.storesFailed })} · {a.runs.offers}:{" "}
                {number(d.lastRun.offers)}
                {d.lastRun.stats ? ` · ${a.runs.deals}: ${number(d.lastRun.stats.deals)}` : ""}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted">{a.dashboard.noRuns}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
            {(["ok", "failing", "waiting", "off"] as const).map((status) => (
              <Link
                key={status}
                href={href(`/admin/stores?status=${status}`)}
                className="flex items-center gap-1.5 text-sm"
              >
                <StoreStatusBadge status={status} labels={a.stores.statuses} />
                <span className="tabular-nums text-muted">{d.stores[status]}</span>
              </Link>
            ))}
          </div>
        </Panel>
      </div>

      <Panel
        title={a.dashboard.recent}
        flush
        className="mt-6"
        actions={
          <Link href={href("/admin/activity")} className="text-xs font-semibold text-brand-strong hover:underline">
            {a.common.seeAll}
          </Link>
        }
      >
        <ActivityList events={d.recent} i18n={i18n} publishedAt={d.unpublished.publishedAt} />
      </Panel>
    </>
  );
}
