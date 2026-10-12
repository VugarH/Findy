"use client";

import { useActionState } from "react";
import { adminReplyAction } from "@/modules/admin/actions/messages";
import type { AdminFormState } from "@/modules/admin/forms";
import { MAX_MESSAGE_LENGTH } from "@/modules/messages/rules";
import { Composer } from "@/components/messages/composer";
import { useAdminT } from "./admin-i18n";

const INITIAL: AdminFormState = {};

/** The team's reply box. The person sees the reply signed "Admin". */
export function AdminReplyForm({ conversationId }: { conversationId: string }) {
  const a = useAdminT();
  const [state, action, pending] = useActionState(adminReplyAction, INITIAL);
  const errorKey = state.formError ?? state.errors?.body;
  return (
    <Composer
      key={String(state.noticeVars?.at ?? 0)}
      action={action}
      pending={pending}
      fields={{ id: conversationId }}
      label={a.messages.replyLabel}
      placeholder={a.messages.replyPlaceholder}
      sendLabel={a.messages.send}
      hint={a.messages.replyLabel}
      error={errorKey ? a.errors[errorKey] : undefined}
      defaultValue={state.values?.body}
      maxLength={MAX_MESSAGE_LENGTH}
    />
  );
}
