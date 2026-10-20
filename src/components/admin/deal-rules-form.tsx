"use client";

import { saveDealRulesAction } from "@/modules/admin/actions/settings";
import type { DealRules } from "@/modules/settings/deal-rules";
import { useAdminT } from "./admin-i18n";
import { CheckboxField, FormMessage, SubmitButton, useAdminForm } from "./fields";

/** Which discounts count as deals (modules/settings/deal-rules.ts). */
export function DealRulesForm({ rules }: { rules: DealRules }) {
  const t = useAdminT();
  const s = t.settings;
  const [state, action, round] = useAdminForm(saveDealRulesAction);

  return (
    <form key={round} action={action} className="space-y-4">
      <CheckboxField
        name="keepStoreClaims"
        defaultChecked={rules.keepStoreClaims}
        label={s.keepStoreClaims.label}
        hint={s.keepStoreClaims.hint}
      />
      <FormMessage state={state} />
      <SubmitButton pendingLabel={t.common.saving}>{t.common.save}</SubmitButton>
    </form>
  );
}
