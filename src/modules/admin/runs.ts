import { count, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { pipelineRuns, suppliers, type PipelineStats } from "@/db/schema";

/** The daily job's run log (pipeline_runs), as the admin panel shows it. */

/** A run still "running" after this long was stopped before it could finish (closed terminal, crash). */
const INTERRUPTED_AFTER_MS = 12 * 3_600_000;

export type RunStatus = "running" | "success" | "partial" | "failed" | "interrupted";

export interface AdminRun {
  id: string;
  status: RunStatus;
  startedAt: Date;
  finishedAt: Date | null;
  stats: PipelineStats | null;
  storesOk: number;
  storesFailed: number;
  offers: number;
}

export function runStatus(status: string, startedAt: Date, now = new Date()): RunStatus {
  if (status === "running" && now.getTime() - startedAt.getTime() > INTERRUPTED_AFTER_MS) return "interrupted";
  return status as RunStatus;
}

export const RUN_PAGE_SIZE = 20;

export async function listRuns(
  page = 1,
): Promise<{ runs: AdminRun[]; total: number; storeNames: Map<string, string> }> {
  const [rows, [{ total }], names] = await Promise.all([
    db
      .select()
      .from(pipelineRuns)
      .orderBy(desc(pipelineRuns.startedAt))
      .limit(RUN_PAGE_SIZE)
      .offset((page - 1) * RUN_PAGE_SIZE),
    db.select({ total: count() }).from(pipelineRuns),
    db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers),
  ]);
  return {
    total,
    storeNames: new Map(names.map((row) => [row.id, row.name])),
    runs: rows.map((row) => {
      const stores = row.stats?.suppliers ?? [];
      return {
        id: row.id,
        status: runStatus(row.status, row.startedAt),
        startedAt: row.startedAt,
        finishedAt: row.finishedAt,
        stats: row.stats,
        storesOk: stores.filter((s) => s.ok).length,
        storesFailed: stores.filter((s) => !s.ok).length,
        offers: stores.reduce((sum, s) => sum + s.offers, 0),
      };
    }),
  };
}

export async function latestRun(): Promise<AdminRun | null> {
  const { runs } = await listRuns(1);
  return runs[0] ?? null;
}
