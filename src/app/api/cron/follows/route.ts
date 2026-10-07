import { notifyFollowers } from "@/modules/follows/notify";
import { loadMarket } from "@/modules/pricing/fx";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/cron/follows — tells followers about new deals (once a day, 10:00).
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
  return Response.json(await notifyFollowers(await loadMarket()));
}
