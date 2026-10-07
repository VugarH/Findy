import { count, desc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { orderRequests, type OrderRequest, type OrderRequestStatus } from "@/db/schema";

/** "Order it for me" requests (modules/orders), worked through by the team. */
export const ORDER_STATUSES = [
  "new",
  "contacted",
  "confirmed",
  "cancelled",
] as const satisfies readonly OrderRequestStatus[];

export function isOrderStatus(value: string): value is OrderRequestStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

export const ORDER_PAGE_SIZE = 30;

export async function listOrderRequests(
  status: OrderRequestStatus | undefined,
  page = 1,
): Promise<{ rows: OrderRequest[]; total: number; byStatus: Record<OrderRequestStatus, number> }> {
  const where: SQL | undefined = status ? eq(orderRequests.status, status) : undefined;
  const [rows, [{ total }], grouped] = await Promise.all([
    db
      .select()
      .from(orderRequests)
      .where(where)
      .orderBy(desc(orderRequests.createdAt))
      .limit(ORDER_PAGE_SIZE)
      .offset((page - 1) * ORDER_PAGE_SIZE),
    db.select({ total: count() }).from(orderRequests).where(where),
    db.select({ status: orderRequests.status, total: count() }).from(orderRequests).groupBy(orderRequests.status),
  ]);
  const byStatus = Object.fromEntries(ORDER_STATUSES.map((s) => [s, grouped.find((g) => g.status === s)?.total ?? 0]));
  return { rows, total, byStatus: byStatus as Record<OrderRequestStatus, number> };
}

export async function setOrderStatus(id: string, status: OrderRequestStatus): Promise<OrderRequest | null> {
  const [updated] = await db.update(orderRequests).set({ status }).where(eq(orderRequests.id, id)).returning();
  return updated ?? null;
}

/** Requests nobody has picked up yet, for the menu badge. */
export async function countNewOrders(): Promise<number> {
  const [row] = await db.select({ total: count() }).from(orderRequests).where(eq(orderRequests.status, "new"));
  return row.total;
}
