import { createHash, randomBytes } from "node:crypto";
import { and, count, eq, gt, isNotNull, lt, ne, or } from "drizzle-orm";
import { db } from "@/db/client";
import { telegramLinkTokens, users } from "@/db/schema";
import { getBot } from "./api";

/**
 * Connecting a person's account to our bot. The site makes a one-time start
 * link (t.me/<bot>?start=<token>); pressing Start sends the token to the bot,
 * which then knows which account the chat belongs to (see ./bot.ts).
 */

const TOKEN_LIFETIME_MS = 30 * 60_000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** A fresh start link for this person. Older unused links stop working. */
export async function createStartLink(userId: string, now = new Date()): Promise<string> {
  const bot = await getBot();
  await db
    .delete(telegramLinkTokens)
    .where(or(eq(telegramLinkTokens.userId, userId), lt(telegramLinkTokens.expiresAt, now)));
  // Start parameters may use A–Z, a–z, 0–9, _ and - (base64url), up to 64 characters.
  const token = randomBytes(24).toString("base64url");
  await db.insert(telegramLinkTokens).values({
    tokenHash: hashToken(token),
    userId,
    expiresAt: new Date(now.getTime() + TOKEN_LIFETIME_MS),
  });
  return `https://t.me/${bot.username}?start=${token}`;
}

/**
 * Uses up a start token and connects the chat to its account. Null when the
 * token is unknown, used or expired. A chat belongs to one account at a time.
 */
export async function connectChat(
  token: string,
  chat: { id: number; username?: string },
  now = new Date(),
): Promise<{ userId: string; locale: string } | null> {
  const [used] = await db
    .delete(telegramLinkTokens)
    .where(and(eq(telegramLinkTokens.tokenHash, hashToken(token)), gt(telegramLinkTokens.expiresAt, now)))
    .returning({ userId: telegramLinkTokens.userId });
  if (!used) return null;

  const chatId = String(chat.id);
  await db
    .update(users)
    .set({ telegramChatId: null, telegramUsername: null, telegramLinkedAt: null })
    .where(and(eq(users.telegramChatId, chatId), ne(users.id, used.userId)));
  const [user] = await db
    .update(users)
    .set({ telegramChatId: chatId, telegramUsername: chat.username ?? null, telegramLinkedAt: now })
    .where(eq(users.id, used.userId))
    .returning({ userId: users.id, locale: users.locale });
  return user ?? null;
}

export async function disconnectUser(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ telegramChatId: null, telegramUsername: null, telegramLinkedAt: null })
    .where(eq(users.id, userId));
}

/** The chat stopped the bot (/stop, blocked it, deleted the account). Returns the account's language, if one was connected. */
export async function disconnectChat(chatId: number | string): Promise<{ locale: string } | null> {
  const [user] = await db
    .update(users)
    .set({ telegramChatId: null, telegramUsername: null, telegramLinkedAt: null })
    .where(eq(users.telegramChatId, String(chatId)))
    .returning({ locale: users.locale });
  return user ?? null;
}

export interface TelegramLink {
  username: string | null;
  linkedAt: Date;
}

export async function telegramLinkOf(userId: string): Promise<TelegramLink | null> {
  const [row] = await db
    .select({ chatId: users.telegramChatId, username: users.telegramUsername, linkedAt: users.telegramLinkedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.chatId && row.linkedAt ? { username: row.username, linkedAt: row.linkedAt } : null;
}

export async function countConnectedUsers(): Promise<number> {
  const [{ total }] = await db.select({ total: count() }).from(users).where(isNotNull(users.telegramChatId));
  return total;
}

/** The account a chat is connected to, for replying in its language. */
export async function accountOfChat(chatId: number): Promise<{ locale: string } | null> {
  const [row] = await db
    .select({ locale: users.locale })
    .from(users)
    .where(eq(users.telegramChatId, String(chatId)))
    .limit(1);
  return row ?? null;
}
