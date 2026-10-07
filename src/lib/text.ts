const FOLDED: Record<string, string> = { ç: "c", ş: "s", ğ: "g", ö: "o", ü: "u", ı: "i", ə: "e" };

/**
 * Lower-cases a product title and folds Turkish/Azerbaijani letters to plain
 * Latin ones, for keyword rules. Stores write "Çanta", "CANTA" and "canta" (and
 * URL slugs are always ASCII), and JavaScript's lower-casing of "İ" leaves a
 * stray combining dot. Rules matched against this text are written in ASCII.
 */
export function foldForMatching(text: string): string {
  return text
    .replace(/İ/g, "i")
    .toLowerCase()
    .replace(/[çşğöüıə]/g, (ch) => FOLDED[ch]);
}
