import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { fmt } from "@/i18n/format";
import { setOrderStatusAction } from "@/modules/admin/actions/general";
import { pageParam, param } from "@/modules/admin/forms";
import { getAdminI18n } from "@/modules/admin/i18n";
import { isOrderStatus, listOrderRequests, ORDER_PAGE_SIZE, ORDER_STATUSES } from "@/modules/admin/orders";
import { ActionButton } from "@/components/admin/action-button";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { EmptyState, PageHeader, Panel, Table, Td, Th } from "@/components/admin/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { a } = await getAdminI18n();
  return { title: a.nav.orders };
}

export default async function AdminOrdersPage({ searchParams }: PageProps<"/[lang]/admin/orders">) {
  const params = await searchParams;
  const { a, t, href, money, dateTime } = await getAdminI18n();
  const statusParam = param(params, "status");
  const status = isOrderStatus(statusParam) ? statusParam : undefined;
  const page = pageParam(params);
  const { rows, total, byStatus } = await listOrderRequests(status, page);
  const path = href("/admin/orders");
  const o = a.orders;

  return (
    <>
      <PageHeader title={a.nav.orders} intro={o.intro} />

      <nav className="mb-4 flex flex-wrap gap-1">
        {[undefined, ...ORDER_STATUSES].map((value) => (
          <Link
            key={value ?? "all"}
            href={value ? `${path}?status=${value}` : path}
            aria-current={value === status ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium",
              value === status ? "bg-ink text-bg" : "text-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            {value ? t.order.status[value] : a.common.all}
            {value && <span className="ml-1.5 tabular-nums opacity-70">{byStatus[value]}</span>}
          </Link>
        ))}
      </nav>

      <Panel flush>
        {rows.length === 0 ? (
          <EmptyState>{o.empty}</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{o.columns.request}</Th>
                <Th>{o.columns.product}</Th>
                <Th>{o.columns.contact}</Th>
                <Th className="text-right">{o.columns.estimate}</Th>
                <Th>{o.columns.status}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((order) => (
                <tr key={order.id} className="hover:bg-surface-2/50">
                  <Td className="whitespace-nowrap">
                    <p className="font-mono font-semibold">{order.reference}</p>
                    <p className="text-xs text-muted">{dateTime(order.createdAt)}</p>
                  </Td>
                  <Td className="min-w-64">
                    <p className="font-medium">
                      {fmt(o.quantity, { count: order.quantity })} {order.productTitle}
                    </p>
                    <a
                      href={order.offerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-muted hover:underline"
                    >
                      {order.supplierName}
                    </a>
                    {order.note && <p className="mt-1 text-xs italic text-muted">“{order.note}”</p>}
                  </Td>
                  <Td className="whitespace-nowrap">
                    <p className="font-medium">{order.contactName}</p>
                    <a href={`tel:${order.contactPhone}`} className="block text-xs text-brand-strong hover:underline">
                      {order.contactPhone}
                    </a>
                    {order.contactEmail && (
                      <a href={`mailto:${order.contactEmail}`} className="block text-xs text-muted hover:underline">
                        {order.contactEmail}
                      </a>
                    )}
                    <p className="text-xs text-muted">{order.city}</p>
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    <p className="font-bold tabular-nums">
                      {money(order.estimatedLandedMinor + order.estimatedFeeMinor)}
                    </p>
                    <p className="text-xs text-muted">{fmt(o.feeLine, { fee: money(order.estimatedFeeMinor) })}</p>
                  </Td>
                  <Td>
                    <p className="mb-2 text-sm font-semibold">{t.order.status[order.status]}</p>
                    <div className="flex flex-wrap gap-1">
                      {ORDER_STATUSES.filter((next) => next !== order.status).map((next) => (
                        <ActionButton
                          key={next}
                          action={setOrderStatusAction}
                          fields={{ id: order.id, status: next }}
                          variant="ghost"
                        >
                          → {t.order.status[next]}
                        </ActionButton>
                      ))}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
      <AdminPagination
        path={path}
        filters={{ status: status ?? "" }}
        page={page}
        pageSize={ORDER_PAGE_SIZE}
        total={total}
        t={t}
      />
    </>
  );
}
