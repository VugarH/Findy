"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";
import { localePath } from "@/i18n/format";
import { getCurrentUser } from "@/modules/auth/session";
import { normalizePhone } from "@/modules/auth/validation";
import { loadMarket } from "@/modules/pricing/fx";
import { sanitizeCart } from "@/modules/cart/items";
import type { CartView } from "@/modules/cart/plan";
import { loadCart } from "@/modules/cart/service";
import { serviceFeeMinor } from "@/modules/orders/pricing";
import { detailLines, requestDetails } from "./details";
import { notifyAdminsOfMessage } from "./notify";
import { MAX_MESSAGE_LENGTH, personCanWrite } from "./rules";
import { addMessage, canSendMore, getConversation, getOwnConversation, startConversation, waitingRequestOf } from "./service";
import { log } from "@/modules/logs/logger";

export type MessageErrorKey =
  | "bodyRequired"
  | "bodyLong"
  | "phoneInvalid"
  | "cityLong"
  | "tooMany"
  | "waiting"
  | "notOpen"
  | "signIn"
  | "notFound"
  | "unexpected";

/** Longest city or district name. */
const MAX_CITY_LENGTH = 80;

export interface MessageFormState {
  error?: MessageErrorKey;
  /** What was typed, so a failed send does not wipe it. */
  values?: Record<string, string>;
  /** Bumped on every successful send: the form resets when it changes. */
  sent?: number;
}

const key = (value: MessageErrorKey) => value;

const body = z.string().trim().min(1, key("bodyRequired")).max(MAX_MESSAGE_LENGTH, key("bodyLong"));

const startSchema = z.object({
  // May be empty when items are attached (checked below).
  body: z.string().trim().max(MAX_MESSAGE_LENGTH, key("bodyLong")),
  city: z.string().trim().max(MAX_CITY_LENGTH, key("cityLong")),
  // Optional here: the conversation is the main way to reach the person.
  contactPhone: z
    .string()
    .transform((value) => normalizePhone(value))
    .refine((value) => value !== "", key("phoneInvalid")),
});

const firstIssue = (error: z.ZodError) => error.issues[0]?.message as MessageErrorKey;

/**
 * Sends a new request and opens it. Items attached from a product page or the
 * cart come as offer ids and quantities; they are priced here, with today's
 * offers, and saved with the request. One request may wait for a reply at a time.
 */
export async function startConversationAction(_previous: MessageFormState, form: FormData): Promise<MessageFormState> {
  const text = (name: string) => String(form.get(name) ?? "");
  const values = { body: text("body"), contactPhone: text("contactPhone"), city: text("city"), items: text("items") };
  const locale = isLocale(text("locale")) ? (text("locale") as Parameters<typeof localePath>[0]) : DEFAULT_LOCALE;

  const user = await getCurrentUser();
  if (!user) return { error: "signIn", values };
  const parsed = startSchema.safeParse(values);
  if (!parsed.success) return { error: firstIssue(parsed.error), values };
  if (await waitingRequestOf(user.id)) return { error: "waiting", values };
  if (!(await canSendMore(user.id))) return { error: "tooMany", values };

  let id: string;
  try {
    let items: unknown = [];
    try {
      items = JSON.parse(values.items || "[]");
    } catch {
      // Not ours: no items.
    }
    const market = await loadMarket();
    const cart = sanitizeCart(items);
    const plan = cart.length ? await loadCart(market, cart) : null;
    const details = plan ? requestDetails(plan, market) : null;
    if (!parsed.data.body && !details) return { error: "bodyRequired", values };
    const first = plan?.parcels[0]?.lines[0]?.product;

    id = await startConversation(user.id, {
      body: parsed.data.body,
      contactPhone: parsed.data.contactPhone,
      city: parsed.data.city || null,
      details,
      product: first ? { id: first.productId, title: first.title, slug: first.slug } : null,
    });
    const conversation = await getConversation(id);
    const summary = parsed.data.body || detailLines(details).map((line) => `${line.quantity} × ${line.title}`).join("\n");
    if (conversation) after(() => notifyAdminsOfMessage(conversation, user.fullName, summary, market));
    await log.info("messages", "conversation.started", "A person sent a request", {
      userId: user.id,
      conversationId: id,
      items: detailLines(details).length,
      withPhone: parsed.data.contactPhone !== null,
    });
  } catch (error) {
    await log.error("messages", "start.failed", "Starting a conversation failed", { error, userId: user.id });
    return { error: "unexpected", values };
  }
  redirect(localePath(locale, `/messages/${id}`));
}

/** The person writes again in one of their conversations. */
export async function sendMessageAction(previous: MessageFormState, form: FormData): Promise<MessageFormState> {
  const values = { body: String(form.get("body") ?? "") };
  const user = await getCurrentUser();
  if (!user) return { error: "signIn", values };
  const conversation = await getOwnConversation(user.id, String(form.get("id") ?? ""));
  if (!conversation) return { error: "notFound", values };
  // Waiting for the team's first reply, or closed: nothing more to add here.
  if (!personCanWrite(conversation.status)) return { error: "notOpen", values };
  const parsed = body.safeParse(values.body);
  if (!parsed.success) return { error: firstIssue(parsed.error), values };
  if (!(await canSendMore(user.id))) return { error: "tooMany", values };

  try {
    await addMessage(conversation.id, { sender: "user", body: parsed.data });
    const market = await loadMarket();
    after(() => notifyAdminsOfMessage(conversation, user.fullName, parsed.data, market));
    await log.info("messages", "message.sent", "A person wrote in a conversation", { userId: user.id, conversationId: conversation.id });
  } catch (error) {
    await log.error("messages", "send.failed", "Sending a message failed", { error, userId: user.id, conversationId: conversation.id });
    return { error: "unexpected", values };
  }
  refresh();
  return { sent: (previous.sent ?? 0) + 1 };
}

/**
 * Prices items being attached to a request (from a product page or the
 * cart), with our service fee on top. Open to everyone: it only reads.
 */
export async function priceRequestItemsAction(items: unknown): Promise<{ view: CartView; feeMinor: number }> {
  const market = await loadMarket();
  const view = await loadCart(market, sanitizeCart(items));
  return { view, feeMinor: view.parcels.length ? serviceFeeMinor(view.totalMinor, market) : 0 };
}
