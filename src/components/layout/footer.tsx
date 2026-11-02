import Link from "next/link";
import { siteConfig } from "@/config/site";
import { getI18n } from "@/i18n/server";
import { orderedCategories } from "@/modules/settings/display-order";
import { getDisplayOrder } from "@/modules/settings/service";
import { channelUrl } from "@/modules/telegram/config";
import { Container } from "@/components/ui/container";
import { Logo } from "./logo";

export async function Footer() {
  const { t, href } = await getI18n();
  const channel = channelUrl();
  const categories = orderedCategories(await getDisplayOrder());

  return (
    // Phones: room for the bottom bar below it.
    <footer className="mt-10 border-t border-line bg-surface max-md:pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:mt-20">
      <Container className="flex flex-col gap-6 py-6 md:flex-row md:justify-between md:gap-8 md:py-10">
        <div className="max-w-sm space-y-3">
          <Logo href={href("/")} />
          <p className="text-sm text-muted">{t.footer.tagline}</p>
        </div>
        <nav className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:flex md:flex-col">
          <Link href={href("/deals")} className="font-semibold text-ink hover:underline">
            {t.nav.deals}
          </Link>
          <Link href={href("/top")} className="font-semibold text-ink hover:underline">
            {t.top.nav}
          </Link>
          {categories.map((category) => (
            <Link key={category.slug} href={href(`/category/${category.slug}`)} className="text-muted hover:text-ink">
              {t.categories[category.slug].name}
            </Link>
          ))}
          <Link href={href("/cart")} className="text-muted hover:text-ink">
            {t.cart.nav}
          </Link>
          <Link href={href("/alerts")} className="text-muted hover:text-ink">
            {t.alerts.nav}
          </Link>
          <Link href={href("/messages")} className="text-muted hover:text-ink">
            {t.nav.messages}
          </Link>
          {channel && (
            <a href={channel} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-ink">
              {t.notifications.channel}
            </a>
          )}
          <Link href={href("/ordering-abroad")} className="text-muted hover:text-ink">
            {t.order.navHelp}
          </Link>
          <Link href={href("/stores")} className="text-muted hover:text-ink">
            {t.nav.stores}
          </Link>
        </nav>
      </Container>
      <Container className="border-t border-line py-5 text-xs text-muted">
        <p>{t.footer.disclaimer}</p>
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          <span>
            © {new Date().getFullYear()} {siteConfig.name}
          </span>
          <Link href={href("/terms")} className="hover:text-ink">
            {t.footer.terms}
          </Link>
          <Link href={href("/privacy")} className="hover:text-ink">
            {t.footer.privacy}
          </Link>
        </p>
      </Container>
    </footer>
  );
}
