import { foldForMatching } from "@/lib/text";

/**
 * Who a product is for. Clothing, shoes, watches and jewelry are browsed this
 * way first, and store titles almost always say it ("Kadın Spor Ayakkabı",
 * "Men's Watch", "Çocuk Tişört"). Products whose title says nothing have no
 * audience and only show when no audience is selected.
 */
export const AUDIENCES = ["women", "men", "kids", "unisex"] as const;
export type Audience = (typeof AUDIENCES)[number];

export function isAudience(value: string): value is Audience {
  return (AUDIENCES as readonly string[]).includes(value);
}

// Matched against foldForMatching text (plain ASCII), English, Turkish and Azerbaijani.
const KIDS = /cocuk|\bkids?\b|\bkid's|junior|\bjr\b|bebek|\bbaby\b|toddler|infant|\b(boys?|girls?)\b|\b(td|ps|gs)\b|grade school|\byouth\b|\busaq\b|\bkiz\b|\boglan\b/;
const WOMEN = /kadin|\bwomen|\bwmns\b|\bladies\b|\blady\b|bayan|\bfemme\b|\bqadin|\bfor her\b/;
const MEN = /erkek|\bmen\b|\bmens\b|\bmen's|\bhomme\b|\bkisi\b|\bgents?\b|\bfor him\b/;
const UNISEX = /unisex/;

export function detectAudience(text: string): Audience | null {
  const folded = foldForMatching(text);
  if (KIDS.test(folded)) return "kids";
  const women = WOMEN.test(folded);
  const men = MEN.test(folded);
  if (UNISEX.test(folded) || (women && men)) return "unisex";
  if (women) return "women";
  if (men) return "men";
  return null;
}
