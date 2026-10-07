import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ExternalLink } from "lucide-react";
import { getAdminDictionary } from "@/i18n/dictionaries/admin";
import { getI18n } from "@/i18n/server";
import { unpublishedChanges } from "@/modules/admin/audit";
import { requireAdminPage } from "@/modules/admin/guard";
import { getAdminI18n } from "@/modules/admin/i18n";
import { countNewOrders } from "@/modules/admin/orders";
import { countFailingStores } from "@/modules/admin/stores";
import { AdminI18nProvider } from "@/components/admin/admin-i18n";
import { AdminNav } from "@/components/admin/admin-nav";
import { PublishBar } from "@/components/admin/publish-bar";
import { Badge } from "@/components/admin/ui";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  const a = getAdminDictionary(locale);
  return { title: { default: a.title, template: `%s · ${a.title}` }, robots: { index: false, follow: false } };
}

/** The admin panel's frame. Only admins get past requireAdminPage(); to everyone else the panel does not exist. */
export default async function AdminLayout({ children }: LayoutProps<"/[lang]/admin">) {
  const user = await requireAdminPage();
  const { a, t, href, locale, dateTime } = await getAdminI18n();
  const [unpublished, failingStores, newOrders] = await Promise.all([
    unpublishedChanges(),
    countFailingStores(),
    countNewOrders(),
  ]);

  return (
    <AdminI18nProvider t={a}>
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Logo href={href("/admin")} />
          <Badge tone="strong">{a.title}</Badge>
          <div className="ml-auto flex items-center gap-2">
            <Suspense>
              <LocaleSwitcher current={locale} label={t.nav.language} />
            </Suspense>
            <ThemeToggle label={t.nav.theme} />
            <Link
              href={href("/")}
              className="hidden h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted hover:bg-surface-2 hover:text-ink sm:flex"
            >
              <ExternalLink className="size-4" aria-hidden />
              {a.nav.backToSite}
            </Link>
            <span className="hidden max-w-48 truncate text-xs text-muted md:inline" title={user.email}>
              {user.email}
            </span>
          </div>
        </div>
      </header>
      <div className="mx-auto grid w-full max-w-[1400px] flex-1 grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <AdminNav badges={{ stores: failingStores, orders: newOrders }} />
        </aside>
        <main className="min-w-0">
          <PublishBar pending={unpublished.count} builtAt={dateTime(unpublished.publishedAt)} />
          {children}
        </main>
      </div>
    </AdminI18nProvider>
  );
}
