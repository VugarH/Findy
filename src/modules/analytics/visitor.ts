import { createHash } from "node:crypto";

/**
 * Who is visiting, without cookies and without keeping IP addresses: the
 * visitor id is a hash of the IP and browser with a secret and the day, so it
 * counts unique visitors per day but cannot follow anyone across days.
 */

/** Crawlers, link previews, scripts and our own store reader. */
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|headless|lighthouse|pagespeed|python|curl|wget|httpclient|axios|node-fetch|go-http|java\/|serfeli/i;

export function isBot(userAgent: string | null | undefined): boolean {
  return !userAgent || BOT.test(userAgent);
}

export type Device = "mobile" | "tablet" | "desktop";

export function deviceOf(userAgent: string): Device {
  if (/ipad|tablet|kindle|silk|(android(?!.*mobile))/i.test(userAgent)) return "tablet";
  if (/mobi|iphone|ipod|android|windows phone/i.test(userAgent)) return "mobile";
  return "desktop";
}

export function visitorId(ip: string, userAgent: string, day: string, salt: string): string {
  return createHash("sha256").update(`${salt}|${day}|${ip}|${userAgent}`).digest("hex").slice(0, 16);
}

/** Known places, by host, under one readable name. */
const SOURCES: [RegExp, string][] = [
  [/(^|\.)google\./, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)yandex\./, "yandex"],
  [/(^|\.)duckduckgo\.com$/, "duckduckgo"],
  [/(^|\.)(t\.me|telegram\.(org|me))$/, "telegram"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, "facebook"],
  [/(^|\.)(tiktok\.com)$/, "tiktok"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
  [/(^|\.)(x\.com|twitter\.com|t\.co)$/, "x"],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, "whatsapp"],
  [/(^|\.)chatgpt\.com$|(^|\.)openai\.com$/, "chatgpt"],
];

/**
 * Where a visit came from: an explicit ?utm_source= wins, then the referring
 * site's name, else "direct". Null when the referrer is our own site (an
 * internal page change, not a new visit).
 */
export function sourceOf(referrer: string | null | undefined, utmSource: string | null | undefined, siteHost: string): string | null {
  const utm = utmSource?.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 40);
  if (utm) return utm;
  if (!referrer) return "direct";
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "direct";
  }
  if (host === siteHost.replace(/^www\./, "")) return null;
  return SOURCES.find(([pattern]) => pattern.test(host))?.[1] ?? host.slice(0, 60);
}
