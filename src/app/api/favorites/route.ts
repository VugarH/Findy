import { loadMarket } from "@/modules/pricing/fx";
import { sanitizeFavorites } from "@/modules/favorites/items";
import { favoriteCards } from "@/modules/favorites/service";
import { log } from "@/modules/logs/logger";

/** 100 ids are about 4 KB. */
const MAX_BODY_BYTES = 8_000;

/**
 * POST /api/favorites {productIds} → {cards}: the saved products a visitor's
 * browser sends, as cards. The list is used for this answer only and never stored.
 */
export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return Response.json({ error: "Too large" }, { status: 413 });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    const cards = await favoriteCards(await loadMarket(), sanitizeFavorites(body.productIds));
    return Response.json({ cards }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    void log.warn("search", "favorites.failed", "Favorites could not be loaded", { error });
    return Response.json({ cards: [] }, { status: 500 });
  }
}
