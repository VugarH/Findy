import { db } from "@/db/client";
import { siteEvents } from "@/db/schema";
import { getMarket } from "@/config/markets";
import { siteUrl } from "@/config/site";
import { isAdmin } from "@/modules/admin/guard";
import type { CurrentUser } from "@/modules/auth/session";
import { marketDay } from "@/modules/digest/pick";
import { deviceOf, isBot, sourceOf, visitorId, type Device } from "./visitor";

export interface Visitor {
  id: string;
  device: Device;
  userId: string | null;
}

const salt = () => process.env.ANALYTICS_SALT || process.env.DATABASE_URL || "serfeli";

/**
 * The visitor behind a request, or null when it should not be counted: bots,
 * and admins (their own clicking around is not traffic).
 */
export function visitorOf(headers: Headers, user: CurrentUser | null, now = new Date()): Visitor | null {
  const userAgent = headers.get("user-agent") ?? "";
  if (isBot(userAgent) || isAdmin(user)) return null;
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
