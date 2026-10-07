import { and, asc, count, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { follows, products, suppliers, type Follow } from "@/db/schema";
import { isCategorySlug } from "@/config/categories";
import { brandKey } from "@/modules/catalog/brand";
import { MAX_FOLLOWS, type FollowKind } from "./keys";

export type ToggleFollowResult = { following: boolean } | { error: "notFound" | "limit" };

/** The display name for what is followed, or null when it does not exist. */
async function labelFor(kind: FollowKind, key: string): Promise<string | null> {
  if (kind === "category") return isCategorySlug(key) ? key : null;
  if (kind === "store") {
    const [store] = await db.select({ name: suppliers.name }).from(suppliers).where(eq(suppliers.id, key)).limit(1);
    return store?.name ?? null;
  }
  // The spelling most products use ("adidas" rather than "ADIDAS").
  const [brand] = await db
    .select({ name: sql<string>`mode() within group (order by trim(${products.brand}))` })
    .from(products)
    .where(sql`lower(trim(${products.brand})) = ${key}`);
  return brand?.name ?? null;
}

/** Starts or stops following. Following starts from now: deals already running are not announced. */
export async function toggleFollow(userId: string, kind: FollowKind, rawKey: string): Promise<ToggleFollowResult> {
  const key = kind === "brand" ? brandKey(rawKey) : rawKey;
  const removed = await db
    .delete(follows)
    .where(and(eq(follows.userId, userId), eq(follows.kind, kind), eq(follows.key, key)))
    .returning({ id: follows.id });
  if (removed.length > 0) return { following: false };

  const [{ total }] = await db.select({ total: count() }).from(follows).where(eq(follows.userId, userId));
  if (total >= MAX_FOLLOWS) return { error: "limit" };
  const label = await labelFor(kind, key);
  if (!label) return { error: "notFound" };

  await db.insert(follows).values({ userId, kind, key, label }).onConflictDoNothing();
  return { following: true };
}

export async function listFollows(userId: string): Promise<Follow[]> {
  return db.select().from(follows).where(eq(follows.userId, userId)).orderBy(asc(follows.kind), asc(follows.label));
}
