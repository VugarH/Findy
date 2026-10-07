import { loadMarket } from "@/modules/pricing/fx";
import { liveSearch } from "@/modules/search/live-search";
import { MIN_QUERY_LENGTH, normalizeQuery } from "@/modules/search/normalize";

export const dynamic = "force-dynamic";

/**
 * GET /api/search/live?q=… — Server-Sent Events, one message per store as it answers.
 * TODO before launch: rate-limit per IP; live searches cost supplier API quota.
 */
export async function GET(request: Request) {
  const query = normalizeQuery(new URL(request.url).searchParams.get("q"));
  if (query.length < MIN_QUERY_LENGTH) {
    return Response.json({ error: "Query is too short" }, { status: 400 });
  }

  const market = await loadMarket();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of liveSearch(query, market, request.signal)) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }
      } catch (error) {
        if (!request.signal.aborted) console.error("Live search failed", error);
      } finally {
        try {
          controller.close();
        } catch {
          // Client already disconnected.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
