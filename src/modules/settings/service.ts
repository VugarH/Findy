import { eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db/client";
import { siteSettings } from "@/db/schema";
import { toDisplayOrder, type DisplayOrder } from "./display-order";
import { toFilterSwitches, type FilterSwitches } from "./filter-switches";

/** Settings stored in site_settings, by key. */
const FILTERS_KEY = "deal-filters";
const ORDER_KEY = "display-order";

async function read(key: string): Promise<unknown> {
  const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, key));
  return row?.value;
}

async function write(key: string, value: unknown, by: string): Promise<void> {
  await db
    .insert(siteSettings)
    .values({ key, value, updatedBy: by })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: new Date(), updatedBy: by } });
}

/** The deal-list filter switches. Read once per request. */
export const getFilterSwitches = cache(async (): Promise<FilterSwitches> => toFilterSwitches(await read(FILTERS_KEY)));

export async function saveFilterSwitches(switches: FilterSwitches, by: string): Promise<void> {
  await write(FILTERS_KEY, toFilterSwitches(switches), by);
}

/** The order categories, types and brands are listed in. Read once per request. */
export const getDisplayOrder = cache(async (): Promise<DisplayOrder> => toDisplayOrder(await read(ORDER_KEY)));

export async function saveDisplayOrder(order: DisplayOrder, by: string): Promise<void> {
  await write(ORDER_KEY, toDisplayOrder(order), by);
}
