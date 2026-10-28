/**
 * A visitor's interests, kept in their own browser (components/recommendations)
 * and sent with a request for recommendations; never stored on our side.
 * Pure and client-safe: no database, no browser APIs.
 *
 * The profile is the whole contract between the browser and the recommender
 * (./service.ts, POST /api/recommendations): versioned, small, and checked by
 * sanitizeProfile on every request, so the recommender can move to its own
 * service without the browser side changing.
 */

import { brandKey } from "@/modules/catalog/brand";

export const PROFILE_VERSION = 1;

export interface InterestProfile {
  v: typeof PROFILE_VERSION;
  /** When the weights were last decayed (ms since epoch). */
  updatedAt: number;
  /** Interest per category slug. */
  categories: Record<string, number>;
  /** Interest per "category/subcategory". */
  subcategories: Record<string, number>;
  /** Interest per brand key (catalog/brand.ts brandKey). */
  brands: Record<string, number>;
  /** Products opened recently, newest first: not recommended back. */
  viewed: string[];
}

export type InterestEvent =
  | { kind: "view"; productId: string; categorySlug: string; subcategorySlug?: string; brand?: string | null }
  /** A search, with the category and brand most of its results belong to. */
  | { kind: "search"; categorySlug?: string; subcategorySlug?: string; brand?: string | null };

/** An interest halves every two weeks, so recommendations follow what someone looks at now. */
const HALF_LIFE_MS = 14 * 86_400_000;
/** Keys kept per list; the weakest go first. */
const MAX_KEYS = 12;
const MAX_VIEWED = 30;
/** Weight of one event: opening a product says more than a search. */
const EVENT_WEIGHT = { view: 1, search: 0.6 } as const;
/** Weights below this are forgotten. */
const MIN_WEIGHT = 0.05;

export function emptyProfile(now: number): InterestProfile {
  return { v: PROFILE_VERSION, updatedAt: now, categories: {}, subcategories: {}, brands: {}, viewed: [] };
}

export function hasInterests(profile: InterestProfile | null): profile is InterestProfile {
  return !!profile && Object.keys(profile.categories).length + Object.keys(profile.brands).length > 0;
}

/** The profile after one event: older interests faded, the event's added. */
export function recordInterest(profile: InterestProfile, event: InterestEvent, now: number): InterestProfile {
  const fade = Math.pow(0.5, Math.max(0, now - profile.updatedAt) / HALF_LIFE_MS);
  const weight = EVENT_WEIGHT[event.kind];
  const add = (map: Record<string, number>, key: string | null | undefined) =>
    trim(Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v * fade])), key ? { [key]: weight } : {});
  return {
    v: PROFILE_VERSION,
    updatedAt: now,
    categories: add(profile.categories, event.categorySlug),
    subcategories: add(
      profile.subcategories,
      event.categorySlug && event.subcategorySlug && event.subcategorySlug !== "other"
        ? `${event.categorySlug}/${event.subcategorySlug}`
        : null,
    ),
    brands: add(profile.brands, event.brand?.trim() ? brandKey(event.brand) : null),
    viewed:
      event.kind === "view"
        ? [event.productId, ...profile.viewed.filter((id) => id !== event.productId)].slice(0, MAX_VIEWED)
        : profile.viewed,
  };
}

function trim(map: Record<string, number>, extra: Record<string, number>): Record<string, number> {
  const merged = { ...map };
  for (const [key, value] of Object.entries(extra)) merged[key] = (merged[key] ?? 0) + value;
  return Object.fromEntries(
    Object.entries(merged)
      .filter(([, value]) => value >= MIN_WEIGHT)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_KEYS)
      .map(([key, value]) => [key, Math.round(value * 1000) / 1000]),
  );
}

/** The strongest keys of a list, strongest first. */
export function topKeys(map: Record<string, number>, count: number): string[] {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([key]) => key);
}

/**
 * A profile from untrusted input (the browser's storage, a request body), or
 * null when it is not one. Sizes are capped, so a crafted profile cannot make
 * the recommender do more work than a real one.
 */
export function sanitizeProfile(value: unknown): InterestProfile | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (raw.v !== PROFILE_VERSION) return null;
  const weights = (input: unknown) =>
    trim(
      Object.fromEntries(
        Object.entries(input && typeof input === "object" ? (input as Record<string, unknown>) : {})
          .filter(([key, weight]) => key.length <= 60 && typeof weight === "number" && Number.isFinite(weight) && weight > 0)
          .map(([key, weight]) => [key, Math.min(weight as number, 1000)]),
      ),
      {},
    );
  return {
    v: PROFILE_VERSION,
    updatedAt: typeof raw.updatedAt === "number" && Number.isFinite(raw.updatedAt) ? raw.updatedAt : 0,
    categories: weights(raw.categories),
    subcategories: weights(raw.subcategories),
    brands: weights(raw.brands),
    viewed: Array.isArray(raw.viewed)
      ? raw.viewed.filter((id): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)).slice(0, MAX_VIEWED)
      : [],
  };
}

/** Results looked at to tell what a search was about. */
const SEARCH_SAMPLE = 20;

/**
 * What a search was about, from its best results: the category, type and
 * brand most of them share (a brand only when it is clearly the one asked for).
 */
export function searchInterest(
  results: { categorySlug: string; subcategorySlug: string; brand: string | null }[],
): InterestEvent | null {
  const sample = results.slice(0, SEARCH_SAMPLE);
  if (sample.length === 0) return null;
  const most = (values: (string | null)[]) => {
    const counts = new Map<string, number>();
    for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
    const [top] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    return top && top[1] * 2 >= sample.length ? top[0] : undefined;
  };
  const categorySlug = most(sample.map((r) => r.categorySlug));
  const subcategorySlug = categorySlug ? most(sample.filter((r) => r.categorySlug === categorySlug).map((r) => r.subcategorySlug)) : undefined;
  const brand = most(sample.map((r) => (r.brand ? brandKey(r.brand) : null)));
  return categorySlug || brand ? { kind: "search", categorySlug, subcategorySlug, brand } : null;
}
