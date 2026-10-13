import type { Metadata } from "next";
import Link from "next/link";
import { pageParam, param } from "@/modules/admin/forms";
import { getAdminI18n } from "@/modules/admin/i18n";
import { isLogLevel, listLogAreas, listLogs, LOG_LEVELS, LOG_RETENTION_DAYS, LOGS_PAGE_SIZE } from "@/modules/logs/service";
import { fmt } from "@/i18n/format";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { Badge, EmptyState, FilterBar, filterControl, PageHeader, Panel } from "@/components/admin/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { a } = await getAdminI18n();
  return { title: a.nav.logs };
}

const TONE = { error: "bad", warn: "info", info: "neutral" } as const;

/** What happened on the site and in the jobs, newest first. */
export default async function AdminLogsPage({ searchParams }: PageProps<"/[lang]/admin/logs">) {
  const params = await searchParams;
  const { a, t, href, dateTime } = await getAdminI18n();
  const l = a.logs;
  const levelParam = param(params, "level");
  const filters = {
    level: isLogLevel(levelParam) ? levelParam : undefined,
    area: param(params, "area") || undefined,
    query: param(params, "q") || undefined,
  };
  const page = pageParam(params);
  const [{ rows, total }, areas] = await Promise.all([listLogs(filters, page), listLogAreas()]);
  const path = href("/admin/logs");
  const filtered = Boolean(filters.level || filters.area || filters.query);

  return (
    <>
      <PageHeader
        title={a.nav.logs}
        intro={fmt(l.intro, { info: LOG_RETENTION_DAYS.info, problems: LOG_RETENTION_DAYS.problems })}
      />

      <FilterBar action={path} resetHref={filtered ? path : undefined} labels={{ filter: a.common.filter, reset: a.common.reset }}>
        <input
          name="q"
          defaultValue={filters.query}
          placeholder={l.searchPlaceholder}
          aria-label={a.common.search}
          className={`${filterControl} w-64`}
        />
        <select name="level" defaultValue={filters.level ?? ""} aria-label={l.level} className={filterControl}>
          <option value="">{l.anyLevel}</option>
          {LOG_LEVELS.map((level) => (
            <option key={level} value={level}>
              {l.levels[level]}
            </option>
          ))}
        </select>
        <select name="area" defaultValue={filters.area ?? ""} aria-label={l.area} className={filterControl}>
          <option value="">{l.anyArea}</option>
          {areas.map((area) => (
            <option key={area} value={area}>
              {area}
            </option>
          ))}
        </select>
      </FilterBar>

      <Panel flush>
        {rows.length === 0 ? (
          <EmptyState>{l.empty}</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((row) => {
              const hasDetails = Object.keys(row.context).length > 0;
              const summary = (
                <span className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="w-36 shrink-0 text-xs tabular-nums text-muted">{dateTime(row.createdAt)}</span>
                  <Badge tone={TONE[row.level]}>{l.levels[row.level]}</Badge>
                  <span className="font-mono text-xs text-muted">
                    {row.area}/{row.event}
                  </span>
                  <span className="min-w-0 flex-1 basis-64 break-words text-sm">{row.message}</span>
                  {row.userEmail && row.userId && (
                    <Link
                      href={`${href("/admin/users")}?q=${encodeURIComponent(row.userEmail)}`}
                      className="text-xs text-muted hover:text-ink hover:underline"
                    >
                      {row.userEmail}
                    </Link>
                  )}
                </span>
              );
              return (
                <li key={row.id} className="px-5 py-2.5">
                  {hasDetails ? (
                    <details className="group">
                      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">{summary}</summary>
                      <pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-surface-2 p-3 text-xs leading-5">
                        {JSON.stringify(row.context, null, 2)}
                      </pre>
                    </details>
                  ) : (
                    summary
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <AdminPagination
        path={path}
        filters={{ level: filters.level ?? "", area: filters.area ?? "", q: filters.query ?? "" }}
        page={page}
        pageSize={LOGS_PAGE_SIZE}
        total={total}
        t={t}
      />
    </>
  );
}
