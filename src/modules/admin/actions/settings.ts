"use server";

import { refresh } from "next/cache";
import { FILTER_NAMES, type FilterSwitches } from "@/modules/settings/filter-switches";
import { toDisplayOrder } from "@/modules/settings/display-order";
import { getDisplayOrder, getFilterSwitches, saveDisplayOrder, saveFilterSwitches } from "@/modules/settings/service";
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

/**
 * Saves the order categories, types and brands are listed in on the site.
 * The form sends the whole order as JSON (field "order"); anything invalid is dropped.
 */
export async function saveDisplayOrderAction(_previous: AdminFormState, form: FormData): Promise<AdminFormState> {
  const admin = await requireAdmin();
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(form.get("order") ?? "{}"));
  } catch {
    return { formError: "invalid" };
  }
  const before = await getDisplayOrder();
  const order = toDisplayOrder(parsed);
  await saveDisplayOrder(order, admin.email);

  const changed = (["categories", "subcategories", "brands"] as const).filter(
    (part) => JSON.stringify(before[part]) !== JSON.stringify(order[part]),
  );
  if (changed.length > 0) {
    await recordAdminEvent(admin, {
      action: "settings.order",
      entityType: "settings",
      entityId: "display-order",
      entityLabel: "Display order",
      details: Object.fromEntries(
        changed.map((part) => [part, part === "subcategories" ? Object.keys(order.subcategories).join(", ") : order[part].join(", ")]),
      ),
    });
  }
  refresh();
  return { notice: "saved" };
}
