import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { ACTIVITY_PAGE_SIZE, ADMIN_ENTITIES, isAdminEntity, listAdminEvents } from "@/modules/admin/audit";
import { pageParam, param } from "@/modules/admin/forms";
import { getAdminI18n } from "@/modules/admin/i18n";
import { lastPublishedAt } from "@/modules/deals/publish";
import { ActivityList } from "@/components/admin/activity-list";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { PageHeader, Panel } from "@/components/admin/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { a } = await getAdminI18n();
  return { title: a.nav.activity };
}

export default async function AdminActivityPage({ searchParams }: PageProps<"/[lang]/admin/activity">) {
  const params = await searchParams;
  const i18n = await getAdminI18n();
  const { a, t, href } = i18n;
  const entityParam = param(params, "entity");
  const entity = isAdminEntity(entityParam) ? entityParam : undefined;
  const page = pageParam(params);
  const [{ events, total }, publishedAt] = await Promise.all([
    listAdminEvents({ entityType: entity }, page),
    lastPublishedAt(),
  ]);
  const path = href("/admin/activity");

  return (
    <>
      <PageHeader title={a.nav.activity} intro={a.activity.intro} />
      <nav className="mb-4 flex flex-wrap gap-1">
        {[undefined, ...ADMIN_ENTITIES].map((value) => (
          <Link
            key={value ?? "all"}
            href={value ? `${path}?entity=${value}` : path}
            aria-current={value === entity ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium",
              value === entity ? "bg-ink text-bg" : "text-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            {value ? a.activity.entities[value] : a.activity.anyEntity}
          </Link>
        ))}
      </nav>
      <Panel flush>
        <ActivityList events={events} i18n={i18n} publishedAt={publishedAt} />
      </Panel>
      <AdminPagination
        path={path}
        filters={{ entity: entity ?? "" }}
        page={page}
        pageSize={ACTIVITY_PAGE_SIZE}
        total={total}
        t={t}
      />
    </>
  );
}
