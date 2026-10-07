import type { MarketConfig } from "@/config/markets";
import { LOCALE_TAGS, type Locale } from "@/i18n/config";

/**
 * Choosing the day's top deals. Pure: the candidates arrive ranked best
 * first (by deal score), and the pick only makes the list varied and fresh.
 */

export interface DigestCandidate {
  productId: string;
  categorySlug: string;
  supplierName: string;
  /** False while the discount is the store's own claim. */
  verified: boolean;
}

type Rules = MarketConfig["digest"];

/**
 * Takes the best candidates in order, preferring, in passes:
 *   1. verified discounts, within the per-category and per-store caps, not posted recently
 *   2. the store's own claims too
 *   3. any category or store
 *   4. products posted recently, so a small catalog still fills the list
 */
export function pickTopDeals<T extends DigestCandidate>(
  candidates: T[],
  rules: Pick<Rules, "size" | "maxPerCategory" | "maxPerStore">,
  recentlyPicked: ReadonlySet<string> = new Set(),
): T[] {
  const picked: { candidate: T; rank: number }[] = [];
  const chosen = new Set<string>();
  const perCategory = new Map<string, number>();
  const perStore = new Map<string, number>();

  const passes: { verifiedOnly: boolean; capped: boolean; allowRecent: boolean }[] = [
    { verifiedOnly: true, capped: true, allowRecent: false },
    { verifiedOnly: false, capped: true, allowRecent: false },
    { verifiedOnly: false, capped: false, allowRecent: false },
    { verifiedOnly: false, capped: false, allowRecent: true },
  ];

  for (const pass of passes) {
    for (const [rank, candidate] of candidates.entries()) {
      if (picked.length >= rules.size) break;
      if (chosen.has(candidate.productId)) continue;
      if (pass.verifiedOnly && !candidate.verified) continue;
      if (!pass.allowRecent && recentlyPicked.has(candidate.productId)) continue;
      const store = candidate.supplierName.toLowerCase();
      if (
        pass.capped &&
        ((perCategory.get(candidate.categorySlug) ?? 0) >= rules.maxPerCategory ||
          (perStore.get(store) ?? 0) >= rules.maxPerStore)
      ) {
        continue;
      }
      picked.push({ candidate, rank });
      chosen.add(candidate.productId);
      perCategory.set(candidate.categorySlug, (perCategory.get(candidate.categorySlug) ?? 0) + 1);
      perStore.set(store, (perStore.get(store) ?? 0) + 1);
    }
  }
  // Keep the ranking order, whichever pass found each deal.
  return picked.sort((a, b) => a.rank - b.rank).map(({ candidate }) => candidate);
}

/** The market's calendar day for a moment, as YYYY-MM-DD. */
export function marketDay(now: Date, timeZone: string): string {
  // en-CA writes dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function isDay(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)));
}

/** "6 October" for a YYYY-MM-DD day, in any time zone. */
export function formatDay(day: string, locale: Locale, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" }): string {
  // Noon UTC is the same calendar day everywhere.
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], { ...options, timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
}

/** What the header's bell needs to announce a digest. */
export interface DigestSummary {
  id: string;
  /** YYYY-MM-DD */
  day: string;
  isToday: boolean;
  count: number;
  /** The biggest discount in the list, for "up to −45%". */
  maxPct: number;
}

/** Days after which a digest is no longer announced (the daily job has stopped). */
const ANNOUNCE_DAYS = 2;

export function summarizeDigest(
  digest: { id: string; day: string; items: { discountPct: number | null }[] },
  today: string,
): DigestSummary | null {
  const age = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${digest.day}T00:00:00Z`)) / 86_400_000;
  if (age < 0 || age >= ANNOUNCE_DAYS) return null;
  return {
    id: digest.id,
    day: digest.day,
    isToday: age === 0,
    count: digest.items.length,
    maxPct: Math.max(0, ...digest.items.map((item) => item.discountPct ?? 0)),
  };
}
