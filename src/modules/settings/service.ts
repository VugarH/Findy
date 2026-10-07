import { eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db/client";
import { siteSettings } from "@/db/schema";
import { toFilterSwitches, type FilterSwitches } from "./filter-switches";

/** Settings stored in site_settings, by key. */
const FILTERS_KEY = "deal-filters";

/** The deal-list filter switches. Read once per request. */
export const getFilterSwitches = cache(async (): Promise<FilterSwitches> => {
  const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, FILTERS_KEY));
  return toFilterSwitches(row?.value);
});

export async function saveFilterSwitches(switches: FilterSwitches, by: string): Promise<void> {
  const value = toFilterSwitches(switches);
  await db
    .insert(siteSettings)
    .values({ key: FILTERS_KEY, value, updatedBy: by })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: new Date(), updatedBy: by } });
}
