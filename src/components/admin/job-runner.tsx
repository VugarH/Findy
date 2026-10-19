"use client";

import { Play } from "lucide-react";
import { startJobAction } from "@/modules/admin/actions/jobs";
import type { JobName } from "@/modules/admin/jobs";
import { useAdminT } from "./admin-i18n";
import { FormMessage, SubmitButton, useAdminForm } from "./fields";
import { filterControl } from "./ui";

/** One job's "Run now" button, with the store list for the daily job. */
export function JobRunner({ job, withStores }: { job: JobName; withStores: boolean }) {
  const a = useAdminT();
  const j = a.runs.jobs;
  const [state, action, round] = useAdminForm(startJobAction);

  return (
    <form key={round} action={action} className="space-y-2">
      <input type="hidden" name="job" value={job} />
      <div className="flex flex-wrap items-center gap-2">
        {withStores && (
          <input
            name="stores"
            defaultValue={state.values?.stores}
            placeholder={j.storesPlaceholder}
            aria-label={j.storesLabel}
            aria-invalid={state.errors?.stores ? true : undefined}
            className={`${filterControl} w-72 max-w-full`}
          />
        )}
        <SubmitButton pendingLabel={j.starting}>
          <Play className="size-4" aria-hidden />
          {j.run}
        </SubmitButton>
      </div>
      {state.errors?.stores && <p className="text-xs font-medium text-deal">{j.storesInvalid}</p>}
      <FormMessage state={state} />
    </form>
  );
}
