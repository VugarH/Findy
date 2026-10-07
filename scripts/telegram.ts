/**
 * The Telegram bot and channel (see src/modules/telegram/config.ts for the settings).
 *
 *   npm run telegram -- status                 is the bot reachable, can it post to the channel, how many are connected
 *   npm run telegram -- digest                 pick today's top deals (if not yet) and post them to the channel (if not yet)
 *   npm run telegram -- digest --again         post today's list again
 *   npm run telegram -- listen                 answer the bot's messages (/start links) without a webhook; Ctrl+C stops
 *   npm run telegram -- webhook <https url>    let Telegram deliver messages to <url>/api/telegram/webhook
 *   npm run telegram -- webhook off
 */
import { closeDb } from "@/db/client";
import { loadMarket } from "@/modules/pricing/fx";
import { buildDailyDigest } from "@/modules/digest/service";
import { callTelegram, getBot, type TelegramChat, type WebhookInfo } from "@/modules/telegram/api";
import { postDigest } from "@/modules/telegram/channel";
import { channelId, channelUrl, telegramEnabled, webhookSecret } from "@/modules/telegram/config";
import { countConnectedUsers } from "@/modules/telegram/link";
import { handleWaitingUpdates } from "@/modules/telegram/updates";

const USAGE = "usage: npm run telegram -- status | digest [--again] | listen | webhook <https url> | webhook off";

async function status() {
  const bot = await getBot();
  console.log(`Bot:      @${bot.username} (${bot.first_name})`);
  const channel = channelId();
  if (channel) {
    try {
      const chat = await callTelegram<TelegramChat>("getChat", { chat_id: channel });
      console.log(`Channel:  ${chat.title ?? channel} ${channelUrl() ?? "(private: set TELEGRAM_CHANNEL_URL to link it)"}`);
    } catch (error) {
      console.log(`Channel:  ${channel} — not reachable: ${(error as Error).message}. Add the bot to the channel as an admin.`);
    }
  } else {
    console.log("Channel:  not set (TELEGRAM_CHANNEL_ID) — the daily top deals are not posted");
  }
  const hook = await callTelegram<WebhookInfo>("getWebhookInfo");
  console.log(
    hook.url
      ? `Messages: webhook ${hook.url}${hook.last_error_message ? ` — last error: ${hook.last_error_message}` : ""}`
      : "Messages: no webhook — the site fetches them while someone connects, or run `npm run telegram -- listen`",
  );
  console.log(`Connected accounts: ${await countConnectedUsers()}`);
}

async function digest(again: boolean) {
  const market = await loadMarket();
  const today = await buildDailyDigest(market);
  if (!today) {
    console.log("No deals to pick from. Run the daily job first.");
    return;
  }
  console.log(`Top deals for ${today.day}: ${today.items.length}`);
  today.items.forEach((item, index) => console.log(`  ${index + 1}. ${item.title.slice(0, 70)} — ${item.supplierName}`));
  const result = await postDigest(today, market, { force: again });
  if (result.status === "posted") console.log(`Posted to the channel (message ${result.messageId}).`);
  if (result.status === "already") console.log("Already posted today. Add --again to post it once more.");
  if (result.status === "off") console.log("No channel set (TELEGRAM_CHANNEL_ID), so nothing was posted.");
  if (result.status === "failed") {
    console.error(`Posting failed: ${result.error}`);
    process.exitCode = 1;
  }
}

async function listen() {
  if (webhookSecret()) console.warn("TELEGRAM_WEBHOOK_SECRET is set: if a webhook is registered, Telegram refuses this.");
  const market = await loadMarket();
  const bot = await getBot();
  console.log(`Answering messages to @${bot.username}. Ctrl+C stops.`);
  let offset: number | undefined;
  for (;;) {
    try {
      const batch = await handleWaitingUpdates(market, { offset, waitSeconds: 50 });
      offset = batch.nextOffset;
      if (batch.handled) console.log(`${new Date().toLocaleTimeString()}  handled ${batch.handled} message(s)`);
    } catch (error) {
      console.error((error as Error).message);
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
  }
}

async function webhook(target: string | undefined) {
  if (target === "off") {
    await callTelegram("deleteWebhook");
    console.log("Webhook removed. Messages are now fetched by the site (or `npm run telegram -- listen`).");
    return;
  }
  const secret = webhookSecret();
  if (!target?.startsWith("https://") || !secret) {
    console.error("Give the site's public https address, and set TELEGRAM_WEBHOOK_SECRET in .env first (any long random text).");
    process.exitCode = 2;
    return;
  }
  const url = `${target.replace(/\/+$/, "")}/api/telegram/webhook`;
  await callTelegram("setWebhook", { url, secret_token: secret, allowed_updates: ["message", "my_chat_member"] });
  console.log(`Telegram now delivers messages to ${url}.`);
}

async function main() {
  const [command, arg] = process.argv.slice(2);
  if (!telegramEnabled()) {
    console.error("TELEGRAM_BOT_TOKEN is not set in .env. Create a bot with @BotFather first (see README → Telegram).");
    process.exitCode = 1;
    return;
  }
  if (command === "status") return status();
  if (command === "digest") return digest(arg === "--again");
  if (command === "listen") return listen();
  if (command === "webhook") return webhook(arg);
  console.error(USAGE);
  process.exitCode = 2;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closeDb);
