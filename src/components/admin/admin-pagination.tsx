import { fmt } from "@/i18n/format";
import type { Dictionary } from "@/i18n/dictionaries";
import { queryString } from "@/modules/admin/forms";
import { Pagination } from "@/components/deals/pagination";

/** The site's pagination for an admin list: keeps the list's filters in every page link. */
export function AdminPagination({
  path,
  filters,
  page,
  pageSize,
  total,
  t,
}: {
  /** The list's locale-prefixed path. */
  path: string;
  filters: Record<string, string>;
  page: number;
  pageSize: number;
  total: number;
  t: Dictionary;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted">
        {fmt(t.filters.showing, { from, to: Math.min(page * pageSize, total), total })}
      </p>
      <Pagination
        page={page}
        pages={pages}
        hrefFor={(n) => `${path}${queryString({ ...filters, page: n > 1 ? n : undefined })}`}
        jump={{ action: path, params: Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) }}
        labels={{
          prev: t.filters.prev,
          next: t.filters.next,
          goToPage: t.filters.goToPage,
          go: t.filters.go,
          pagination: t.filters.pagination,
        }}
      />
    </div>
  );
}
