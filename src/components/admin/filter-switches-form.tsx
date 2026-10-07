"use client";

import { saveFilterSwitchesAction } from "@/modules/admin/actions/settings";
import { FILTER_NAMES, type FilterSwitches } from "@/modules/settings/filter-switches";
import { useAdminT } from "./admin-i18n";
import { CheckboxField, FormMessage, SubmitButton, useAdminForm } from "./fields";

/** One tick box per deal-list filter; saving applies to every visitor at once. */
export function FilterSwitchesForm({ switches }: { switches: FilterSwitches }) {
  const t = useAdminT();
  const s = t.settings;
  const [state, action, round] = useAdminForm(saveFilterSwitchesAction);

  return (
    <form key={round} action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {FILTER_NAMES.map((name) => (
          <CheckboxField
            key={name}
            name={name}
            defaultChecked={switches[name]}
            label={s.filters[name].label}
            hint={s.filters[name].hint}
          />
        ))}
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingLabel={t.common.saving}>{t.common.save}</SubmitButton>
    </form>
  );
}
