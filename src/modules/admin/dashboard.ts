import { and, count, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { deals, offers, orderRequests, products, type AdminEvent } from "@/db/schema";
import { getMarket } from "@/config/markets";
import { OTHER_SUBCATEGORY } from "@/config/subcategories";
import { freshSince, offerIsLive } from "@/modules/catalog/offer-view";
import { listAdminEvents, unpublishedChanges } from "./audit";
import { latestRun, type AdminRun } from "./runs";
import { listAdminStores, type AdminStore, type StoreStatus } from "./stores";

/** The numbers and to-do lists on the admin home page. */
export interface Dashboard {
  products: { active: number; live: number; off: number; unsorted: number; manual: number };
  deals: { total: number; verified: number };
  stores: Record<StoreStatus, number> & { total: number };
  failingStores: AdminStore[];
  newOrders: number;
  lastRun: AdminRun | null;
  unpublished: { count: number; publishedAt: Date | null };
  recent: AdminEvent[];
}

export async function getDashboard(): Promise<Dashboard> {
  const since = freshSince(getMarket());
  const current = and(eq(products.active, true), isNull(products.mergedIntoId))!;

  const [[productCounts], [dealCounts], stores, [orders], lastRun, unpublished, recent] = await Promise.all([
    db
      .select({
        active: sql<number>`(count(*) filter (where ${current}))::int`,
        off: sql<number>`(count(*) filter (where not ${products.active} and ${products.mergedIntoId} is null))::int`,
        unsorted: sql<number>`(count(*) filter (where ${current} and ${products.subcategorySlug} = ${OTHER_SUBCATEGORY}))::int`,
        live: sql<number>`(count(*) filter (where ${current} and exists (select 1 from ${offers} where ${eq(offers.productId, products.id)} and ${offerIsLive(since)})))::int`,
        manual: sql<number>`(count(*) filter (where ${current} and exists (select 1 from ${offers} where ${eq(offers.productId, products.id)} and ${eq(offers.manual, true)})))::int`,
      })
      .from(products),
    db.select({ total: count(), verified: sql<number>`(count(*) filter (where ${deals.verified}))::int` }).from(deals),
    listAdminStores(),
    db.select({ total: count() }).from(orderRequests).where(eq(orderRequests.status, "new")),
    latestRun(),
    unpublishedChanges(),
    listAdminEvents({}, 1, 8),
  ]);

  const byStatus = (status: StoreStatus) => stores.filter((store) => store.status === status).length;
  return {
    products: productCounts,
    deals: dealCounts,
    stores: {
      total: stores.length,
      ok: byStatus("ok"),
      failing: byStatus("failing"),
      waiting: byStatus("waiting"),
      off: byStatus("off"),
      retired: byStatus("retired"),
    },
    failingStores: stores
      .filter((store) => store.status === "failing")
      .sort((a, b) => (b.lastErrorAt?.getTime() ?? 0) - (a.lastErrorAt?.getTime() ?? 0)),
    newOrders: orders.total,
    lastRun,
    unpublished,
    recent: recent.events,
  };
}
