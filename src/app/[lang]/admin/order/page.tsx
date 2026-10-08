import type { Metadata } from "next";
import { CATEGORY_SLUGS, type CategorySlug } from "@/config/categories";
import type { SubcategorySlug } from "@/config/subcategories";
import { getAdminI18n } from "@/modules/admin/i18n";
import { getOrderingCounts } from "@/modules/admin/ordering";
import { orderedCategorySlugs, orderedSubcategories } from "@/modules/settings/display-order";
import { getDisplayOrder } from "@/modules/settings/service";
import { DisplayOrderForm } from "@/components/admin/display-order-form";
import { PageHeader } from "@/components/admin/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { a } = await getAdminI18n();
  return { title: a.nav.order };
}

/** The order categories, types and brands are listed in on the site. */
export default async function AdminOrderPage() {
  const { a } = await getAdminI18n();
  const [order, counts] = await Promise.all([getDisplayOrder(), getOrderingCounts()]);
  const subcategories = Object.fromEntries(
    CATEGORY_SLUGS.map((slug) => [slug, orderedSubcategories(order, slug)]),
  ) as Record<CategorySlug, SubcategorySlug[]>;

  return (
    <>
      <PageHeader title={a.nav.order} intro={a.order.intro} />
      <DisplayOrderForm
        categories={orderedCategorySlugs(order)}
        subcategories={subcategories}
        brands={order.brands}
        counts={counts}
      />
    </>
  );
}
