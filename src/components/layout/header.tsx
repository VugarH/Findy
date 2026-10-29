import Link from "next/link";
import { BadgeCheck, Flame, Shield, User } from "lucide-react";
import { Suspense } from "react";
import { siteConfig } from "@/config/site";
import { orderedCategories } from "@/modules/settings/display-order";
import { getDisplayOrder } from "@/modules/settings/service";
import { getI18n } from "@/i18n/server";
import { isAdmin } from "@/modules/admin/guard";
import { countUnreadNotifications } from "@/modules/alerts/service";
import { countUnreadForAdmins, countUnreadForUser } from "@/modules/messages/service";
import { getCurrentUser } from "@/modules/auth/session";
import { marketDay, summarizeDigest } from "@/modules/digest/pick";
import { latestDigest } from "@/modules/digest/service";
import { channelUrl } from "@/modules/telegram/config";
import { CartLink } from "@/components/cart/cart-link";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { SearchBar } from "@/components/search/search-bar";
import { ButtonLink } from "@/components/ui/button";
import { HoverInfo } from "@/components/ui/hover-info";
import { Container } from "@/components/ui/container";
import { fmt } from "@/i18n/format";
import { CategorySlider } from "./category-slider";
import { LocaleSwitcher } from "./locale-switcher";
import { MessagesLink } from "@/components/messages/messages-link";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

export async function Header() {
  const { locale, t, href, market } = await getI18n();
  const user = await getCurrentUser();
  const [unread, unreadMessages, digest, order] = await Promise.all([
    user ? countUnreadNotifications(user.id) : 0,
    // Admins answer messages: their icon opens the inbox and counts what waits for the team.
    isAdmin(user) ? countUnreadForAdmins() : user ? countUnreadForUser(user.id) : 0,
    latestDigest(market.code),
    getDisplayOrder(),
  ]);
  const categories = orderedCategories(order);

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
          suggest={{ suggestions: t.search.suggestions, brand: t.search.suggestionBrand }}
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
          {/* Writing to us (and our replies); the badge counts conversations with an unread reply and keeps itself current. */}
          <MessagesLink
            href={href(isAdmin(user) ? "/admin/messages" : "/messages")}
            label={t.nav.messages}
            initial={unreadMessages}
            signedIn={user !== null}
          />
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
            // Icon only on small phones: the header row has no room for the text there.
            <ButtonLink href={href("/login")} size="sm" aria-label={t.auth.signIn} title={t.auth.signIn}>
              <User className="size-4" aria-hidden />
              <span className="hidden sm:inline">{t.auth.signIn}</span>
            </ButtonLink>
          )}
        </div>
      </Container>
      <Container>
        <nav className="-mx-1 flex items-center gap-1 pb-2 text-sm font-medium">
          <Link href={href("/deals")} className="shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-ink hover:bg-surface-2">
            {t.nav.deals}
          </Link>
          <HoverInfo info={fmt(t.fresh.navInfo, { days: market.deals.freshDrop.windowDays })}>
            <Link
              href={href("/fresh")}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-ink hover:bg-surface-2"
            >
              <BadgeCheck className="size-4 text-brand" aria-hidden />
              <span className="hidden sm:inline">{t.fresh.nav}</span>
              <span className="sm:hidden">{t.fresh.short}</span>
            </Link>
          </HoverInfo>
          <CategorySlider
            items={categories.map((category) => ({
              slug: category.slug,
              href: href(`/category/${category.slug}`),
              name: t.categories[category.slug].short,
            }))}
            allHref={href("/deals")}
            labels={{ previous: t.nav.scrollBack, next: t.nav.scrollMore }}
          />
          <Link
            href={href("/top")}
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-ink hover:bg-surface-2"
          >
            <Flame className="size-4 text-deal" aria-hidden />
            <span className="hidden sm:inline">{t.top.nav}</span>
            <span className="sm:hidden">{t.top.short}</span>
          </Link>
          <Link
            href={href("/ordering-abroad")}
            className="hidden shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-muted hover:bg-surface-2 hover:text-ink lg:block"
          >
            {t.order.navHelp}
          </Link>
        </nav>
      </Container>
    </header>
  );
}
