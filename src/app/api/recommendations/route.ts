import { isCategorySlug } from "@/config/categories";
import { loadMarket } from "@/modules/pricing/fx";
import { sanitizeProfile } from "@/modules/recommendations/profile";
import { recommendDeals } from "@/modules/recommendations/service";
import { getFeatureSwitches } from "@/modules/settings/service";
import { log } from "@/modules/logs/logger";

/** A real profile is well under 2 KB. */
const MAX_BODY_BYTES = 8_000;
const MAX_LIMIT = 12;

/**
 * POST /api/recommendations {profile, category?, limit?} → {cards}: deals for
 * the interests a visitor's browser sends (modules/recommendations/profile.ts).
 * The profile is used for this answer only and never stored. Answers 404 while
 * the feature is switched off (Settings → Features).
 */
export async function POST(request: Request) {
  if (!(await getFeatureSwitches()).recommendations) return Response.json({ cards: [] }, { status: 404 });
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return Response.json({ error: "Too large" }, { status: 413 });

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const profile = sanitizeProfile(body.profile);
  if (!profile) return Response.json({ cards: [] });
  const category = typeof body.category === "string" && isCategorySlug(body.category) ? body.category : undefined;
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(body.limit) || 8));

  try {
    const cards = await recommendDeals(await loadMarket(), { profile, category, limit });
    return Response.json({ cards }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    void log.warn("search", "recommendations.failed", "Recommendations could not be built", { error });
    return Response.json({ cards: [] }, { status: 500 });
  }
}
