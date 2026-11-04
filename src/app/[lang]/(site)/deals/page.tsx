import type { Metadata } from "next";
import { pageAlternates } from "@/i18n/alternates";
import { getI18n } from "@/i18n/server";
import { DealsExplorer } from "@/components/deals/deals-explorer";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getI18n();
  return { title: t.filters.title, description: t.filters.subtitle, alternates: pageAlternates(locale, "/deals") };
}

export default async function DealsPage({ searchParams }: PageProps<"/[lang]/deals">) {
  const { t } = await getI18n();
  return (
    <DealsExplorer
      title={t.filters.title}
      subtitle={t.filters.subtitle}
      searchParams={await searchParams}
      basePath="/deals"
    />
  );
}
