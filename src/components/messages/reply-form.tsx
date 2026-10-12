"use client";

import { useActionState } from "react";
import { useI18n } from "@/i18n/client";
import { sendMessageAction, type MessageFormState } from "@/modules/messages/actions";
import { MAX_MESSAGE_LENGTH } from "@/modules/messages/rules";
import { Composer } from "./composer";

const INITIAL: MessageFormState = {};

/** The person's reply box in their conversation. */
export function ReplyForm({ conversationId }: { conversationId: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(sendMessageAction, INITIAL);
  const m = t.messages;
  return (
    <Composer
      key={state.sent ?? 0}
      action={action}
      pending={pending}
      fields={{ id: conversationId }}
      label={m.replyPlaceholder}
      placeholder={m.replyPlaceholder}
      sendLabel={pending ? m.sending : m.send}
      hint={m.sendHint}
      error={state.error ? m.errors[state.error] : undefined}
      defaultValue={state.values?.body}
      maxLength={MAX_MESSAGE_LENGTH}
    />
  );
}
