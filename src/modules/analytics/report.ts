import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { dailyStats } from "@/db/schema";
import type { MarketConfig } from "@/config/markets";
import { marketDay } from "@/modules/digest/pick";

/**
 * Numbers for Admin → Analytics, from site_events, outbound_clicks and the
 * tables that already record sign-ups, messages and order requests. Days are
 * the market's own days (Baku time).
 */

export const ANALYTICS_PERIODS = [7, 30, 90] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];
export const isAnalyticsPeriod = (value: number): value is AnalyticsPeriod =>
  (ANALYTICS_PERIODS as readonly number[]).includes(value);

/**
 * Detailed events are kept this long; daily_stats keeps the totals for good.
 * Store clicks count from when analytics started (clicks carrying a visitor id):
 * older ones include admins and bots.
 */
export const ANALYTICS_RETENTION_DAYS = 90;

export interface Totals {
  visitors: number;
  signedInUsers: number;
  pageViews: number;
  storeClicks: number;
  /** Visitors who went on to at least one store. */
  clickingVisitors: number;
  searches: number;
  signups: number;
  messages: number;
  orderRequests: number;
}

export interface DayPoint {
  day: string;
  visitors: number;
  pageViews: number;
  storeClicks: number;
}

export interface Ranked {
  label: string;
  /** A link for the label (product page, store site), if it has one. */
  href?: string;
  value: number;
  /** A second number: unique visitors, or results of a search. */
  extra?: number;
}

export interface AnalyticsReport {
  days: string[];
  totals: Totals;
  previous: Totals;
  daily: DayPoint[];
  topStores: Ranked[];
  topClickedProducts: Ranked[];
  topViewedProducts: Ranked[];
  topPages: Ranked[];
  topSearches: Ranked[];
  emptySearches: Ranked[];
  sources: Ranked[];
  devices: Ranked[];
  languages: Ranked[];
}

const DAY_MS = 86_400_000;

/** The `count` days ending with `last` (YYYY-MM-DD), oldest first. */
export function dayRange(last: string, count: number): string[] {
  const end = Date.parse(`${last}T00:00:00Z`);
  return Array.from({ length: count }, (_, i) => new Date(end - (count - 1 - i) * DAY_MS).toISOString().slice(0, 10));
}

const nextDay = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);

/** A period as timestamps: from the first day's midnight to the midnight after the last, in the market's time zone. */
function window(first: string, last: string, timeZone: string) {
  const from = sql`(${first}::date)::timestamp at time zone ${timeZone}`;
  const to = sql`(${nextDay(last)}::date)::timestamp at time zone ${timeZone}`;
  return { within: (column: SQL) => sql`${column} >= ${from} and ${column} < ${to}` };
}

const n = (value: unknown) => Number(value ?? 0);

async function totalsFor(first: string, last: string, timeZone: string): Promise<Totals> {
  const { within } = window(first, last, timeZone);
  const [row] = await db.execute<Record<keyof Totals, string>>(sql`
    select
      (select count(distinct visitor_id) from site_events where type = 'view' and ${within(sql`created_at`)}) as "visitors",
      (select count(distinct user_id) from site_events where type = 'view' and user_id is not null and ${within(sql`created_at`)}) as "signedInUsers",
      (select count(*) from site_events where type = 'view' and ${within(sql`created_at`)}) as "pageViews",
      (select count(*) from outbound_clicks where visitor_id is not null and ${within(sql`created_at`)}) as "storeClicks",
      (select count(distinct visitor_id) from outbound_clicks where visitor_id is not null and ${within(sql`created_at`)}) as "clickingVisitors",
      (select count(distinct (visitor_id, lower(trim(query)))) from site_events where type = 'search' and ${within(sql`created_at`)}) as "searches",
      (select count(*) from users where ${within(sql`created_at`)}) as "signups",
      (select count(*) from conversation_messages where sender = 'user' and ${within(sql`created_at`)}) as "messages",
      (select count(*) from order_requests where ${within(sql`created_at`)}) as "orderRequests"`);
  return {
    visitors: n(row.visitors),
    signedInUsers: n(row.signedInUsers),
    pageViews: n(row.pageViews),
    storeClicks: n(row.storeClicks),
    clickingVisitors: n(row.clickingVisitors),
    searches: n(row.searches),
    signups: n(row.signups),
    messages: n(row.messages),
    orderRequests: n(row.orderRequests),
  };
}

async function dailySeries(days: string[], timeZone: string): Promise<DayPoint[]> {
  const { within } = window(days[0], days.at(-1)!, timeZone);
  const local = (column: SQL) => sql`to_char((${column} at time zone ${timeZone})::date, 'YYYY-MM-DD')`;
  const [views, clicks] = await Promise.all([
    db.execute<{ day: string; visitors: string; views: string }>(sql`
      select ${local(sql`created_at`)} as day, count(distinct visitor_id) as visitors, count(*) as views
      from site_events where type = 'view' and ${within(sql`created_at`)} group by 1`),
    db.execute<{ day: string; clicks: string }>(sql`
      select ${local(sql`created_at`)} as day, count(*) as clicks
      from outbound_clicks where visitor_id is not null and ${within(sql`created_at`)} group by 1`),
  ]);
  const viewsByDay = new Map(views.map((row) => [row.day, row]));
  const clicksByDay = new Map(clicks.map((row) => [row.day, n(row.clicks)]));
  return days.map((day) => ({
    day,
    visitors: n(viewsByDay.get(day)?.visitors),
    pageViews: n(viewsByDay.get(day)?.views),
    storeClicks: clicksByDay.get(day) ?? 0,
  }));
}

const LIMIT = 10;

async function rankings(first: string, last: string, timeZone: string, localePath: (path: string) => string) {
  const { within } = window(first, last, timeZone);
  const [stores, clickedProducts, viewedProducts, pages, searches, emptySearches, sources, devices, languages] = await Promise.all([
    db.execute<{ label: string; href: string; value: string; extra: string }>(sql`
      select s.name as label, s.website_url as href, count(*) as value, count(distinct c.visitor_id) as extra
      from outbound_clicks c join offers o on o.id = c.offer_id join suppliers s on s.id = o.supplier_id
      where c.visitor_id is not null and ${within(sql`c.created_at`)} group by s.name, s.website_url order by value desc limit ${LIMIT}`),
    db.execute<{ label: string; slug: string; value: string; extra: string }>(sql`
      select p.title as label, p.slug, count(*) as value, count(distinct c.visitor_id) as extra
      from outbound_clicks c join offers o on o.id = c.offer_id join products p on p.id = o.product_id
      where c.visitor_id is not null and ${within(sql`c.created_at`)} group by p.title, p.slug order by value desc limit ${LIMIT}`),
    db.execute<{ label: string; slug: string; value: string; extra: string }>(sql`
      select coalesce(p.title, v.slug) as label, v.slug, v.value, v.extra from (
        select split_part(path, '/', 4) as slug, count(*) as value, count(distinct visitor_id) as extra
        from site_events where type = 'view' and path ~ '^/[a-z]{2}/product/[^/]+$' and ${within(sql`created_at`)}
        group by 1 order by value desc limit ${LIMIT}
      ) v left join products p on p.slug = v.slug order by v.value desc`),
    db.execute<{ label: string; value: string; extra: string }>(sql`
      select coalesce(nullif(regexp_replace(path, '^/[a-z]{2}', ''), ''), '/') as label, count(*) as value, count(distinct visitor_id) as extra
      from site_events where type = 'view' and ${within(sql`created_at`)} group by 1 order by value desc limit ${LIMIT}`),
    db.execute<{ label: string; value: string; extra: string }>(sql`
      select lower(trim(query)) as label, count(distinct visitor_id) as value,
             (array_agg(result_count order by created_at desc))[1] as extra
      from site_events where type = 'search' and ${within(sql`created_at`)} group by 1 order by value desc limit ${LIMIT}`),
    db.execute<{ label: string; value: string }>(sql`
      select lower(trim(query)) as label, count(distinct visitor_id) as value
      from site_events where type = 'search' and ${within(sql`created_at`)} group by 1
      having (array_agg(result_count order by created_at desc))[1] = 0 order by value desc limit ${LIMIT}`),
    db.execute<{ label: string; value: string }>(sql`
      select source as label, count(distinct visitor_id) as value
      from site_events where type = 'view' and source is not null and ${within(sql`created_at`)} group by 1 order by value desc limit ${LIMIT}`),
    db.execute<{ label: string; value: string }>(sql`
      select coalesce(device, 'desktop') as label, count(distinct visitor_id) as value
      from site_events where type = 'view' and ${within(sql`created_at`)} group by 1 order by value desc`),
    db.execute<{ label: string; value: string }>(sql`
      select coalesce(locale, '—') as label, count(distinct visitor_id) as value
      from site_events where type = 'view' and ${within(sql`created_at`)} group by 1 order by value desc`),
  ]);
  const ranked = (rows: { label: string; value: string; extra?: string | null }[]): Ranked[] =>
    rows.map((row) => ({ label: row.label, value: n(row.value), extra: row.extra == null ? undefined : n(row.extra) }));
  return {
    topStores: stores.map((row) => ({ label: row.label, href: row.href, value: n(row.value), extra: n(row.extra) })),
    topClickedProducts: clickedProducts.map((row) => ({ label: row.label, href: localePath(`/product/${row.slug}`), value: n(row.value), extra: n(row.extra) })),
    topViewedProducts: viewedProducts.map((row) => ({ label: row.label, href: localePath(`/product/${row.slug}`), value: n(row.value), extra: n(row.extra) })),
    topPages: ranked(pages),
    topSearches: ranked(searches),
    emptySearches: ranked(emptySearches),
    sources: ranked(sources),
    devices: ranked(devices),
    languages: ranked(languages),
  };
}

export async function getAnalyticsReport(
  market: MarketConfig,
  period: AnalyticsPeriod,
  localePath: (path: string) => string,
  now = new Date(),
): Promise<AnalyticsReport> {
  const days = dayRange(marketDay(now, market.timeZone), period);
  const before = dayRange(new Date(Date.parse(`${days[0]}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10), period);
  const [totals, previous, daily, ranks] = await Promise.all([
    totalsFor(days[0], days.at(-1)!, market.timeZone),
    totalsFor(before[0], before.at(-1)!, market.timeZone),
    dailySeries(days, market.timeZone),
    rankings(days[0], days.at(-1)!, market.timeZone, localePath),
  ]);
  return { days, totals, previous, daily, ...ranks };
}

/**
 * Daily job: writes the last few days' totals to daily_stats (recent days are
 * rewritten, as late events arrive) and deletes detailed events past their
 * retention. Returns how many events were deleted.
 */
export async function saveDailyStatsAndPrune(market: MarketConfig, now = new Date(), recentDays = 3): Promise<number> {
  for (const day of dayRange(marketDay(now, market.timeZone), recentDays)) {
    const totals = await totalsFor(day, day, market.timeZone);
    const values = {
      visitors: totals.visitors,
      signedInUsers: totals.signedInUsers,
      pageViews: totals.pageViews,
      storeClicks: totals.storeClicks,
      searches: totals.searches,
      signups: totals.signups,
      updatedAt: now,
    };
    await db.insert(dailyStats).values({ day, ...values }).onConflictDoUpdate({ target: dailyStats.day, set: values });
  }
  const cutoff = new Date(now.getTime() - ANALYTICS_RETENTION_DAYS * DAY_MS).toISOString();
  const deleted = await db.execute(sql`delete from site_events where created_at < ${cutoff}::timestamptz`);
  return deleted.count ?? 0;
}
