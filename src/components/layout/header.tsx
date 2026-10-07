import Link from "next/link";
import { Flame, Shield, User } from "lucide-react";
import { Suspense } from "react";
import { CATEGORIES } from "@/config/categories";
import { siteConfig } from "@/config/site";
import { getI18n } from "@/i18n/server";
import { isAdmin } from "@/modules/admin/guard";
import { countUnreadNotifications } from "@/modules/alerts/service";
import { getCurrentUser } from "@/modules/auth/session";
import { marketDay, summarizeDigest } from "@/modules/digest/pick";
import { latestDigest } from "@/modules/digest/service";
import { channelUrl } from "@/modules/telegram/config";
import { CartLink } from "@/components/cart/cart-link";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { SearchBar } from "@/components/search/search-bar";
import { ButtonLink } from "@/components/ui/button";
import { CategoryIcon } from "@/components/ui/category-icon";
import { Container } from "@/components/ui/container";
import { CategoryMenu } from "./category-menu";
import { LocaleSwitcher } from "./locale-switcher";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

export async function Header() {
  const { locale, t, href, market } = await getI18n();
  const user = await getCurrentUser();
  const [unread, digest] = await Promise.all([
    user ? countUnreadNotifications(user.id) : 0,
    latestDigest(market.code),
  ]);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
      {siteConfig.demoData && (
        <p className="bg-ink px-4 py-1.5 text-center text-xs font-medium text-bg">{t.demoBanner}</p>
      )}
      <Container className="flex flex-wrap items-center gap-x-4 gap-y-3 py-3">
        <Logo href={href("/")} />
        <SearchBar
          action={href("/search")}
          placeholder={t.search.placeholder}
          buttonLabel={t.search.button}
          className="order-last basis-full md:order-none md:flex-1 md:basis-0"
        />
        {/* relative: the notification list opens below this group, aligned to its right edge. */}
        <div className="relative ml-auto flex items-center gap-2">
          <Suspense>
            <LocaleSwitcher current={locale} label={t.nav.language} />
          </Suspense>
          <ThemeToggle label={t.nav.theme} />
          {isAdmin(user) && (
            <Link
              href={href("/admin")}
              title={t.nav.admin}
              aria-label={t.nav.admin}
              className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <Shield className="size-[18px]" aria-hidden />
            </Link>
          )}
          <CartLink />
          <NotificationBell
            signedIn={user !== null}
            unread={unread}
            digest={digest && summarizeDigest(digest, marketDay(new Date(), market.timeZone))}
            channelUrl={channelUrl()}
          />
          {user ? (
            <Link
              href={href("/account")}
              title={t.auth.account}
              className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface pl-1 pr-3 text-sm font-semibold text-ink hover:bg-surface-2"
            >
              <span className="grid size-7 place-items-center rounded-full bg-brand text-xs font-bold text-on-brand">
                {user.fullName.trim().charAt(0).toUpperCase()}
              </span>
              <span className="hidden max-w-28 truncate sm:inline">{user.fullName.trim().split(/\s+/)[0]}</span>
            </Link>
          ) : (
            <ButtonLink href={href("/login")} size="sm">
              <User className="size-4" aria-hidden />
              {t.auth.signIn}
            </ButtonLink>
          )}
        </div>
      </Container>
      <Container>
        <nav className="-mx-1 flex items-center gap-1 pb-2 text-sm font-medium">
          <Link href={href("/deals")} className="shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-ink hover:bg-surface-2">
            {t.nav.deals}
          </Link>
          <Link
            href={href("/top")}
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-ink hover:bg-surface-2"
          >
            <Flame className="size-4 text-deal" aria-hidden />
            <span className="hidden sm:inline">{t.top.nav}</span>
            <span className="sm:hidden">{t.top.short}</span>
          </Link>
          <CategoryMenu
            label={t.nav.allCategories}
            items={CATEGORIES.map((category) => ({
              slug: category.slug,
              href: href(`/category/${category.slug}`),
              name: t.categories[category.slug].name,
              description: t.categories[category.slug].description,
            }))}
            extras={[
              { href: href("/ordering-abroad"), label: t.order.navHelp },
              { href: href("/stores"), label: t.nav.stores },
            ]}
          />
          {/* Quick links; the menu above lists every category, so these may scroll. */}
          <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {CATEGORIES.map((category) => (
              <Link
                key={category.slug}
                href={href(`/category/${category.slug}`)}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-muted hover:bg-surface-2 hover:text-ink"
              >
                <CategoryIcon category={category.slug} className="size-4" />
                {t.categories[category.slug].short}
              </Link>
            ))}
          </div>
          <Link
            href={href("/ordering-abroad")}
            className="hidden shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-muted hover:bg-surface-2 hover:text-ink lg:block"
          >
            {t.order.navHelp}
          </Link>
          <Link
            href={href("/stores")}
            className="hidden shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-muted hover:bg-surface-2 hover:text-ink lg:block"
          >
            {t.nav.stores}
          </Link>
        </nav>
      </Container>
    </header>
  );
}
