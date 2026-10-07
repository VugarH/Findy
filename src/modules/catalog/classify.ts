import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { products } from "@/db/schema";
import { reclassify } from "./placement";

/**
 * Applies the current subcategory and audience rules to every product and
 * saves what changed. Runs in the daily job, so editing a rule fixes old
 * products too. Fields set by hand in the admin panel are left alone.
 */
export async function classifyProducts(): Promise<number> {
  const rows = await db
    .select({
      id: products.id,
      title: products.title,
      categorySlug: products.categorySlug,
      sourceType: products.sourceType,
      subcategorySlug: products.subcategorySlug,
      audience: products.audience,
      lockedFields: products.lockedFields,
    })
    .from(products);

  const changes = new Map<string, string[]>();
  const audienceChanges = new Map<string | null, string[]>();
  for (const row of rows) {
    const next = reclassify(row);
    if (next.subcategorySlug) changes.set(next.subcategorySlug, [...(changes.get(next.subcategorySlug) ?? []), row.id]);
    if (next.audience !== undefined) audienceChanges.set(next.audience, [...(audienceChanges.get(next.audience) ?? []), row.id]);
  }

  let changed = 0;
  for (const [subcategorySlug, ids] of changes) {
    for (let i = 0; i < ids.length; i += 5000) {
      const batch = ids.slice(i, i + 5000);
      await db.update(products).set({ subcategorySlug }).where(inArray(products.id, batch));
      changed += batch.length;
    }
  }
  for (const [audience, ids] of audienceChanges) {
    for (let i = 0; i < ids.length; i += 5000) {
      await db.update(products).set({ audience }).where(inArray(products.id, ids.slice(i, i + 5000)));
    }
  }
  return changed;
}
