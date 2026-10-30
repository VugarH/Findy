export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 80;

export function normalizeQuery(input: string | undefined | null): string {
  return (input ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_QUERY_LENGTH);
}

/**
 * Text that is not a shopper's search: markup and web addresses (probes, spam).
 * A POSIX regular expression, also used in SQL. Such searches still run, but
 * are never offered to other visitors.
 */
export const NOT_A_SEARCH = "[<>]|://";

export function looksLikeASearch(query: string): boolean {
  return !new RegExp(NOT_A_SEARCH).test(query);
}
