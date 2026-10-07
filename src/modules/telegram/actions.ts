"use server";

import { getCurrentUser } from "@/modules/auth/session";
import { loadMarket } from "@/modules/pricing/fx";
import { telegramEnabled, usesWebhook } from "./config";
import { createStartLink, disconnectUser, telegramLinkOf } from "./link";
import { handleWaitingUpdatesOnce } from "./updates";

export type StartLinkResult = { url: string } | { error: "signIn" | "unavailable" };

/** A one-time link that opens our bot in Telegram and connects this account when Start is pressed. */
export async function startTelegramLinkAction(): Promise<StartLinkResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "signIn" };
  if (!telegramEnabled()) return { error: "unavailable" };
  try {
    return { url: await createStartLink(user.id) };
  } catch (error) {
    console.error("Could not create a Telegram link", error instanceof Error ? error.message : error);
    return { error: "unavailable" };
  }
}

export interface TelegramStatus {
  linked: boolean;
  username: string | null;
}

/** Asked every few seconds while the person is connecting. Without a webhook it also fetches the bot's messages. */
export async function telegramStatusAction(): Promise<TelegramStatus> {
  const user = await getCurrentUser();
  if (!user) return { linked: false, username: null };
  if (telegramEnabled() && !usesWebhook()) {
    await handleWaitingUpdatesOnce(await loadMarket()).catch((error) =>
      console.error("Telegram updates failed", error instanceof Error ? error.message : error),
    );
  }
  const link = await telegramLinkOf(user.id);
  return { linked: link !== null, username: link?.username ?? null };
}

export async function disconnectTelegramAction(): Promise<void> {
  const user = await getCurrentUser();
  if (user) await disconnectUser(user.id);
}
