import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { galleryImages } from "@/config/images";
import { db } from "@/db/client";
import { offers } from "@/db/schema";

/**
 * A product page's photos (config/images.ts `galleryImages`): the product's main
 * photo, then the other photos of the store it came from (else of the store seen
 * most recently). Read only here, so the daily rebuild never loads them.
 */
export async function productGallery(productId: string, mainImage: string | null): Promise<string[]> {
  // Photos are extra: if they can't be read (e.g. before the migration has run), the main photo alone still shows.
  const rows = await db
    .select({ images: offers.images })
    .from(offers)
    .where(and(eq(offers.productId, productId), isNotNull(offers.images), isNull(offers.removedAt)))
    .orderBy(desc(offers.lastSeenAt))
    .limit(10)
    .catch(() => []);
  const lists = rows.map((row) => row.images ?? []);
  const source = lists.find((list) => mainImage && list.includes(mainImage)) ?? lists[0] ?? [];
  return galleryImages(mainImage, source);
}
