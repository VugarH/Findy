import type { Metadata } from "next";
import Link from "next/link";
import { Flame, Send } from "lucide-react";
import { LOCALE_TAGS } from "@/i18n/config";
import { fmt } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { formatDay, isDay, marketDay } from "@/modules/digest/pick";
import { digestCards, getDigest, latestDigest, listDigests } from "@/modules/digest/service";
import { channelUrl } from "@/modules/telegram/config";
import { ProductGrid } from "@/components/deals/product-grid";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/cn";

type Props = PageProps<"/[lang]/top">;

async function digestFor(searchParams: Props["searchParams"]) {
  const { market } = await getI18n();
  const { day } = await searchParams;
  return typeof day === "string" && isDay(day) ? getDigest(market.code, day) : latestDigest(market.code);
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { t, locale } = await getI18n();
  const digest = await digestFor(searchParams);
  return {
    title: digest ? fmt(t.top.titleOn, { date: formatDay(digest.day, locale) }) : t.top.nav,
    description: t.top.intro,
  };
}

/** The day's top deals (modules/digest): the same list the Telegram channel gets. */
export default async function TopDealsPage({ searchParams }: Props) {
  const { t, href, money, market, locale } = await getI18n();
  const digest = await digestFor(searchParams);
  const [{ cards, ended }, earlier] = digest
    ? await Promise.all([digestCards(market, digest), listDigests(market.code, 8)])
    : [{ cards: [], ended: 0 }, []];
  const channel = channelUrl();
  const isToday = digest?.day === marketDay(new Date(), market.timeZone);
  const pickedAt = new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: market.timeZone,
  });

  return (
    <Container className="space-y-8 py-10">
      <header className="max-w-3xl">
        <p className="inline-flex items-center gap-2 rounded-full bg-deal-soft px-3 py-1 text-xs font-semibold text-deal">
          <Flame className="size-3.5" aria-hidden />
          {t.top.nav}
        </p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
          {digest && isToday
            ? fmt(t.top.title, { count: digest.items.length })
            : digest
              ? fmt(t.top.titleOn, { date: formatDay(digest.day, locale) })
              : t.top.nav}
        </h1>
        <p className="mt-2 text-muted">{t.top.intro}</p>
        {digest && <p className="mt-1 text-sm text-muted">{fmt(t.top.pickedAt, { time: pickedAt.format(digest.createdAt) })}</p>}
      </header>

      {!digest ? (
        <section className="rounded-2xl border border-dashed border-line px-6 py-16 text-center">
          <p className="text-sm text-muted">{t.top.none}</p>
          <ButtonLink href={href("/deals")} variant="secondary" size="sm" className="mt-4">
            {t.top.seeAll}
          </ButtonLink>
        </section>
      ) : (
        <>
          {cards.length > 0 && <ProductGrid cards={cards} t={t} money={money} href={href} />}
          {ended > 0 && (
            <p className="text-sm text-muted">
              {cards.length === 0 ? t.top.allEnded : fmt(t.top.ended, { count: ended })}{" "}
              <Link href={href("/deals")} className="font-semibold text-brand-strong hover:underline">
                {t.top.seeAll}
              </Link>
            </p>
          )}
        </>
      )}

      {channel && (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-5">
          <div className="min-w-0 flex-1 basis-64">
            <h2 className="flex items-center gap-2 font-bold">
              <Send className="size-4 text-brand" aria-hidden />
              {t.top.telegramTitle}
            </h2>
            <p className="mt-1 text-sm text-muted">{t.top.telegramText}</p>
          </div>
          <a href={channel} target="_blank" rel="noopener noreferrer" className={buttonClass()}>
            {t.top.telegramJoin}
          </a>
        </section>
      )}

      {earlier.length > 1 && (
        <nav aria-label={t.top.earlier}>
          <h2 className="text-sm font-bold">{t.top.earlier}</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {earlier.map((other) => (
              <li key={other.id}>
                <Link
                  href={`${href("/top")}?day=${other.day}`}
                  aria-current={other.id === digest?.id ? "page" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center rounded-full border px-3 text-sm",
                    other.id === digest?.id
                      ? "border-ink bg-ink font-semibold text-bg"
                      : "border-line bg-surface text-muted hover:text-ink",
                  )}
                >
                  {formatDay(other.day, locale)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </Container>
  );
}
