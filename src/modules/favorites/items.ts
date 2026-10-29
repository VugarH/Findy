/**
 * Favorites: products a visitor saved with the heart. They live in the
 * visitor's browser (components/favorites/favorite-store.ts), so this file is
 * client-safe: no database, no server code.
 */

export const FAVORITES_LIMIT = 100;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whatever arrives (localStorage, a request) as product ids: valid, no duplicates, newest first, within the limit. */
export function sanitizeFavorites(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const id of value) {
    if (ids.length >= FAVORITES_LIMIT) break;
    if (typeof id === "string" && UUID.test(id) && !ids.includes(id.toLowerCase())) ids.push(id.toLowerCase());
  }
  return ids;
}
