import type { Metadata } from "next";
import { getAdminI18n } from "@/modules/admin/i18n";
import { getDealRules, getFilterSwitches } from "@/modules/settings/service";
import { DealRulesForm } from "@/components/admin/deal-rules-form";
import { FilterSwitchesForm } from "@/components/admin/filter-switches-form";
import { PageHeader, Panel } from "@/components/admin/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { a } = await getAdminI18n();
  return { title: a.nav.settings };
}

/** Site-wide settings. New settings get their own panel here and a key in modules/settings. */
export default async function AdminSettingsPage() {
  const { a } = await getAdminI18n();
  const [switches, rules] = await Promise.all([getFilterSwitches(), getDealRules()]);
  return (
    <>
      <PageHeader title={a.nav.settings} intro={a.settings.intro} />
      <Panel title={a.settings.filtersTitle}>
        <p className="mb-4 max-w-2xl text-sm text-muted">{a.settings.filtersIntro}</p>
        <FilterSwitchesForm switches={switches} />
      </Panel>
      <Panel title={a.settings.dealRulesTitle}>
        <p className="mb-4 max-w-2xl text-sm text-muted">{a.settings.dealRulesIntro}</p>
        <DealRulesForm rules={rules} />
      </Panel>
    </>
  );
}
