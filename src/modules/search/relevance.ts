import type { CategorySlug } from "@/config/categories";
import { classifyProduct, OTHER_SUBCATEGORY, type SubcategorySlug } from "@/config/subcategories";
import { foldForMatching } from "@/lib/text";
import { expandQuery } from "./synonyms";

/**
 * How well a search result matches what was searched for, for the default
 * "relevance" order (pure). Two signals, strongest first:
 *
 *   1. The kind of thing asked for. The query goes through the same type rules
 *      as product titles: "iphone 16" reads as a phone, "iphone 16 case" as a
 *      case, so the phone itself comes before the accessories that mention it.
 *   2. The words in the product's name: all together ("iphone 16") beats all
 *      present, which beats a match on the brand only.
 *
 * Ties keep their order (best discount first). New signals are one more term here.
 */
export interface Scorable {
  title: string;
  categorySlug: CategorySlug;
  subcategorySlug: string;
}

export function relevanceScorer(query: string): (card: Scorable) => number {
  const terms = expandQuery(query);
  if (terms.length === 0) return () => 0;
  const words = foldForMatching(query).split(/\s+/).filter(Boolean);
  // The query read as a title, with synonyms ("айфон" → iphone), per category.
  const queryText = terms.flatMap((term) => term.alternatives).join(" ");
  const intents = new Map<CategorySlug, SubcategorySlug | null>();
  const intentIn = (category: CategorySlug) => {
    if (!intents.has(category)) {
      const slug = classifyProduct(category, queryText);
      intents.set(category, slug === OTHER_SUBCATEGORY ? null : slug);
    }
    return intents.get(category)!;
  };

  return (card) => {
    const title = ` ${foldForMatching(card.title)} `;
    const intent = intentIn(card.categorySlug);
    const kind = intent !== null && card.subcategorySlug === intent ? 4 : 0;
    const phrase = title.includes(` ${words.join(" ")}`) ? 2 : 0;
    const allWords = terms.every((term) => term.alternatives.some((word) => title.includes(word))) ? 1 : 0;
    return kind + Math.max(phrase, allWords);
  };
}
