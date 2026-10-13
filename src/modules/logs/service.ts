import { and, count, desc, eq, gte, ilike, lt, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { appLogs, users, type AppLog, type LogLevel } from "@/db/schema";

/** How long entries are kept. Info is plentiful and useful only briefly; problems stay longer. */
export const LOG_RETENTION_DAYS = { info: 14, problems: 30 } as const;
export const LOG_LEVELS: readonly LogLevel[] = ["error", "warn", "info"];
export const isLogLevel = (value: unknown): value is LogLevel => LOG_LEVELS.includes(value as LogLevel);
export const LOGS_PAGE_SIZE = 50;

export interface LogFilters {
  level?: LogLevel;
  area?: string;
  /** Words in the message or the event name. */
  query?: string;
}

export interface LogRow extends AppLog {
  userEmail: string | null;
}

export async function listLogs(filters: LogFilters, page: number): Promise<{ rows: LogRow[]; total: number }> {
  const conditions: SQL[] = [];
  if (filters.level) conditions.push(eq(appLogs.level, filters.level));
  if (filters.area) conditions.push(eq(appLogs.area, filters.area));
  if (filters.query) {
    const pattern = `%${filters.query.replace(/[%_\\]/g, "\\$&")}%`;
    conditions.push(or(ilike(appLogs.message, pattern), ilike(appLogs.event, pattern))!);
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({ log: appLogs, userEmail: users.email })
      .from(appLogs)
      .leftJoin(users, eq(appLogs.userId, users.id))
      .where(where)
      .orderBy(desc(appLogs.createdAt))
      .limit(LOGS_PAGE_SIZE)
      .offset((page - 1) * LOGS_PAGE_SIZE),
    db.select({ total: count() }).from(appLogs).where(where),
  ]);
  return { rows: rows.map(({ log, userEmail }) => ({ ...log, userEmail })), total };
}

/** Areas that have entries, for the filter. */
export async function listLogAreas(): Promise<string[]> {
  const rows = await db.selectDistinct({ area: appLogs.area }).from(appLogs).orderBy(appLogs.area);
  return rows.map((row) => row.area);
}

/** Errors in the last day: the badge in the admin menu. */
export async function countRecentErrors(now = new Date()): Promise<number> {
  const since = new Date(now.getTime() - 86_400_000).toISOString();
  const [row] = await db
    .select({ total: count() })
    .from(appLogs)
    .where(and(eq(appLogs.level, "error"), gte(appLogs.createdAt, sql`${since}::timestamptz`)));
  return row.total;
}

/** Deletes entries past their retention (run by the daily job). Returns how many went. */
export async function pruneLogs(now = new Date()): Promise<number> {
  const before = (days: number) => sql`${new Date(now.getTime() - days * 86_400_000).toISOString()}::timestamptz`;
  const deleted = await db
    .delete(appLogs)
    .where(
      or(
        and(eq(appLogs.level, "info"), lt(appLogs.createdAt, before(LOG_RETENTION_DAYS.info))),
        and(ne(appLogs.level, "info"), lt(appLogs.createdAt, before(LOG_RETENTION_DAYS.problems))),
      ),
    )
    .returning({ id: appLogs.id });
  return deleted.length;
}
