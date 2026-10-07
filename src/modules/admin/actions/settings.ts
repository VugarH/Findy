"use server";

import { refresh } from "next/cache";
import { FILTER_NAMES, type FilterSwitches } from "@/modules/settings/filter-switches";
import { getFilterSwitches, saveFilterSwitches } from "@/modules/settings/service";
import { recordAdminEvent } from "../audit";
import { checked, type AdminFormState } from "../forms";
import { requireAdmin } from "../guard";

/** Switches the deal-list filters on or off for every visitor. */
export async function saveFilterSwitchesAction(_previous: AdminFormState, form: FormData): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const before = await getFilterSwitches();
  const switches = Object.fromEntries(FILTER_NAMES.map((name) => [name, checked(form, name)])) as FilterSwitches;
  await saveFilterSwitches(switches, admin.email);

  const changed = FILTER_NAMES.filter((name) => before[name] !== switches[name]);
  if (changed.length > 0) {
    await recordAdminEvent(admin, {
      action: "settings.filters",
      entityType: "settings",
      entityId: "deal-filters",
      entityLabel: "Deal filters",
      details: Object.fromEntries(changed.map((name) => [name, switches[name] ? "on" : "off"])),
    });
  }
  refresh();
  return { notice: "saved" };
}
