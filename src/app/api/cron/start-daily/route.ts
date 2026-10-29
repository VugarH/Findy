import { jobsConfigured, startJob } from "@/modules/admin/jobs";
import { log } from "@/modules/logs/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/start-daily — starts the daily job on GitHub Actions. Called by
 * Vercel Cron (vercel.json), which sends `Authorization: Bearer $CRON_SECRET`.
 * GitHub's own timer is often hours late; a dispatched run starts within a minute.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret === "change-me") {
    return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!jobsConfigured()) return Response.json({ error: "GITHUB_REPO / GITHUB_ACTIONS_TOKEN not set" }, { status: 503 });
  try {
    await startJob("daily");
    return Response.json({ started: true });
  } catch (error) {
    await log.error("pipeline", "cron.start-failed", "Vercel Cron could not start the daily job", { error });
    return Response.json({ error: "GitHub refused" }, { status: 502 });
  }
}
