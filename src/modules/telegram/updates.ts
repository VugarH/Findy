import type { MarketConfig } from "@/config/markets";
import { callTelegram, type TelegramUpdate } from "./api";
import { handleUpdate } from "./bot";

/**
 * Fetching the bot's messages ourselves (getUpdates), for setups where
 * Telegram cannot reach the site with a webhook — a computer at home, local
 * development. With a webhook (see ./config.ts) this is not used: Telegram
 * refuses getUpdates while a webhook is set.
 */

const ALLOWED_UPDATES = ["message", "my_chat_member"];

/** Handles one batch of waiting updates. Returns the offset that confirms them. */
export async function handleWaitingUpdates(
  market: MarketConfig,
  { offset, waitSeconds = 0 }: { offset?: number; waitSeconds?: number } = {},
): Promise<{ handled: number; nextOffset?: number }> {
  const updates = await callTelegram<TelegramUpdate[]>(
    "getUpdates",
    { offset, timeout: waitSeconds, allowed_updates: ALLOWED_UPDATES },
    { timeoutMs: (waitSeconds + 10) * 1000 },
  );
  for (const update of updates) {
    try {
      await handleUpdate(update, market);
    } catch (error) {
      console.error(`Telegram update ${update.update_id} failed`, error);
    }
  }
  const last = updates.at(-1);
  return { handled: updates.length, nextOffset: last ? last.update_id + 1 : offset };
}

let running: Promise<number> | null = null;
let lastRun = 0;
const MIN_INTERVAL_MS = 2_000;

/**
 * One quick pass: handles what is waiting and tells Telegram it was handled.
 * Called while someone waits on the "Connect Telegram" step. Passes from
 * several visitors at once share one request.
 */
export function handleWaitingUpdatesOnce(market: MarketConfig): Promise<number> {
  if (running) return running;
  if (Date.now() - lastRun < MIN_INTERVAL_MS) return Promise.resolve(0);
  running = (async () => {
    try {
      const { handled, nextOffset } = await handleWaitingUpdates(market);
      // Asking from the next offset is what confirms the batch; anything newer waits for the next pass.
      if (handled > 0) await callTelegram("getUpdates", { offset: nextOffset, limit: 1, timeout: 0 });
      return handled;
    } finally {
      lastRun = Date.now();
      running = null;
    }
  })();
  return running;
}
