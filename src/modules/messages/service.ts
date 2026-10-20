import { and, asc, count, desc, eq, gt, inArray, isNotNull, ne, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import {
  conversationMessages,
  conversations,
  orderRequests,
  products,
  users,
  type Conversation,
  type ConversationDetails,
  type ConversationMessage,
  type ConversationStatus,
} from "@/db/schema";
import { detailLines } from "./details";
import { isUnread, MAX_MESSAGES_PER_HOUR, subjectOfRequest } from "./rules";

export const CONVERSATION_STATUSES: readonly ConversationStatus[] = ["waiting", "open", "closed"];
export const isConversationStatus = (value: unknown): value is ConversationStatus =>
  CONVERSATION_STATUSES.includes(value as ConversationStatus);

/** Something one side has not seen yet. */
const unreadByUser = sql`${conversations.lastAdminMessageAt} > coalesce(${conversations.userReadAt}, 'epoch'::timestamptz)`;
const unreadByAdmin = sql`${conversations.lastUserMessageAt} > coalesce(${conversations.adminReadAt}, 'epoch'::timestamptz)`;

export interface ConversationSummary {
  id: string;
  subject: string;
  status: ConversationStatus;
  lastMessageAt: Date;
  /** The newest message, shortened, and who wrote it. */
  preview: { body: string; sender: ConversationMessage["sender"] } | null;
  unread: boolean;
}

/** The product a person is writing about, by its page address. */
export async function productForMessage(slug: string): Promise<{ id: string; title: string; slug: string } | null> {
  const [row] = await db
    .select({ id: products.id, title: products.title, slug: products.slug })
    .from(products)
    .where(eq(products.slug, slug))
    .limit(1);
  return row ?? null;
}

/** False when the person sent too many messages in the last hour (checked in the database, so it holds across servers). */
export async function canSendMore(userId: string, now = new Date()): Promise<boolean> {
  const since = new Date(now.getTime() - 3_600_000).toISOString();
  const [row] = await db
    .select({ sent: count() })
    .from(conversationMessages)
    .innerJoin(conversations, eq(conversationMessages.conversationId, conversations.id))
    .where(
      and(
        eq(conversations.userId, userId),
        eq(conversationMessages.sender, "user"),
        gt(conversationMessages.createdAt, sql`${since}::timestamptz`),
      ),
    );
  return row.sent < MAX_MESSAGES_PER_HOUR;
}

/** The person's request still waiting for the team's first reply, if any: one at a time. */
export async function waitingRequestOf(userId: string): Promise<{ id: string; subject: string } | null> {
  const [row] = await db
    .select({ id: conversations.id, subject: conversations.subject })
    .from(conversations)
    .where(and(eq(conversations.userId, userId), eq(conversations.status, "waiting")))
    .orderBy(desc(conversations.createdAt))
    .limit(1);
  return row ?? null;
}

/** A new request, waiting for the team's first reply. The message may be empty when items are attached. */
export async function startConversation(
  userId: string,
  input: {
    body: string;
    contactPhone: string | null;
    city: string | null;
    details: ConversationDetails | null;
    /** The first attached product, linked from the admin panel. */
    product: { id: string; title: string; slug: string } | null;
  },
  now = new Date(),
): Promise<string> {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(conversations)
      .values({
        userId,
        subject: subjectOfRequest(input.body, detailLines(input.details)),
        status: "waiting",
        productId: input.product?.id ?? null,
        productTitle: input.product?.title ?? null,
        productSlug: input.product?.slug ?? null,
        contactPhone: input.contactPhone,
        city: input.city,
        details: input.details,
        createdAt: now,
        lastMessageAt: now,
        lastUserMessageAt: now,
        userReadAt: now,
      })
      .returning({ id: conversations.id });
    if (input.body) {
      await tx.insert(conversationMessages).values({ conversationId: created.id, sender: "user", body: input.body, createdAt: now });
    }
    return created.id;
  });
}

/**
 * Adds a message to a conversation. The writer has read everything up to it.
 * The team's reply accepts a waiting request (and reopens a closed one); the
 * person can only write in an open one (checked by the caller).
 */
export async function addMessage(
  conversationId: string,
  message: { sender: "user"; body: string } | { sender: "admin"; adminId: string; body: string },
  now = new Date(),
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(conversationMessages).values({
      conversationId,
      sender: message.sender,
      adminId: message.sender === "admin" ? message.adminId : null,
      body: message.body,
      createdAt: now,
    });
    await tx
      .update(conversations)
      .set(
        message.sender === "user"
          ? { lastMessageAt: now, lastUserMessageAt: now, userReadAt: now }
          : { lastMessageAt: now, lastAdminMessageAt: now, adminReadAt: now, status: "open" },
      )
      .where(eq(conversations.id, conversationId));
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The person's own conversation, or null when it is not theirs (or the id is not one). */
export async function getOwnConversation(userId: string, id: string): Promise<Conversation | null> {
  if (!UUID.test(id)) return null;
  const [row] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function getConversation(id: string): Promise<Conversation | null> {
  if (!UUID.test(id)) return null;
  const [row] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
  return row ?? null;
}

export interface ThreadMessage {
  id: string;
  sender: ConversationMessage["sender"];
  body: string;
  createdAt: Date;
  /** Admin panel only: who on the team wrote it. */
  adminEmail: string | null;
}

export async function listMessages(conversationId: string): Promise<ThreadMessage[]> {
  return db
    .select({
      id: conversationMessages.id,
      sender: conversationMessages.sender,
      body: conversationMessages.body,
      createdAt: conversationMessages.createdAt,
      adminEmail: users.email,
    })
    .from(conversationMessages)
    .leftJoin(users, eq(conversationMessages.adminId, users.id))
    .where(eq(conversationMessages.conversationId, conversationId))
    .orderBy(asc(conversationMessages.createdAt));
}

export async function markReadByUser(id: string, now = new Date()): Promise<void> {
  await db.update(conversations).set({ userReadAt: now }).where(eq(conversations.id, id));
}

export async function markReadByAdmin(id: string, now = new Date()): Promise<void> {
  await db.update(conversations).set({ adminReadAt: now }).where(eq(conversations.id, id));
}

export async function setConversationStatus(id: string, status: ConversationStatus): Promise<Conversation | null> {
  const [row] = await db.update(conversations).set({ status }).where(eq(conversations.id, id)).returning();
  return row ?? null;
}

/** The newest message of each conversation, for list previews. */
async function previews(ids: string[]): Promise<Map<string, ConversationSummary["preview"]>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .selectDistinctOn([conversationMessages.conversationId], {
      conversationId: conversationMessages.conversationId,
      body: conversationMessages.body,
      sender: conversationMessages.sender,
    })
    .from(conversationMessages)
    .where(inArray(conversationMessages.conversationId, ids))
    .orderBy(conversationMessages.conversationId, desc(conversationMessages.createdAt));
  return new Map(rows.map((row) => [row.conversationId, { body: row.body.slice(0, 160), sender: row.sender }]));
}

export async function listUserConversations(userId: string): Promise<ConversationSummary[]> {
  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(100);
  const last = await previews(rows.map((row) => row.id));
  return rows.map((row) => ({
    id: row.id,
    subject: row.subject,
    status: row.status,
    lastMessageAt: row.lastMessageAt,
    preview: last.get(row.id) ?? null,
    unread: isUnread(row.lastAdminMessageAt, row.userReadAt),
  }));
}

/** Conversations with a reply the person has not opened yet (the header badge). */
export async function countUnreadForUser(userId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(conversations)
    .where(and(eq(conversations.userId, userId), isNotNull(conversations.lastAdminMessageAt), unreadByUser));
  return row.total;
}

/** Conversations waiting for the team: a message nobody on the team has opened (the admin menu badge). */
export async function countUnreadForAdmins(): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(conversations)
    .where(and(isNotNull(conversations.lastUserMessageAt), unreadByAdmin));
  return row.total;
}

export const ADMIN_CONVERSATIONS_PAGE_SIZE = 30;

export interface AdminConversationRow extends ConversationSummary {
  /** A new request, or the person wrote after our last reply. */
  needsReply: boolean;
  customer: { id: string; name: string; email: string };
  contactPhone: string | null;
}

/**
 * What waits for the team: a new request, or an open conversation where the
 * person wrote after our last reply (read or not).
 */
const needsReply = sql`(${conversations.status} = 'waiting' or (${conversations.status} = 'open' and ${conversations.lastUserMessageAt} > coalesce(${conversations.lastAdminMessageAt}, 'epoch'::timestamptz)))`;

/**
 * For the admin inbox: unread first, then the most recent. The "waiting" tab
 * is everything that needs a reply (see needsReply), not only new requests.
 */
export async function listAdminConversations(
  status: ConversationStatus | undefined,
  page: number,
): Promise<{ rows: AdminConversationRow[]; total: number; byStatus: Record<ConversationStatus, number> }> {
  const where: SQL | undefined = status === "waiting" ? needsReply : status ? eq(conversations.status, status) : undefined;
  const [rows, [{ total }], counts, [waiting]] = await Promise.all([
    db
      .select({ conversation: conversations, name: users.fullName, email: users.email })
      .from(conversations)
      .innerJoin(users, eq(conversations.userId, users.id))
      .where(where)
      .orderBy(desc(sql`coalesce(${unreadByAdmin}, false)`), desc(conversations.lastMessageAt))
      .limit(ADMIN_CONVERSATIONS_PAGE_SIZE)
      .offset((page - 1) * ADMIN_CONVERSATIONS_PAGE_SIZE),
    db.select({ total: count() }).from(conversations).where(where),
    db.select({ status: conversations.status, total: count() }).from(conversations).groupBy(conversations.status),
    db.select({ total: count() }).from(conversations).where(needsReply),
  ]);
  const last = await previews(rows.map((row) => row.conversation.id));
  const byStatus: Record<ConversationStatus, number> = { waiting: 0, open: 0, closed: 0 };
  for (const row of counts) byStatus[row.status] = row.total;
  byStatus.waiting = waiting.total;

  return {
    rows: rows.map(({ conversation, name, email }) => ({
      id: conversation.id,
      subject: conversation.subject,
      status: conversation.status,
      lastMessageAt: conversation.lastMessageAt,
      preview: last.get(conversation.id) ?? null,
      unread: isUnread(conversation.lastUserMessageAt, conversation.adminReadAt),
      needsReply:
        conversation.status === "waiting" ||
        (conversation.status === "open" && isUnread(conversation.lastUserMessageAt, conversation.lastAdminMessageAt)),
      customer: { id: conversation.userId, name, email },
      contactPhone: conversation.contactPhone,
    })),
    total,
    byStatus,
  };
}

/** What the team needs to know about the person behind a conversation. */
export interface CustomerDetails {
  id: string;
  fullName: string;
  email: string;
  /** From the account; the conversation may carry a different one. */
  phone: string | null;
  locale: string;
  createdAt: Date;
  lastLoginAt: Date | null;
  telegramConnected: boolean;
  /** Their other conversations, newest first. */
  otherConversations: { id: string; subject: string; status: ConversationStatus; lastMessageAt: Date }[];
  orderRequests: number;
}

export async function getCustomerDetails(userId: string, exceptConversationId: string): Promise<CustomerDetails | null> {
  const [[user], others, [requests]] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)).limit(1),
    db
      .select({
        id: conversations.id,
        subject: conversations.subject,
        status: conversations.status,
        lastMessageAt: conversations.lastMessageAt,
      })
      .from(conversations)
      .where(and(eq(conversations.userId, userId), ne(conversations.id, exceptConversationId)))
      .orderBy(desc(conversations.lastMessageAt))
      .limit(10),
    db.select({ total: count() }).from(orderRequests).where(eq(orderRequests.userId, userId)),
  ]);
  if (!user) return null;
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    locale: user.locale,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    telegramConnected: user.telegramChatId !== null,
    otherConversations: others,
    orderRequests: requests.total,
  };
}

/** Admins to tell about a new message on Telegram: those who connected the bot. */
export async function adminTelegramChats(): Promise<{ chatId: string; locale: string }[]> {
  const rows = await db
    .select({ chatId: users.telegramChatId, locale: users.locale })
    .from(users)
    .where(and(eq(users.role, "admin"), isNotNull(users.telegramChatId)));
  return rows.flatMap((row) => (row.chatId ? [{ chatId: row.chatId, locale: row.locale }] : []));
}

/** The person's Telegram chat, if they connected one. */
export async function userTelegramChat(userId: string): Promise<{ chatId: string; locale: string } | null> {
  const [row] = await db
    .select({ chatId: users.telegramChatId, locale: users.locale })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.chatId ? { chatId: row.chatId, locale: row.locale } : null;
}
