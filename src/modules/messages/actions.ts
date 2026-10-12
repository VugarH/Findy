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
import { notifyAdminsOfMessage } from "./notify";
import { MAX_MESSAGE_LENGTH } from "./rules";
import { addMessage, canSendMore, getConversation, getOwnConversation, productForMessage, startConversation } from "./service";

export type MessageErrorKey = "bodyRequired" | "bodyLong" | "phoneInvalid" | "tooMany" | "signIn" | "notFound" | "unexpected";

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
  body,
  // Optional here: the conversation is the main way to reach the person.
  contactPhone: z
    .string()
    .transform((value) => normalizePhone(value))
    .refine((value) => value !== "", key("phoneInvalid")),
});

const firstIssue = (error: z.ZodError) => error.issues[0]?.message as MessageErrorKey;

/** Starts a conversation and opens it. */
export async function startConversationAction(_previous: MessageFormState, form: FormData): Promise<MessageFormState> {
  const text = (name: string) => String(form.get(name) ?? "");
  const values = { body: text("body"), contactPhone: text("contactPhone") };
  const locale = isLocale(text("locale")) ? (text("locale") as Parameters<typeof localePath>[0]) : DEFAULT_LOCALE;

  const user = await getCurrentUser();
  if (!user) return { error: "signIn", values };
  const parsed = startSchema.safeParse(values);
  if (!parsed.success) return { error: firstIssue(parsed.error), values };
  if (!(await canSendMore(user.id))) return { error: "tooMany", values };

  let id: string;
  try {
    const slug = text("product");
    const product = slug ? await productForMessage(slug) : null;
    id = await startConversation(user.id, { body: parsed.data.body, contactPhone: parsed.data.contactPhone, product });
    const conversation = await getConversation(id);
    const market = await loadMarket();
    if (conversation) after(() => notifyAdminsOfMessage(conversation, user.fullName, parsed.data.body, market));
  } catch (error) {
    console.error("Starting a conversation failed", error);
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
  const parsed = body.safeParse(values.body);
  if (!parsed.success) return { error: firstIssue(parsed.error), values };
  if (!(await canSendMore(user.id))) return { error: "tooMany", values };

  try {
    await addMessage(conversation.id, { sender: "user", body: parsed.data });
    const market = await loadMarket();
    after(() => notifyAdminsOfMessage(conversation, user.fullName, parsed.data, market));
  } catch (error) {
    console.error("Sending a message failed", error);
    return { error: "unexpected", values };
  }
  refresh();
  return { sent: (previous.sent ?? 0) + 1 };
}
