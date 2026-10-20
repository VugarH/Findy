"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { MAX_MESSAGE_LENGTH } from "@/modules/messages/rules";
import { notifyUserOfReply } from "@/modules/messages/notify";
import { addMessage, getConversation, isConversationStatus, setConversationStatus } from "@/modules/messages/service";
import { loadMarket } from "@/modules/pricing/fx";
import { recordAdminEvent } from "../audit";
import { text, type AdminFormState } from "../forms";
import { requireAdmin } from "../guard";
import { log } from "@/modules/logs/logger";

/** Answers a person. They see it signed as the team; the panel keeps which admin wrote it. */
export async function adminReplyAction(previous: AdminFormState, form: FormData): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const body = text(form, "body");
  if (!body) return { errors: { body: "required" } };
  if (body.length > MAX_MESSAGE_LENGTH) return { errors: { body: "tooLong" }, values: { body } };
  const conversation = await getConversation(text(form, "id"));
  if (!conversation) return { formError: "notFound" };

  await addMessage(conversation.id, { sender: "admin", adminId: admin.id, body });
  const market = await loadMarket();
  after(() => notifyUserOfReply(conversation, body, market));
  await log.info("messages", "reply.sent", "The team replied", { userId: conversation.userId, conversationId: conversation.id, adminId: admin.id });
  refresh();
  return { notice: "sent", noticeVars: { at: Date.now() } };
}

/** Closes a handled conversation (the person can no longer write in it), or opens it again. */
export async function setConversationStatusAction(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const status = text(form, "status");
  // "waiting" is only ever set by a new request.
  if (!isConversationStatus(status) || status === "waiting") return;
  const conversation = await setConversationStatus(text(form, "id"), status);
  if (!conversation) return;
  await recordAdminEvent(admin, {
    action: "conversation.status",
    entityType: "conversation",
    entityId: conversation.id,
    entityLabel: conversation.subject,
    details: { status },
  });
  refresh();
}
