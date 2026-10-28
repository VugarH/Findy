import { loadMarket } from "@/modules/pricing/fx";
import { MAX_QUERY_LENGTH, normalizeQuery } from "@/modules/search/normalize";
import { suggestSearches } from "@/modules/search/terms";

/**
 * GET /api/search/suggest?q=… — search suggestions while typing (brands and
 * popular searches). The terms change once a day, so answers are cached.
 */
export async function GET(request: Request) {
  const typed = normalizeQuery(new URL(request.url).searchParams.get("q")).slice(0, MAX_QUERY_LENGTH);
  // Suggestions are a convenience: a failure (e.g. before the daily job created their table) shows none.
  const suggestions = typed.length < 2 ? [] : await suggestSearches(await loadMarket(), typed).catch(() => []);
  return Response.json(
    { suggestions },
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
