import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles, TrendingDown } from "lucide-react";
import type { CategorySlug } from "@/config/categories";
import { LOCALE_TAGS } from "@/i18n/config";
import { fmt } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { dropPercent } from "@/modules/alerts/detect";
import { listNotifications, listWatches } from "@/modules/alerts/service";
import { getCurrentUser } from "@/modules/auth/session";
import { listFollows } from "@/modules/follows/service";
import { telegramEnabled } from "@/modules/telegram/config";
import { telegramLinkOf } from "@/modules/telegram/link";
import { MarkNotificationsRead } from "@/components/alerts/mark-read";
import { PushToggle } from "@/components/alerts/push-toggle";
import { TelegramConnect } from "@/components/alerts/telegram-connect";
import { FollowButton } from "@/components/follows/follow-button";
import { WatchButton } from "@/components/alerts/watch-button";
import { ProductImage } from "@/components/product/product-image";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/cn";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.alerts.pageTitle, robots: { index: false } };
}

export default async function AlertsPage() {
  const { t, href, money, market, locale } = await getI18n();
  const user = await getCurrentUser();
  if (!user) redirect(`${href("/login")}?next=${encodeURIComponent(href("/alerts"))}`);

  const [items, watches, followed, telegram] = await Promise.all([
    listNotifications(user.id),
    listWatches(user.id, market),
    listFollows(user.id),
    telegramEnabled() ? telegramLinkOf(user.id) : undefined,
  ]);
  const date = new Intl.DateTimeFormat(LOCALE_TAGS[locale], { day: "numeric", month: "long" });
  const dateTime = new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Baku",
  });

  return (
    <Container className="max-w-3xl space-y-8 py-10">
      <MarkNotificationsRead enabled={items.some((item) => !item.readAt)} />
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">{t.alerts.pageTitle}</h1>
        <p className="mt-1 text-muted">{t.alerts.pageIntro}</p>
      </header>

      <div className="space-y-3">
        <PushToggle />
        {telegram !== undefined && (
          <TelegramConnect initial={{ linked: telegram !== null, username: telegram?.username ?? null }} />
        )}
      </div>

      <section>
        <h2 className="text-xl font-bold">{t.alerts.notificationsTitle}</h2>
        {items.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t.alerts.noNotifications}</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={href(`/product/${item.productSlug}`)}
                  className="flex items-start gap-3 px-5 py-4 hover:bg-surface-2"
                >
                  <span
                    className={cn(
                      "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full",
                      item.readAt ? "bg-surface-2 text-muted" : "bg-deal-soft text-deal",
                    )}
                  >
                    {item.type === "new_deal" ? (
                      <Sparkles className="size-4" aria-hidden />
                    ) : (
                      <TrendingDown className="size-4" aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0">
                    {item.type === "new_deal" && (
                      <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted">
                        {fmt(t.follows.newDeal, { follow: item.followLabel ?? "" })}
                      </span>
                    )}
                    <span className={cn("block truncate text-sm", item.readAt ? "font-medium" : "font-bold")}>
                      {item.productTitle}
                    </span>
                    <span className="block text-sm text-muted">
                      {fmt(item.type === "new_deal" ? t.follows.newDealLine : t.alerts.dropLine, {
                        pct: dropPercent(item.oldPriceMinor, item.newPriceMinor),
                        price: money(item.newPriceMinor),
                        old: money(item.oldPriceMinor),
                        store: item.supplierName,
                      })}
                    </span>
                    <span className="block text-xs text-muted">{dateTime.format(item.createdAt)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="follows" className="scroll-mt-28">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-xl font-bold">{t.follows.title}</h2>
          <span className="text-sm text-muted">{followed.length}</span>
        </div>
        <p className="mt-1 text-sm text-muted">{t.follows.intro}</p>
        {followed.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-line px-6 py-8 text-center text-sm text-muted">
            {t.follows.none}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
            {followed.map((follow) => {
              const name =
                follow.kind === "category" ? (t.categories[follow.key as CategorySlug]?.name ?? follow.key) : follow.label;
              return (
                <li key={follow.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <span className="min-w-0">
                    <span className="block text-xs text-muted">{t.follows.kinds[follow.kind]}</span>
                    <span className="block truncate text-sm font-semibold">{name}</span>
                  </span>
                  <FollowButton kind={follow.kind} value={follow.key} name={name} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-xl font-bold">{t.alerts.watchedTitle}</h2>
          <span className="text-sm text-muted">
            {fmt(t.alerts.watchedCount, { count: watches.length, max: market.alerts.maxWatches })}
          </span>
        </div>
        {watches.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-line px-6 py-10 text-center">
            <p className="text-sm text-muted">{t.alerts.noWatched}</p>
            <ButtonLink href={href("/deals")} variant="secondary" size="sm" className="mt-4">
              {t.alerts.browse}
            </ButtonLink>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
            {watches.map((watch) => {
              const current = watch.card?.landedMinor;
              const diff = current === undefined ? null : current - watch.startPriceMinor;
              return (
                <li key={watch.productId} className="flex items-center gap-4 px-4 py-3">
                  <Link
                    href={href(`/product/${watch.slug}`)}
                    className="size-16 shrink-0 overflow-hidden rounded-xl border border-line"
                  >
                    <ProductImage
                      imageUrl={watch.card?.imageUrl ?? null}
                      title={watch.title}
                      category={(watch.card?.categorySlug ?? "electronics") as CategorySlug}
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={href(`/product/${watch.slug}`)} className="block truncate text-sm font-semibold hover:underline">
                      {watch.title}
                    </Link>
                    <p className="text-xs text-muted">
                      {fmt(t.alerts.since, { date: date.format(watch.createdAt), price: money(watch.startPriceMinor) })}
                    </p>
                    <p className="mt-0.5 text-sm">
                      {current === undefined ? (
                        <span className="text-muted">{t.alerts.outOfStock}</span>
                      ) : (
                        <>
                          <span className="font-bold tabular-nums">{fmt(t.alerts.nowPrice, { price: money(current) })}</span>
                          <span className={cn("ml-2 text-xs font-semibold", diff! < 0 ? "text-brand-strong" : "text-muted")}>
                            {diff === 0
                              ? t.alerts.unchanged
                              : diff! < 0
                                ? fmt(t.alerts.cheaperBy, { amount: money(-diff!) })
                                : fmt(t.alerts.dearerBy, { amount: money(diff!) })}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <WatchButton productId={watch.productId} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </Container>
  );
}
