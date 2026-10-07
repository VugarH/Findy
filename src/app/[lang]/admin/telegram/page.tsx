import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { CategorySlug } from "@/config/categories";
import { fmt } from "@/i18n/format";
import { getAdminI18n } from "@/modules/admin/i18n";
import { telegramOverview, type Check } from "@/modules/admin/telegram";
import { formatDay } from "@/modules/digest/pick";
import { DigestControls } from "@/components/admin/digest-controls";
import { Badge, EmptyState, Facts, PageHeader, Panel } from "@/components/admin/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { a } = await getAdminI18n();
  return { title: a.nav.telegram };
}

export default async function AdminTelegramPage() {
  const { a, t, href, locale, market, money, dateTime, num } = await getAdminI18n();
  const tg = a.telegram;
  const overview = await telegramOverview(market);
  const { today } = overview;

  const checked = (value: Check<string> | null, fallback: string) =>
    !value ? (
      <span className="text-muted">{fallback}</span>
    ) : value.ok ? (
      value.value
    ) : (
      <span className="text-deal">{fmt(tg.unreachable, { error: value.error })}</span>
    );

  return (
    <>
      <PageHeader title={a.nav.telegram} intro={tg.intro} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <Panel
            title={today ? `${tg.today} · ${formatDay(today.day, locale)}` : tg.today}
            actions={
              today && (
                <Link
                  href={`${href("/top")}?day=${today.day}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink"
                >
                  {a.common.viewOnSite}
                  <ExternalLink className="size-3.5" aria-hidden />
                </Link>
              )
            }
          >
            {today ? (
              <div className="space-y-4">
                <p className="text-sm">
                  {today.telegramPostedAt ? (
                    <Badge tone="good">{fmt(tg.postedAt, { time: dateTime(today.telegramPostedAt) })}</Badge>
                  ) : today.telegramError ? (
                    <span className="text-deal">{fmt(tg.postFailed, { error: today.telegramError })}</span>
                  ) : (
                    <span className="text-muted">{overview.channel ? tg.notPosted : tg.noChannel}</span>
                  )}
                </p>
                <ol className="divide-y divide-line rounded-xl border border-line">
                  {today.items.map((item, index) => (
                    <li key={item.productId} className="flex items-baseline gap-3 px-4 py-2.5 text-sm">
                      <span className="w-5 shrink-0 text-right font-bold tabular-nums text-muted">{index + 1}</span>
                      <span className="min-w-0 flex-1">
                        <Link href={href(`/product/${item.slug}`)} className="block truncate font-semibold hover:underline">
                          {item.title}
                        </Link>
                        <span className="text-xs text-muted">
                          {item.supplierName} · {t.categories[item.categorySlug as CategorySlug]?.name ?? item.categorySlug}
                        </span>
                      </span>
                      <span className="shrink-0 text-right tabular-nums">
                        <span className="font-bold">{money(item.landedMinor)}</span>
                        {item.discountPct !== null && (
                          <span className="ml-2 text-xs font-semibold text-deal">
                            −{item.discountPct}%{item.verified ? "" : ` (${tg.storeClaim})`}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ol>
                <DigestControls picked posted={today.telegramPostedAt !== null} canPost={overview.channel !== null} />
                {overview.preview && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-xs font-semibold text-muted">{tg.preview}</summary>
                    {/* Every value in the message is escaped by modules/telegram/format.ts; only its own tags remain. */}
                    <div
                      className="mt-2 max-w-md whitespace-pre-wrap rounded-xl bg-surface-2 p-4 text-sm leading-relaxed [&_a]:text-brand-strong [&_a]:underline"
                      dangerouslySetInnerHTML={{ __html: overview.preview }}
                    />
                  </details>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted">{tg.notPicked}</p>
                <DigestControls picked={false} posted={false} canPost={overview.channel !== null} />
              </div>
            )}
          </Panel>

          <Panel title={tg.history} flush>
            {overview.earlier.length === 0 ? (
              <EmptyState>{tg.historyEmpty}</EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {overview.earlier.map((digest) => (
                  <li key={digest.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
                    <Link href={`${href("/top")}?day=${digest.day}`} className="font-semibold hover:underline">
                      {formatDay(digest.day, locale, { day: "numeric", month: "long", weekday: "short" })}
                    </Link>
                    <span className="text-muted">{fmt(tg.items, { count: digest.items.length })}</span>
                    {digest.telegramPostedAt ? (
                      <Badge tone="good">{fmt(tg.postedAt, { time: dateTime(digest.telegramPostedAt) })}</Badge>
                    ) : digest.telegramError ? (
                      <span className="text-xs text-deal">{fmt(tg.postFailed, { error: digest.telegramError })}</span>
                    ) : (
                      <span className="text-xs text-muted">{tg.notPosted}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title={tg.setup}>
            <Facts
              items={[
                { label: tg.bot, value: checked(overview.bot, tg.notSet) },
                {
                  label: tg.channel,
                  value: overview.channel ? (
                    overview.channel.url ? (
                      <a href={overview.channel.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {checked(overview.channel.title, overview.channel.id)}
                      </a>
                    ) : (
                      <>
                        {checked(overview.channel.title, overview.channel.id)}
                        <span className="block text-xs text-muted">
                          {fmt(tg.privateChannel, { id: overview.channel.id })}
                        </span>
                      </>
                    )
                  ) : (
                    <span className="text-muted">{tg.notSet}</span>
                  ),
                },
                { label: tg.messages, value: overview.enabled ? (overview.webhook ? tg.webhook : tg.polling) : "—" },
                { label: tg.connected, value: num(overview.connected) },
              ]}
            />
          </Panel>
          {(!overview.enabled || !overview.channel) && (
            <Panel title={tg.setupTitle}>
              <ol className="list-decimal space-y-2 pl-5 text-sm text-muted">
                {tg.setupSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
