import { headers } from "next/headers";
import { z } from "zod";
import { recordView, visitorOf } from "@/modules/analytics/record";
import { getCurrentUser } from "@/modules/auth/session";
import { log } from "@/modules/logs/logger";

export const dynamic = "force-dynamic";

const body = z.object({
  path: z.string().max(400),
  locale: z.string().max(5).nullable().optional(),
  landing: z.boolean().optional(),
  referrer: z.string().max(500).nullable().optional(),
  utmSource: z.string().max(100).nullable().optional(),
});

/** POST /api/track — one page view, sent by the page tracker (components/analytics/page-tracker.tsx). */
export async function POST(request: Request) {
  try {
    const parsed = body.safeParse(JSON.parse(await request.text()));
    if (!parsed.success) return new Response(null, { status: 204 });
    const visitor = visitorOf(await headers(), await getCurrentUser());
    if (visitor) {
      const { path, locale = null, landing = false, referrer = null, utmSource = null } = parsed.data;
      await recordView(visitor, { path, locale, landing, referrer, utmSource });
    }
  } catch (error) {
    await log.warn("request", "track.failed", "A page view could not be recorded", { error });
  }
  return new Response(null, { status: 204 });
}
