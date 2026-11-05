/**
 * Visits left out of Analytics on purpose: accounts an admin chose (the team's
 * own test accounts) and browsers that carry the "don't count me" cookie (the
 * team's phones and laptops, also when signed out). Admins and bots are left
 * out anyway (record.ts). Client-safe: no database here.
 */
export const NO_ANALYTICS_COOKIE = "findy_no_analytics";

export const MAX_IGNORED_USERS = 50;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A stored value as a list of user ids: valid, once each, within the limit. */
export function toIgnoredUsers(value: unknown): string[] {
  const ids = Array.isArray(value) ? value : [];
  return [...new Set(ids.filter((id): id is string => typeof id === "string" && UUID.test(id)).map((id) => id.toLowerCase()))].slice(
    0,
    MAX_IGNORED_USERS,
  );
}

/** Whether a request's Cookie header carries the "don't count this browser" cookie. */
export function hasNoAnalyticsCookie(cookieHeader: string | null | undefined): boolean {
  return (cookieHeader ?? "").split(";").some((part) => part.trim() === `${NO_ANALYTICS_COOKIE}=1`);
}
