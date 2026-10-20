import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { orderRequests, type OrderRequest } from "@/db/schema";

/**
 * "Order it for me" requests from before requests moved into Messages
 * (modules/messages): kept read-only, as a record. No new ones are created.
 */

export async function listUserOrderRequests(userId: string): Promise<OrderRequest[]> {
  return db.select().from(orderRequests).where(eq(orderRequests.userId, userId)).orderBy(desc(orderRequests.createdAt)).limit(50);
}

/** Newest first, for the admin archive. */
export async function listOrderRequests(limit = 100): Promise<OrderRequest[]> {
  return db.select().from(orderRequests).orderBy(desc(orderRequests.createdAt)).limit(limit);
}
