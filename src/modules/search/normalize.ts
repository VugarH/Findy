export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 80;

export function normalizeQuery(input: string | undefined | null): string {
  return (input ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_QUERY_LENGTH);
}
