import type { Metadata } from "next";
import { getAdminI18n } from "@/modules/admin/i18n";
import { listStoreChoices } from "@/modules/admin/stores";
import { NewProductForm } from "@/components/admin/product-forms";
import { PageHeader } from "@/components/admin/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { a } = await getAdminI18n();
  return { title: a.products.new.title };
}

export default async function NewProductPage() {
  const { a, href } = await getAdminI18n();
  const stores = await listStoreChoices();
  return (
    <>
      <PageHeader
        title={a.products.new.title}
        intro={a.products.new.intro}
        back={{ href: href("/admin/products"), label: a.products.detail.back }}
      />
      <NewProductForm stores={stores} />
    </>
  );
}
