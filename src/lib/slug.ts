const TRANSLITERATION: Record<string, string> = {
  ə: "e", ı: "i", ö: "o", ü: "u", ş: "s", ç: "c", ğ: "g",
};

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[əıöüşçğ]/g, (ch) => TRANSLITERATION[ch])
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
