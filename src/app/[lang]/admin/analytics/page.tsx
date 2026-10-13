import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { LOCALE_TAGS } from "@/i18n/config";
import { fmt } from "@/i18n/format";
import { param } from "@/modules/admin/forms";
import { getAdminI18n } from "@/modules/admin/i18n";
import {
  ANALYTICS_PERIODS,
  getAnalyticsReport,
  isAnalyticsPeriod,
  type Ranked,
  type Totals,
} from "@/modules/analytics/report";
import { loadMarket } from "@/modules/pricing/fx";
import { DayBars } from "@/components/admin/day-bars";
import { EmptyState, PageHeader, Panel } from "@/components/admin/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { a } = await getAdminI18n();
  return { title: a.nav.analytics };
}

/** Visitors, store clicks, searches and conversions, for whoever runs the site. */
export default async function AdminAnalyticsPage({ searchParams }: PageProps<"/[lang]/admin/analytics">) {
  const params = await searchParams;
  const { a, href, locale, num } = await getAdminI18n();
  const s = a.analytics;
  const requested = Number(param(params, "days"));
  const period = isAnalyticsPeriod(requested) ? requested : 30;
  const market = await loadMarket();
  const report = await getAnalyticsReport(market, period, href);
  const path = href("/admin/analytics");
  const dayLabel = (day: string) =>
    new Intl.DateTimeFormat(LOCALE_TAGS[locale], { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));

  const { totals, previous } = report;
  // Share of visitors who went on to a store.
  const clickRate = (t: Totals) => (t.visitors ? (Math.min(t.clickingVisitors, t.visitors) / t.visitors) * 100 : 0);
  const tiles: { key: keyof typeof s.tiles; value: number; before: number; percent?: boolean }[] = [
    { key: "visitors", value: totals.visitors, before: previous.visitors },
    { key: "signedInUsers", value: totals.signedInUsers, before: previous.signedInUsers },
    { key: "pageViews", value: totals.pageViews, before: previous.pageViews },
    { key: "storeClicks", value: totals.storeClicks, before: previous.storeClicks },
    { key: "clickRate", value: clickRate(totals), before: clickRate(previous), percent: true },
    { key: "searches", value: totals.searches, before: previous.searches },
    { key: "signups", value: totals.signups, before: previous.signups },
    { key: "messages", value: totals.messages + totals.orderRequests, before: previous.messages + previous.orderRequests },
  ];

  return (
    <>
      <PageHeader title={a.nav.analytics} intro={s.intro} />

      <nav className="mb-5 flex flex-wrap gap-1">
        {ANALYTICS_PERIODS.map((days) => (
          <Link
            key={days}
            href={`${path}?days=${days}`}
            aria-current={days === period ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium",
              days === period ? "bg-ink text-bg" : "text-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            {fmt(s.lastDays, { days })}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.key} className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{s.tiles[tile.key]}</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums tracking-tight">
              {tile.percent ? `${tile.value.toFixed(1)}%` : num(tile.value)}
            </p>
            <Change value={tile.value} before={tile.before} percent={tile.percent} label={s.vsPrevious} />
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <DayBars
          title={s.charts.visitors}
          points={report.daily.map((point) => ({ day: point.day, value: point.visitors }))}
          color="var(--brand)"
          dayLabel={dayLabel}
        />
        <DayBars
          title={s.charts.storeClicks}
          points={report.daily.map((point) => ({ day: point.day, value: point.storeClicks }))}
          color="var(--global)"
          dayLabel={dayLabel}
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <RankedList title={s.lists.topStores} rows={report.topStores} value={s.columns.clicks} extra={s.columns.visitors} empty={s.empty} external />
        <RankedList title={s.lists.topClickedProducts} rows={report.topClickedProducts} value={s.columns.clicks} extra={s.columns.visitors} empty={s.empty} />
        <RankedList title={s.lists.topViewedProducts} rows={report.topViewedProducts} value={s.columns.views} extra={s.columns.visitors} empty={s.empty} />
        <RankedList title={s.lists.topPages} rows={report.topPages} value={s.columns.views} extra={s.columns.visitors} empty={s.empty} />
        <RankedList title={s.lists.topSearches} rows={report.topSearches} value={s.columns.people} extra={s.columns.results} empty={s.empty} />
        <RankedList title={s.lists.emptySearches} intro={s.emptySearchesHint} rows={report.emptySearches} value={s.columns.people} empty={s.empty} />
        <RankedList title={s.lists.sources} rows={report.sources} value={s.columns.visitors} empty={s.empty} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <RankedList title={s.lists.devices} rows={report.devices.map((row) => ({ ...row, label: s.devices[row.label as keyof typeof s.devices] ?? row.label }))} value={s.columns.visitors} empty={s.empty} />
          <RankedList title={s.lists.languages} rows={report.languages} value={s.columns.visitors} empty={s.empty} />
        </div>
      </div>

      <p className="mt-6 text-xs text-muted">{s.privacy}</p>
    </>
  );
}

/** "+12% vs previous period", coloured by direction. */
function Change({ value, before, percent, label }: { value: number; before: number; percent?: boolean; label: string }) {
  if (before === 0 && value === 0) return <p className="mt-1 text-xs text-muted">—</p>;
  const diff = percent ? value - before : before === 0 ? 100 : ((value - before) / before) * 100;
  const text = `${diff >= 0 ? "+" : "−"}${Math.abs(diff).toFixed(percent ? 1 : 0)}${percent ? " pp" : "%"}`;
  return (
    <p className="mt-1 text-xs text-muted">
      <span className={cn("font-semibold", diff > 0 ? "text-brand-strong" : diff < 0 ? "text-deal" : "")}>{text}</span> {label}
    </p>
  );
}

function RankedList({
  title,
  intro,
  rows,
  value,
  extra,
  empty,
  external,
}: {
  title: string;
  intro?: string;
  rows: Ranked[];
  value: string;
  extra?: string;
  empty: string;
  /** Links leave the site (store websites). */
  external?: boolean;
}) {
  return (
    <Panel title={title} flush>
      {intro && <p className="border-b border-line px-5 py-2 text-xs text-muted">{intro}</p>}
      {rows.length === 0 ? (
        <EmptyState>{empty}</EmptyState>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="px-5 py-2 font-medium" />
              <th className="w-20 px-2 py-2 text-right font-medium">{value}</th>
              {extra && <th className="w-20 py-2 pl-2 pr-5 text-right font-medium">{extra}</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row, index) => (
              <tr key={`${row.label}-${index}`}>
                <td className="max-w-0 truncate px-5 py-2">
                  {row.href ? (
                    <a
                      href={row.href}
                      target={external ? "_blank" : undefined}
                      rel={external ? "noreferrer" : undefined}
                      className="hover:underline"
                      title={row.label}
                    >
                      {row.label}
                    </a>
                  ) : (
                    <span title={row.label}>{row.label}</span>
                  )}
                </td>
                <td className="px-2 py-2 text-right font-semibold tabular-nums">{row.value}</td>
                {extra && <td className="py-2 pl-2 pr-5 text-right tabular-nums text-muted">{row.extra ?? "—"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
