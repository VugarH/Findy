import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { suppliers, type SupplierRunStat } from "@/db/schema";
import { log } from "@/modules/logs/logger";

/**
 * Store health. A store whose collection fails on STORE_HEALTH.pauseAfterDays
 * calendar days in a row is paused: the daily job then tries it only once
 * every retryEveryDays, and a success un-pauses it. Several runs on one day
 * count as one day. Blocks (403) and outages (503) are not worked around;
 * a paused store just stops costing requests every day.
 */
export const STORE_HEALTH = { pauseAfterDays: 3, retryEveryDays: 7 } as const;

export interface Health {
  failingDays: number;
  /** YYYY-MM-DD in the market's time zone. */
  lastFailedOn: string | null;
  pausedAt: Date | null;
}

const previousDay = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

/** A store's health after a collection on `today` (pure). `change` says whether it was just paused or resumed. */
export function nextHealth(
  health: Health,
  ok: boolean,
  today: string,
  now: Date,
): Health & { change: "paused" | "resumed" | null } {
  if (ok) return { failingDays: 0, lastFailedOn: health.lastFailedOn, pausedAt: null, change: health.pausedAt ? "resumed" : null };
  const failingDays =
    health.lastFailedOn === today ? health.failingDays : health.lastFailedOn === previousDay(today) ? health.failingDays + 1 : 1;
  const pause = !health.pausedAt && failingDays >= STORE_HEALTH.pauseAfterDays;
  return { failingDays, lastFailedOn: today, pausedAt: pause ? now : health.pausedAt, change: pause ? "paused" : null };
}

/** A paused store is tried again once its last attempt is retryEveryDays old (pure). */
export function dueForRetry(store: { lastErrorAt: Date | null }, now: Date): boolean {
  return !store.lastErrorAt || now.getTime() - store.lastErrorAt.getTime() >= STORE_HEALTH.retryEveryDays * 86_400_000;
}

/** Paused stores the daily job should skip this time. */
export async function pausedStoresToSkip(now: Date): Promise<Set<string>> {
  const rows = await db
    .select({ id: suppliers.id, lastErrorAt: suppliers.lastErrorAt })
    .from(suppliers)
    .where(isNotNull(suppliers.pausedAt));
  return new Set(rows.filter((row) => !dueForRetry(row, now)).map((row) => row.id));
}

/** After a collection: counts failed days, pauses and resumes stores, and logs each change. */
export async function updateStoreHealth(stats: SupplierRunStat[], today: string, now: Date): Promise<void> {
  if (stats.length === 0) return;
  const rows = await db
    .select({
      id: suppliers.id,
      failingDays: suppliers.failingDays,
      lastFailedOn: suppliers.lastFailedOn,
      pausedAt: suppliers.pausedAt,
      lastError: suppliers.lastError,
    })
    .from(suppliers)
    .where(inArray(suppliers.id, stats.map((stat) => stat.supplierId)));
  const byId = new Map(rows.map((row) => [row.id, row]));

  for (const stat of stats) {
    const row = byId.get(stat.supplierId);
    if (!row) continue; // never collected successfully: not a registered store yet
    const next = nextHealth(row, stat.ok, today, now);
    await db
      .update(suppliers)
      .set({ failingDays: next.failingDays, lastFailedOn: next.lastFailedOn, pausedAt: next.pausedAt })
      .where(eq(suppliers.id, stat.supplierId));
    if (next.change === "paused") {
      await log.warn("stores", "store.paused", `${stat.supplierId} paused after ${next.failingDays} failed days in a row: ${stat.error ?? row.lastError ?? "failed"}`, {
        storeId: stat.supplierId,
        failingDays: next.failingDays,
      });
    } else if (next.change === "resumed") {
      await log.info("stores", "store.resumed", `${stat.supplierId} answered again and is no longer paused`, { storeId: stat.supplierId });
    }
  }
}

/** "Resume now" in the admin panel: the next run tries the store again. Returns false for an unknown store. */
export async function resumeStore(id: string): Promise<{ name: string } | null> {
  const [row] = await db
    .update(suppliers)
    .set({ pausedAt: null, failingDays: 0 })
    .where(and(eq(suppliers.id, id), isNotNull(suppliers.pausedAt)))
    .returning({ name: suppliers.name });
  return row ?? null;
}
