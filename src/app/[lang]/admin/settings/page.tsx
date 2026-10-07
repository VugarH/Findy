import type { Metadata } from "next";
import { getAdminI18n } from "@/modules/admin/i18n";
import { getFilterSwitches } from "@/modules/settings/service";
import { FilterSwitchesForm } from "@/components/admin/filter-switches-form";
import { PageHeader, Panel } from "@/components/admin/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { a } = await getAdminI18n();
  return { title: a.nav.settings };
}

/** Site-wide settings. New settings get their own panel here and a key in modules/settings. */
export default async function AdminSettingsPage() {
  const { a } = await getAdminI18n();
  const switches = await getFilterSwitches();
  return (
    <>
      <PageHeader title={a.nav.settings} intro={a.settings.intro} />
      <Panel title={a.settings.filtersTitle}>
        <p className="mb-4 max-w-2xl text-sm text-muted">{a.settings.filtersIntro}</p>
        <FilterSwitchesForm switches={switches} />
      </Panel>
    </>
  );
}
