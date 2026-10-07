import { timingSafeEqual } from "node:crypto";
import { loadMarket } from "@/modules/pricing/fx";
import type { TelegramUpdate } from "@/modules/telegram/api";
import { handleUpdate } from "@/modules/telegram/bot";
import { webhookSecret } from "@/modules/telegram/config";

export const dynamic = "force-dynamic";

function sameSecret(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * POST /api/telegram/webhook — messages to our bot, delivered by Telegram.
 * Registered with `npm run telegram -- webhook <public url>`, which also
 * gives Telegram the secret it sends back in every request.
 */
export async function POST(request: Request) {
  const secret = webhookSecret();
  if (!secret) return Response.json({ error: "Webhook is not configured" }, { status: 404 });
  if (!sameSecret(request.headers.get("x-telegram-bot-api-secret-token"), secret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;
  if (update && typeof update.update_id === "number") {
    try {
      await handleUpdate(update, await loadMarket());
    } catch (error) {
      // Answer 200 anyway: Telegram would otherwise resend the same update again and again.
      console.error(`Telegram update ${update.update_id} failed`, error);
    }
  }
  return Response.json({ ok: true });
}
