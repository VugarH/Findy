import Link from "next/link";
import { CATEGORIES } from "@/config/categories";
import { siteConfig } from "@/config/site";
import { getI18n } from "@/i18n/server";
import { channelUrl } from "@/modules/telegram/config";
import { Container } from "@/components/ui/container";
import { Logo } from "./logo";

export async function Footer() {
  const { t, href } = await getI18n();
  const channel = channelUrl();

  return (
    <footer className="mt-20 border-t border-line bg-surface">
      <Container className="flex flex-col gap-8 py-10 md:flex-row md:justify-between">
        <div className="max-w-sm space-y-3">
          <Logo href={href("/")} />
          <p className="text-sm text-muted">{t.footer.tagline}</p>
        </div>
        <nav className="flex flex-col gap-2 text-sm">
          <Link href={href("/deals")} className="font-semibold text-ink hover:underline">
            {t.nav.deals}
          </Link>
          <Link href={href("/top")} className="font-semibold text-ink hover:underline">
            {t.top.nav}
          </Link>
          {CATEGORIES.map((category) => (
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
        <p className="mt-1">
          © {new Date().getFullYear()} {siteConfig.name}
        </p>
      </Container>
    </footer>
  );
}
