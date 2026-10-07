import type { Metadata } from "next";
import Link from "next/link";
import { fmt } from "@/i18n/format";
import { pageParam } from "@/modules/admin/forms";
import { getAdminI18n } from "@/modules/admin/i18n";
import { listRuns, RUN_PAGE_SIZE } from "@/modules/admin/runs";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { RunStatusBadge } from "@/components/admin/status-badges";
import { EmptyState, PageHeader, Panel } from "@/components/admin/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { a } = await getAdminI18n();
  return { title: a.nav.runs };
}

export default async function AdminRunsPage({ searchParams }: PageProps<"/[lang]/admin/runs">) {
  const page = pageParam(await searchParams);
  const { a, t, href, dateTime, num } = await getAdminI18n();
  const { runs, total, storeNames } = await listRuns(page);
  const r = a.runs;

  return (
    <>
      <PageHeader title={a.nav.runs} intro={r.intro} />
      <Panel flush>
        {runs.length === 0 ? (
          <EmptyState>{r.empty}</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {runs.map((run) => {
              const failed = run.stats?.suppliers.filter((s) => !s.ok) ?? [];
              const minutes = run.finishedAt
                ? Math.max(1, Math.round((run.finishedAt.getTime() - run.startedAt.getTime()) / 60_000))
                : null;
              return (
                <li key={run.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                    <RunStatusBadge status={run.status} labels={r.statuses} />
                    <span className="font-semibold">{dateTime(run.startedAt)}</span>
                    {minutes !== null && (
                      <span className="text-muted">
                        {r.duration}: {fmt(r.minutes, { count: minutes })}
                      </span>
                    )}
                    <span className="text-muted">
                      {r.stores}: {fmt(r.storesLine, { ok: run.storesOk, failed: run.storesFailed })}
                    </span>
                    <span className="text-muted">
                      {r.offers}: {num(run.offers)}
                    </span>
                    {run.stats && (
                      <span className="text-muted">
                        {r.deals}: {num(run.stats.deals)}
                      </span>
                    )}
                  </div>
                  {run.stats?.digest && (
                    <p className={run.stats.digest.error ? "mt-1 text-xs text-deal" : "mt-1 text-xs text-muted"}>
                      {run.stats.digest.error
                        ? fmt(r.digestFailed, { error: run.stats.digest.error })
                        : fmt(run.stats.digest.posted ? r.digestPosted : r.digestPicked, {
                            count: run.stats.digest.items,
                          })}
                    </p>
                  )}
                  {run.stats?.fxError && (
                    <p className="mt-1 text-xs text-deal">{fmt(r.fxError, { error: run.stats.fxError })}</p>
                  )}
                  {failed.length > 0 && (
                    <details className="mt-2 text-sm">
                      <summary className="cursor-pointer text-xs font-semibold text-muted">
                        {r.failedStores} ({failed.length})
                      </summary>
                      <ul className="mt-2 space-y-1">
                        {failed.map((stat) => (
                          <li key={stat.supplierId} className="text-xs">
                            <Link
                              href={href(`/admin/stores/${stat.supplierId}`)}
                              className="font-semibold hover:underline"
                            >
                              {storeNames.get(stat.supplierId) ?? stat.supplierId}
                            </Link>{" "}
                            <span className="text-deal">{stat.error}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      <AdminPagination
        path={href("/admin/runs")}
        filters={{}}
        page={page}
        pageSize={RUN_PAGE_SIZE}
        total={total}
        t={t}
      />
    </>
  );
}
