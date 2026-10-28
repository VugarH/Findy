import { foldForMatching } from "@/lib/text";

/**
 * Spelling fixes for searches, pure: the database supplies known words that
 * could be meant (modules/search/terms.ts), and this decides which one a
 * misspelt word was meant to be and rebuilds the query around it.
 */

export interface SpellingCandidate {
  /** A known word, folded (foldForMatching). */
  folded: string;
  /** How many products have it: among equally close words the more common one is the likelier intent. */
  weight: number;
}

/** Words shorter than this are not corrected: "tv" or "s24" have too few letters to judge. */
export const MIN_WORD_LENGTH = 4;

/** Typos allowed: one, two from eight letters ("cerave" is two typos from "create", and not meant). */
export function maxTypos(word: string): number {
  return word.length >= 8 ? 2 : 1;
}

/** Query words worth checking, folded, without duplicates. */
export function wordsToCheck(query: string): string[] {
  const words = foldForMatching(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= MIN_WORD_LENGTH && !/\d/.test(word));
  return [...new Set(words)];
}

/**
 * Typing mistakes between two words: letters added, missing or wrong, and two
 * neighbours swapped ("iphnoe" → "iphone" is one), each counting once
 * (optimal string alignment distance).
 */
export function typoDistance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      }
    }
  }
  return rows[a.length][b.length];
}

/**
 * The word `word` was most likely meant to be, or null when it is a word we
 * know or nothing is close enough: the fewest typos first, then the most common.
 */
export function bestCorrection(word: string, candidates: SpellingCandidate[]): string | null {
  // A word we know is spelt as intended, even when another one looks alike.
  if (candidates.some((c) => c.folded === word)) return null;
  const limit = maxTypos(word);
  const close = candidates
    .map((c) => ({ ...c, typos: typoDistance(word, c.folded) }))
    .filter((c) => c.typos <= limit);
  if (close.length === 0) return null;
  return close.sort((a, b) => a.typos - b.typos || b.weight - a.weight)[0].folded;
}

/**
 * The query with each corrected word replaced, the rest kept as typed; null
 * when nothing changed.
 */
export function correctedQuery(query: string, corrections: Map<string, string>): string | null {
  if (corrections.size === 0) return null;
  let changed = false;
  const fixed = query
    .split(/(\s+)/)
    .map((part) => {
      const replacement = corrections.get(foldForMatching(part));
      if (!replacement) return part;
      changed = true;
      return replacement;
    })
    .join("");
  return changed ? fixed : null;
}
