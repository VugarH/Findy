import type { Metadata } from "next";
import { getAdminI18n } from "@/modules/admin/i18n";
import { StoreForm } from "@/components/admin/store-form";
import { PageHeader } from "@/components/admin/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { a } = await getAdminI18n();
  return { title: a.stores.form.newTitle };
}

export default async function NewStorePage() {
  const { a, href } = await getAdminI18n();
  return (
    <>
      <PageHeader
        title={a.stores.form.newTitle}
        intro={a.stores.form.newIntro}
        back={{ href: href("/admin/stores"), label: a.stores.detail.back }}
      />
      <StoreForm />
    </>
  );
}
