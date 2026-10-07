import { loadMarket } from "@/modules/pricing/fx";
import { runDailyPipeline } from "@/modules/deals/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/cron/daily-deals — runs the daily pipeline.
 * Call it from a scheduler with `Authorization: Bearer $CRON_SECRET`.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret === "change-me") {
    return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runDailyPipeline(await loadMarket());
  return Response.json(result, { status: result.status === "failed" ? 500 : 200 });
}
