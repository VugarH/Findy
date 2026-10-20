import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { pageParam, param } from "@/modules/admin/forms";
import { getAdminI18n } from "@/modules/admin/i18n";
import {
  ADMIN_CONVERSATIONS_PAGE_SIZE,
  CONVERSATION_STATUSES,
  isConversationStatus,
  listAdminConversations,
} from "@/modules/messages/service";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { LiveRefresh } from "@/components/messages/live-refresh";
import { Badge, EmptyState, PageHeader, Panel } from "@/components/admin/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { a } = await getAdminI18n();
  return { title: a.nav.messages };
}

/** The inbox: conversations waiting for an answer first. */
export default async function AdminMessagesPage({ searchParams }: PageProps<"/[lang]/admin/messages">) {
  const params = await searchParams;
  const { a, t, href, dateTime } = await getAdminI18n();
  // Requests waiting for a first reply come first.
  const statusParam = param(params, "status") || "waiting";
  const status = isConversationStatus(statusParam) ? statusParam : undefined;
  const page = pageParam(params);
  const { rows, total, byStatus } = await listAdminConversations(status, page);
  const path = href("/admin/messages");
  const m = a.messages;

  return (
    <>
      <LiveRefresh />
      <PageHeader title={a.nav.messages} intro={m.intro} />

      <nav className="mb-4 flex flex-wrap gap-1">
        {[...CONVERSATION_STATUSES, "all" as const].map((value) => {
          const current = (status ?? "all") === value;
          return (
            <Link
              key={value}
              href={value === "waiting" ? path : `${path}?status=${value}`}
              aria-current={current ? "page" : undefined}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium",
                current ? "bg-ink text-bg" : "text-muted hover:bg-surface-2 hover:text-ink",
              )}
            >
              {value === "all" ? a.common.all : m.status[value]}
              {value !== "all" && <span className="ml-1.5 tabular-nums opacity-70">{byStatus[value]}</span>}
            </Link>
          );
        })}
      </nav>

      <Panel flush>
        {rows.length === 0 ? (
          <EmptyState>{m.empty}</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((row) => (
              <li key={row.id}>
                <Link href={href(`/admin/messages/${row.id}`)} className="flex items-start gap-3 px-5 py-3.5 hover:bg-surface-2/50">
                  <span aria-hidden className={cn("mt-2 size-2 shrink-0 rounded-full", row.unread ? "bg-deal" : "bg-transparent")} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className={cn("text-sm", row.unread ? "font-bold" : "font-semibold")}>
                        {row.customer.name}
                        <span className="ml-2 font-normal text-muted">{row.customer.email}</span>
                      </span>
                      <span className="text-xs text-muted">{dateTime(row.lastMessageAt)}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-sm font-medium">{row.subject}</span>
                    {row.preview && (
                      <span className="block truncate text-sm text-muted">
                        {row.preview.sender === "admin" ? `${t.messages.adminName}: ` : ""}
                        {row.preview.body}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    {row.unread && <Badge tone="bad">{m.unread}</Badge>}
                    {row.needsReply ? (
                      <Badge tone="info">{m.status.waiting}</Badge>
                    ) : (
                      row.status === "closed" && <Badge>{m.status.closed}</Badge>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <AdminPagination
        path={path}
        filters={{ status: status === "waiting" ? "" : (status ?? "all") }}
        page={page}
        pageSize={ADMIN_CONVERSATIONS_PAGE_SIZE}
        total={total}
        t={t}
      />
    </>
  );
}
