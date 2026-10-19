import type { Metadata } from "next";
import Link from "next/link";
import { fmt } from "@/i18n/format";
import { pageParam } from "@/modules/admin/forms";
import { getAdminI18n } from "@/modules/admin/i18n";
import { jobsConfigured, recentJobRuns, type JobRunState } from "@/modules/admin/jobs";
import { listRuns, RUN_PAGE_SIZE } from "@/modules/admin/runs";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { RunStatusBadge } from "@/components/admin/status-badges";
import { JobRunner } from "@/components/admin/job-runner";
import { Badge, EmptyState, PageHeader, Panel, type BadgeTone } from "@/components/admin/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { a } = await getAdminI18n();
  return { title: a.nav.runs };
}

const JOB_TONES: Record<JobRunState, BadgeTone> = { queued: "neutral", running: "info", success: "good", failure: "bad", cancelled: "neutral" };

export default async function AdminRunsPage({ searchParams }: PageProps<"/[lang]/admin/runs">) {
  const page = pageParam(await searchParams);
  const { a, t, href, dateTime, num } = await getAdminI18n();
  const [{ runs, total, storeNames }, dailyRuns, followRuns] = await Promise.all([
    listRuns(page),
    recentJobRuns("daily"),
    recentJobRuns("follows"),
  ]);
  const r = a.runs;
  const j = r.jobs;
  const configured = jobsConfigured();
  const jobs = [
    { name: "daily" as const, title: j.dailyTitle, text: j.dailyText, runs: dailyRuns, withStores: true },
    { name: "follows" as const, title: j.followsTitle, text: j.followsText, runs: followRuns, withStores: false },
  ];

  return (
    <>
      <PageHeader title={a.nav.runs} intro={r.intro} />

      <Panel title={j.title} className="mb-6">
        <p className="mb-4 max-w-3xl text-sm text-muted">{configured ? j.intro : j.notConfigured}</p>
        <div className="grid gap-6 lg:grid-cols-2">
          {jobs.map((job) => (
            <section key={job.name} className="min-w-0 space-y-3">
              <div>
                <h3 className="font-bold">{job.title}</h3>
                <p className="mt-0.5 text-sm text-muted">{job.text}</p>
              </div>
              {configured && <JobRunner job={job.name} withStores={job.withStores} />}
              {configured && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{j.recent}</p>
                  {job.runs.length === 0 ? (
                    <p className="text-sm text-muted">{j.none}</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {job.runs.map((run) => (
                        <li key={run.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                          <Badge tone={JOB_TONES[run.state]}>{j.states[run.state]}</Badge>
                          <span>{dateTime(run.startedAt)}</span>
                          <span className="text-xs text-muted">{run.trigger === "schedule" ? j.scheduled : j.manual}</span>
                          <a href={run.url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-brand-strong hover:underline">
                            {j.open}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>
          ))}
        </div>
      </Panel>
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
