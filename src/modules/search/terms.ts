import { and, desc, eq, inArray, like, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { searchTerms } from "@/db/schema";
import type { MarketConfig } from "@/config/markets";
import { foldForMatching } from "@/lib/text";
import { freshSince } from "@/modules/catalog/offer-view";
import { bestCorrection, correctedQuery, maxTypos, wordsToCheck, type SpellingCandidate } from "./spelling";
import { expandQuery } from "./synonyms";

/**
 * The words search knows (search_terms): brands and title words of products a
 * store sells now, and searches people repeat. Rebuilt by the daily job, so
 * suggestions and spelling fixes read one small table instead of the catalog.
 */

export interface SearchSuggestion {
  kind: "brand" | "query";
  label: string;
}

/** The same folding as foldForMatching, in SQL. */
const fold = (column: string) => `translate(lower(translate(${column}, 'İ', 'i')), 'çşğöüıə', 'csgouie')`;

/** Searches kept as suggestions: asked at least this often in the last 90 days, and they found something. */
const MIN_QUERY_COUNT = 2;
/** A title word must appear in this many products: rarer ones are usually typos themselves. */
const MIN_WORD_PRODUCTS = 3;

/** Recomputes the market's terms. All counting happens in the database; nothing is sent back. */
export async function refreshSearchTerms(market: MarketConfig, now = new Date()): Promise<number> {
  const since = freshSince(market, now).toISOString();
  const live = `p.active and exists (select 1 from offers o where o.product_id = p.id and o.last_seen_at >= '${since}'::timestamptz and o.removed_at is null)`;
  const code = market.code;
  return db.transaction(async (tx) => {
    await tx.delete(searchTerms).where(eq(searchTerms.marketCode, code));
    // Brands, under the spelling most products use.
    await tx.execute(
      sql.raw(`insert into search_terms (market_code, kind, folded, label, weight)
        select '${code}', 'brand', ${fold("p.brand")}, mode() within group (order by p.brand), count(*)
        from products p where p.brand is not null and length(trim(p.brand)) >= 2 and ${live}
        group by ${fold("p.brand")}`),
    );
    // Title words: the vocabulary spelling fixes compare against.
    await tx.execute(
      sql.raw(`insert into search_terms (market_code, kind, folded, label, weight)
        select '${code}', 'word', w, w, count(distinct p.id)
        from products p, regexp_split_to_table(${fold("p.title")}, '[^a-z0-9а-яё]+') as w
        where length(w) between 3 and 30 and w !~ '[0-9]' and ${live}
        group by w having count(distinct p.id) >= ${MIN_WORD_PRODUCTS}`),
    );
    // What people search for and find.
    await tx.execute(
      sql.raw(`insert into search_terms (market_code, kind, folded, label, weight)
        select '${code}', 'query', ${fold("q.query")}, min(q.query), sum(q.count)
        from search_queries q
        where q.market_code = '${code}' and q.count >= ${MIN_QUERY_COUNT} and q.last_result_count > 0
          and q.last_searched_at >= now() - interval '90 days'
        group by ${fold("q.query")}`),
    );
    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(searchTerms)
      .where(eq(searchTerms.marketCode, code));
    return count;
  });
}

const escapeLike = (text: string) => text.replace(/[\\%_]/g, "\\$&");

/**
 * Suggestions while typing: popular searches and brands that start with what
 * was typed, most used first.
 */
export async function suggestSearches(market: MarketConfig, typed: string, limit = 8): Promise<SearchSuggestion[]> {
  const prefix = foldForMatching(typed.trim().replace(/\s+/g, " "));
  if (prefix.length < 2) return [];
  const rows = await db
    .select({ kind: searchTerms.kind, folded: searchTerms.folded, label: searchTerms.label })
    .from(searchTerms)
    .where(
      and(
        eq(searchTerms.marketCode, market.code),
        inArray(searchTerms.kind, ["brand", "query"]),
        like(searchTerms.folded, `${escapeLike(prefix)}%`),
      ),
    )
    .orderBy(desc(searchTerms.weight))
    .limit(limit * 2);
  // A brand that is also a popular search shows once, as the brand.
  const seen = new Set<string>();
  const ordered = [...rows.filter((r) => r.kind === "brand").slice(0, 3), ...rows.filter((r) => r.kind === "query")];
  return ordered
    .filter((row) => (seen.has(row.folded) || row.folded === prefix ? false : (seen.add(row.folded), true)))
    .slice(0, limit)
    .map((row) => ({ kind: row.kind as SearchSuggestion["kind"], label: row.label }));
}

/** Known words a misspelt word may stand for, read per query word (only when a search found nothing). */
const CANDIDATES_PER_LOOKUP = 200;

/**
 * The query with misspelt words fixed ("adidsa krossovka" → "adidas krossovka"),
 * or null when every word is known or nothing known is close enough.
 */
export async function correctSearch(market: MarketConfig, query: string): Promise<string | null> {
  // Words search already understands through its synonyms are never "fixed".
  const words = wordsToCheck(query).filter((word) => expandQuery(word)[0]?.alternatives.length === 1);
  if (words.length === 0) return null;
  const corrections = new Map<string, string>();
  for (const word of words) {
    const best = bestCorrection(word, await spellingCandidates(market, word));
    if (best) corrections.set(word, best);
  }
  return correctedQuery(query, corrections);
}

/**
 * Words that look like `word` (trigram match), and words with its first letter
 * and nearly its length: a swap of two letters ("nkie") shares too few
 * trigrams with the word meant to be found by the first.
 */
async function spellingCandidates(market: MarketConfig, word: string): Promise<SpellingCandidate[]> {
  const known = and(eq(searchTerms.marketCode, market.code), inArray(searchTerms.kind, ["brand", "word"]));
  const columns = { folded: searchTerms.folded, weight: searchTerms.weight };
  const [alike, sameStart] = await Promise.all([
    db
      .select(columns)
      .from(searchTerms)
      // `%` is the trigram index's "similar enough" test (pg_trgm.similarity_threshold, 0.3 by default).
      .where(and(known, sql`${searchTerms.folded} % ${word}`))
      .orderBy(desc(sql`similarity(${searchTerms.folded}, ${word})`))
      .limit(20),
    db
      .select(columns)
      .from(searchTerms)
      .where(
        and(
          known,
          like(searchTerms.folded, `${escapeLike(word[0])}%`),
          sql`length(${searchTerms.folded}) between ${word.length - maxTypos(word)} and ${word.length + maxTypos(word)}`,
        ),
      )
      .orderBy(desc(searchTerms.weight))
      .limit(CANDIDATES_PER_LOOKUP),
  ]);
  return [...alike, ...sameStart];
}
