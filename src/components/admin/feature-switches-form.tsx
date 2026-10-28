"use client";

import { saveFeatureSwitchesAction } from "@/modules/admin/actions/settings";
import type { FeatureSwitches } from "@/modules/settings/features";
import { useAdminT } from "./admin-i18n";
import { CheckboxField, FormMessage, SubmitButton, useAdminForm } from "./fields";

/** Optional site features (modules/settings/features.ts). */
export function FeatureSwitchesForm({ switches }: { switches: FeatureSwitches }) {
  const t = useAdminT();
  const s = t.settings;
  const [state, action, round] = useAdminForm(saveFeatureSwitchesAction);

  return (
    <form key={round} action={action} className="space-y-4">
      <CheckboxField
        name="recommendations"
        defaultChecked={switches.recommendations}
        label={s.recommendations.label}
        hint={s.recommendations.hint}
      />
      <FormMessage state={state} />
      <SubmitButton pendingLabel={t.common.saving}>{t.common.save}</SubmitButton>
    </form>
  );
}
