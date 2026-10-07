"use client";

import { RefreshCw, Send } from "lucide-react";
import { pickDigestAction, postDigestAction } from "@/modules/admin/actions/telegram";
import { useAdminT } from "./admin-i18n";
import { FormMessage, HiddenFields, SubmitButton, useAdminForm } from "./fields";

/** "Pick again" and "Post to the channel" for today's top deals. */
export function DigestControls({
  picked,
  posted,
  canPost,
}: {
  picked: boolean;
  posted: boolean;
  /** A channel is set. */
  canPost: boolean;
}) {
  const t = useAdminT().telegram;
  const [pickState, pickAction, pickRound] = useAdminForm(pickDigestAction);
  const [postState, postAction, postRound] = useAdminForm(postDigestAction);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {!posted && (
          <form key={`pick-${pickRound}`} action={pickAction}>
            <SubmitButton variant={picked ? "secondary" : "primary"} size="sm">
              <RefreshCw className="size-4" aria-hidden />
              {picked ? t.pickAgain : t.pick}
            </SubmitButton>
          </form>
        )}
        {picked && canPost && (
          <form key={`post-${postRound}`} action={postAction}>
            <HiddenFields values={{ again: posted ? "1" : undefined }} />
            <SubmitButton
              variant={posted ? "secondary" : "primary"}
              size="sm"
              confirm={posted ? t.confirmPostAgain : undefined}
            >
              <Send className="size-4" aria-hidden />
              {posted ? t.postAgain : t.post}
            </SubmitButton>
          </form>
        )}
      </div>
      <FormMessage state={pickState} />
      <FormMessage state={postState} />
    </div>
  );
}
