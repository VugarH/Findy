/** Words that turn a product into a different model ("Pro", "Max"…). */
const VARIANT_WORDS = new Set(["pro", "max", "ultra", "plus", "lite", "mini", "fe", "se", "air", "note", "neo", "5g", "4g"]);

/**
 * Names can be nearly identical and still be different products: "Honor 600"
 * vs "Honor 600 Pro", "8/256GB" vs "12/256GB". Two names count as the same
 * item only if they also agree on every number and every variant word.
 */
export function namesDescribeSameItem(a: string, b: string): boolean {
  const signature = (title: string) => {
    const tokens = title.toLowerCase().match(/[a-z]+|\d+/g) ?? [];
    return tokens.filter((token) => /^\d+$/.test(token) || VARIANT_WORDS.has(token)).sort().join(" ");
  };
  return signature(a) === signature(b);
}
