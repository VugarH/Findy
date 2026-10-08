import { and, count, desc, eq, gt, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { adminEvents, type AdminEvent } from "@/db/schema";
import { lastPublishedAt } from "@/modules/deals/publish";
import type { CurrentUser } from "@/modules/auth/session";

/**
 * The activity log: every change made in the admin panel is recorded here
 * with who made it. To log a new kind of change, add its name below and a
 * label for it in each dictionary under `admin.activity.actions`.
 */
export const ADMIN_ACTIONS = [
  "store.create",
  "store.update",
  "store.switch-on",
  "store.switch-off",
  "store.notes",
  "store.collect",
  "product.create",
  "product.update",
  "product.move",
  "product.audience",
  "product.switch-on",
  "product.switch-off",
  "product.merge",
  "offer.create",
  "offer.update",
  "offer.delete",
  "order.status",
  "user.role",
  "deals.publish",
  "digest.pick",
  "digest.post",
  "settings.filters",
  "settings.order",
] as const;
export type AdminAction = (typeof ADMIN_ACTIONS)[number];

/** What a change was made to. Prices entered by hand are logged on their product. */
export const ADMIN_ENTITIES = ["store", "product", "order", "user", "deals", "digest", "settings"] as const;
export type AdminEntity = (typeof ADMIN_ENTITIES)[number];

export function isAdminEntity(value: string): value is AdminEntity {
  return (ADMIN_ENTITIES as readonly string[]).includes(value);
}

export interface AdminEventInput {
  action: AdminAction;
  entityType: AdminEntity;
  entityId: string;
  entityLabel: string;
  details?: Record<string, unknown>;
  /** The change reaches the deal pages only after "Publish changes". */
  needsPublish?: boolean;
}

export async function recordAdminEvent(
  actor: Pick<CurrentUser, "id" | "email">,
  events: AdminEventInput | AdminEventInput[],
): Promise<void> {
  const list = Array.isArray(events) ? events : [events];
  if (list.length === 0) return;
  await db.insert(adminEvents).values(
    list.map((event) => ({
      userId: actor.id,
      userEmail: actor.email,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      entityLabel: event.entityLabel.slice(0, 300),
      details: event.details ?? {},
      needsPublish: event.needsPublish ?? false,
    })),
  );
}

export interface ActivityFilters {
  entityType?: AdminEntity;
  entityId?: string;
}

export const ACTIVITY_PAGE_SIZE = 50;

export async function listAdminEvents(
  filters: ActivityFilters,
  page = 1,
  pageSize = ACTIVITY_PAGE_SIZE,
): Promise<{ events: AdminEvent[]; total: number }> {
  const conditions: SQL[] = [];
  if (filters.entityType) conditions.push(eq(adminEvents.entityType, filters.entityType));
  if (filters.entityId) conditions.push(eq(adminEvents.entityId, filters.entityId));
  const where = conditions.length ? and(...conditions) : undefined;

  const [events, [{ total }]] = await Promise.all([
    db
      .select()
      .from(adminEvents)
      .where(where)
      .orderBy(desc(adminEvents.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(adminEvents).where(where),
  ]);
  return { events, total };
}

/** Changes made since the deals were last published that the deal pages do not show yet. */
export async function unpublishedChanges(): Promise<{ count: number; publishedAt: Date | null }> {
  const publishedAt = await lastPublishedAt();
  const [{ total }] = await db
    .select({ total: count() })
    .from(adminEvents)
    .where(and(eq(adminEvents.needsPublish, true), publishedAt ? gt(adminEvents.createdAt, publishedAt) : undefined));
  return { count: total, publishedAt };
}
