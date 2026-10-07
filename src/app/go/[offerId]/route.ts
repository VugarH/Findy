import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { offers, outboundClicks } from "@/db/schema";
import { getMarket } from "@/config/markets";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /go/{offerId} — records the click-out, then sends the visitor to the store.
 * This is where affiliate parameters get appended once programs are connected.
 */
export async function GET(_request: Request, { params }: RouteContext<"/go/[offerId]">) {
  const { offerId } = await params;
  if (!UUID.test(offerId)) return new Response("Not found", { status: 404 });

  const [offer] = await db.select({ url: offers.url }).from(offers).where(eq(offers.id, offerId)).limit(1);
  if (!offer) return new Response("Not found", { status: 404 });

  await db.insert(outboundClicks).values({ offerId, marketCode: getMarket().code });
  return Response.redirect(offer.url, 302);
}
