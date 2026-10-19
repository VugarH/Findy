"use server";

import { log } from "@/modules/logs/logger";
import { recordAdminEvent } from "../audit";
import { text, type AdminFormState } from "../forms";
import { requireAdmin } from "../guard";
import { isJobName, jobsConfigured, parseStoreList, startJob } from "../jobs";

/** "Run now" under Daily runs: starts the daily deals or the follow-notifications job on GitHub Actions. */
export async function startJobAction(_previous: AdminFormState, form: FormData): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const job = text(form, "job");
  if (!isJobName(job)) return { formError: "invalid" };
  if (!jobsConfigured()) return { formError: "jobsOff" };
  const stores = parseStoreList(text(form, "stores"));
  if (stores === null) return { errors: { stores: "invalid" }, values: { stores: text(form, "stores") } };

  try {
    await startJob(job, stores);
  } catch (error) {
    await log.error("pipeline", "job.start-failed", `Could not start the ${job} job on GitHub`, { error, userId: admin.id });
    return { formError: "jobFailed", values: { stores } };
  }
  await recordAdminEvent(admin, {
    action: "job.run",
    entityType: "job",
    entityId: job,
    entityLabel: job,
    details: stores ? { stores } : {},
  });
  return { notice: "jobStarted" };
}
