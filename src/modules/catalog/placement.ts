import { detectAudience, type Audience } from "@/config/audience";
import { definiteCategory, isCategorySlug, type CategorySlug } from "@/config/categories";
import { classifyProduct, type SubcategorySlug } from "@/config/subcategories";
import { isLocked, withLocks, withoutLocks } from "./locks";

/**
 * Where a product sits — category, subcategory, who it is for — decided by
 * the rules in config/ unless a person set it by hand (a locked field, see
 * ./locks.ts). Pure functions: the daily job and the admin panel both use
 * them, and they are tested without a database.
 */

/** "auto" hands a field back to the rules; "none" (audience only) says the product is for no one in particular. */
export type SubcategoryChoice = SubcategorySlug | "auto";
export type AudienceChoice = Audience | "auto" | "none";

interface ClassifiableProduct {
  title: string;
  brand: string | null;
  categorySlug: string;
  sourceType: string | null;
  subcategorySlug: string;
  audience: string | null;
  lockedFields: string[];
}

/**
 * What the rules say a product's category, subcategory and audience should be,
 * or undefined for a field that stays as it is — because it is already right
 * or because someone set it by hand (a locked field). The category moves only
 * when the title clearly names another kind of product (`definiteCategory`):
 * sunglasses sold by a jewelry store go to sunglasses.
 */
export function reclassify(product: ClassifiableProduct): {
  categorySlug?: CategorySlug;
  subcategorySlug?: SubcategorySlug;
  audience?: Audience | null;
} {
  const result: { categorySlug?: CategorySlug; subcategorySlug?: SubcategorySlug; audience?: Audience | null } = {};
  if (isCategorySlug(product.categorySlug) && !isLocked(product.lockedFields, "subcategorySlug")) {
    let category: CategorySlug = product.categorySlug;
    // A hand-picked subcategory pins its category too.
    const moved = isLocked(product.lockedFields, "categorySlug") ? null : definiteCategory(category, product.title);
    if (moved) category = result.categorySlug = moved;
    const next = classifyProduct(category, product.title, product.sourceType);
    if (next !== product.subcategorySlug) result.subcategorySlug = next;
  }
  if (!isLocked(product.lockedFields, "audience")) {
    const next = detectAudience(`${product.title} ${product.sourceType ?? ""}`, product.brand);
    if (next !== product.audience) result.audience = next;
  }
  return result;
}

interface Placement {
  categorySlug: CategorySlug;
  subcategorySlug: string;
  audience: string | null;
  lockedFields: string[];
}

/**
 * Where a product ends up after a person picks its category, subcategory and
 * audience. An explicit choice is locked; "auto" unlocks the field and asks
 * the rules.
 */
export function resolvePlacement(
  current: Placement & { title: string; brand?: string | null; sourceType: string | null },
  choice: { categorySlug: CategorySlug; subcategory?: SubcategoryChoice; audience?: AudienceChoice },
): Placement {
  let locks = current.lockedFields;
  const categoryChanged = choice.categorySlug !== current.categorySlug;
  if (categoryChanged) locks = withLocks(locks, ["categorySlug"]);

  let subcategorySlug = current.subcategorySlug;
  // A new category needs a subcategory of its own: the rules pick one unless a person did.
  if (choice.subcategory === "auto" || (choice.subcategory === undefined && categoryChanged)) {
    locks = withoutLocks(locks, ["subcategorySlug"]);
    subcategorySlug = classifyProduct(choice.categorySlug, current.title, current.sourceType);
  } else if (choice.subcategory !== undefined) {
    locks = withLocks(locks, ["subcategorySlug"]);
    subcategorySlug = choice.subcategory;
  }

  let audience = current.audience;
  if (choice.audience === "auto") {
    locks = withoutLocks(locks, ["audience"]);
    audience = detectAudience(`${current.title} ${current.sourceType ?? ""}`, current.brand);
  } else if (choice.audience !== undefined) {
    locks = withLocks(locks, ["audience"]);
    audience = choice.audience === "none" ? null : choice.audience;
  }

  return { categorySlug: choice.categorySlug, subcategorySlug, audience, lockedFields: locks };
}
