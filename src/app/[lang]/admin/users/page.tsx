import type { Metadata } from "next";
import { fmt } from "@/i18n/format";
import { pageParam, param } from "@/modules/admin/forms";
import { requireAdminPage } from "@/modules/admin/guard";
import { getAdminI18n } from "@/modules/admin/i18n";
import { listUsers, USER_PAGE_SIZE } from "@/modules/admin/users";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { RoleButton } from "@/components/admin/role-button";
import { Badge, EmptyState, FilterBar, filterControl, PageHeader, Panel, Table, Td, Th } from "@/components/admin/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { a } = await getAdminI18n();
  return { title: a.nav.users };
}

export default async function AdminUsersPage({ searchParams }: PageProps<"/[lang]/admin/users">) {
  const params = await searchParams;
  const me = await requireAdminPage();
  const { a, t, href, date, dateTime } = await getAdminI18n();
  const q = param(params, "q");
  const page = pageParam(params);
  const { rows, total } = await listUsers(q || undefined, page);
  const path = href("/admin/users");
  const u = a.users;

  return (
    <>
      <PageHeader title={a.nav.users} intro={u.intro} />
      <FilterBar
        action={path}
        resetHref={q ? path : undefined}
        labels={{ filter: a.common.search, reset: a.common.reset }}
      >
        <input
          name="q"
          defaultValue={q}
          placeholder={u.searchPlaceholder}
          aria-label={a.common.search}
          className={`${filterControl} w-64`}
        />
      </FilterBar>
      <Panel flush title={fmt(a.common.total, { count: total })}>
        {rows.length === 0 ? (
          <EmptyState>{a.common.noResults}</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{u.columns.user}</Th>
                <Th>{u.columns.role}</Th>
                <Th>{u.columns.joined}</Th>
                <Th>{u.columns.lastLogin}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map((user) => (
                <tr key={user.id} className="hover:bg-surface-2/50">
                  <Td>
                    <p className="font-semibold">
                      {user.fullName}
                      {user.id === me.id && <span className="ml-1.5 font-normal text-muted">({u.you})</span>}
                    </p>
                    <p className="text-xs text-muted">
                      {user.email}
                      {user.phone && ` · ${user.phone}`}
                    </p>
                  </Td>
                  <Td>
                    <Badge tone={user.role === "admin" ? "strong" : "neutral"}>{u.roles[user.role]}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap">{date(user.createdAt)}</Td>
                  <Td className="whitespace-nowrap">
                    {user.lastLoginAt ? dateTime(user.lastLoginAt) : a.common.never}
                  </Td>
                  <Td className="text-right">
                    {user.id !== me.id && <RoleButton userId={user.id} isAdmin={user.role === "admin"} />}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
      <AdminPagination path={path} filters={{ q }} page={page} pageSize={USER_PAGE_SIZE} total={total} t={t} />
    </>
  );
}
