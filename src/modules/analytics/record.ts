import { db } from "@/db/client";
import { siteEvents } from "@/db/schema";
import { getMarket } from "@/config/markets";
import { siteUrl } from "@/config/site";
import { isAdmin } from "@/modules/admin/guard";
import type { CurrentUser } from "@/modules/auth/session";
import { marketDay } from "@/modules/digest/pick";
import { getIgnoredUsers } from "@/modules/settings/service";
import { hasNoAnalyticsCookie } from "./exclusions";
import { deviceOf, isBot, sourceOf, visitorId, type Device } from "./visitor";

export interface Visitor {
  id: string;
  device: Device;
  userId: string | null;
}

const salt = () => process.env.ANALYTICS_SALT || process.env.DATABASE_URL || "serfeli";

/** The ignored accounts, read at most once a minute per server instance: every tracked page view asks. */
const IGNORED_TTL_MS = 60_000;
let ignored: { ids: Set<string>; until: number } | null = null;

async function ignoredUsers(now: number): Promise<Set<string>> {
  if (!ignored || ignored.until < now) {
    const ids = await getIgnoredUsers().catch(() => [] as string[]);
    ignored = { ids: new Set(ids), until: now + IGNORED_TTL_MS };
  }
  return ignored.ids;
}

/** After the list changes, this server instance reads it again at once. */
export function forgetIgnoredUsers(): void {
  ignored = null;
}

/**
 * The visitor behind a request, or null when it should not be counted: bots,
 * admins (their own clicking around is not traffic), accounts an admin chose
 * to leave out, and browsers with the "don't count me" cookie (./exclusions.ts).
 */
export async function visitorOf(headers: Headers, user: CurrentUser | null, now = new Date()): Promise<Visitor | null> {
  const userAgent = headers.get("user-agent") ?? "";
  if (isBot(userAgent) || isAdmin(user) || hasNoAnalyticsCookie(headers.get("cookie"))) return null;
  if (user && (await ignoredUsers(now.getTime())).has(user.id)) return null;
  const ip = headers.get("x-forwarded-for")?.split(",")[0].trim() || headers.get("x-real-ip") || "unknown";
  const day = marketDay(now, getMarket().timeZone);
  return { id: visitorId(ip, userAgent, day, salt()), device: deviceOf(userAgent), userId: user?.id ?? null };
}

/** A page path worth counting: on this site, without its query, never the admin panel. */
export function cleanPath(path: string): string | null {
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  const clean = path.split(/[?#]/)[0].slice(0, 200);
  return /^\/[a-z]{2}\/admin(\/|$)/.test(clean) ? null : clean;
}

export async function recordView(
  visitor: Visitor,
  view: { path: string; locale: string | null; landing: boolean; referrer: string | null; utmSource: string | null },
): Promise<void> {
  const path = cleanPath(view.path);
  if (!path) return;
  const siteHost = new URL(siteUrl()).hostname;
  await db.insert(siteEvents).values({
    type: "view",
    visitorId: visitor.id,
    userId: visitor.userId,
    path,
    // Only the first page of a visit says where it came from.
    source: view.landing ? sourceOf(view.referrer, view.utmSource, siteHost) : null,
    device: visitor.device,
    locale: view.locale,
  });
}

export async function recordSearchEvent(visitor: Visitor, query: string, resultCount: number): Promise<void> {
  await db.insert(siteEvents).values({
    type: "search",
    visitorId: visitor.id,
    userId: visitor.userId,
    query: query.slice(0, 120),
    resultCount,
    device: visitor.device,
  });
}
