"use client";

import { useActionState } from "react";
import { CircleCheck, CircleDot } from "lucide-react";
import { fmt } from "@/i18n/format";
import { publishDealsAction } from "@/modules/admin/actions/general";
import type { AdminFormState } from "@/modules/admin/forms";
import { useAdminT } from "./admin-i18n";
import { FormMessage, SubmitButton } from "./fields";

/**
 * Shows whether the deal pages are behind the changes made in the panel, and
 * rebuilds them on request.
 */
export function PublishBar({ pending, builtAt }: { pending: number; builtAt: string }) {
  const t = useAdminT();
  const [state, action] = useActionState<AdminFormState>(publishDealsAction, {});

  return (
    <div className="mb-6 space-y-2">
      <form
        action={action}
        className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-line bg-surface px-4 py-3"
      >
        {pending > 0 ? (
          <CircleDot className="size-4 shrink-0 text-deal" aria-hidden />
        ) : (
          <CircleCheck className="size-4 shrink-0 text-brand" aria-hidden />
        )}
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-semibold">
            {pending > 0 ? fmt(t.publish.pending, { count: pending }) : t.publish.upToDate}
          </span>
          <span className="ml-2 text-xs text-muted" title={t.publish.hint}>
            {fmt(t.publish.lastBuilt, { time: builtAt })}
          </span>
        </p>
        <SubmitButton size="sm" variant={pending > 0 ? "primary" : "secondary"} pendingLabel={t.publish.publishing}>
          {t.publish.button}
        </SubmitButton>
      </form>
      <FormMessage state={state} />
    </div>
  );
}
