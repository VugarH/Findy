/**
 * Stores name the same phone differently:
 *   "Smartfon HONOR X8e 6GB/256GB Gold"            (Baku Electronics)
 *   "HONOR X8E 6/256GB GOLD"                       (Soliton)
 *   "SAMSUNG GALAXY A27 (SM-A276) 8/256GB BLACK"
 * This turns a title into brand + model + memory, which is what identifies the
 * product. Colour is kept as a variant of the offer, not of the product, so
 * every colour of a phone competes on the same product page.
 */
export interface ParsedPhone {
  brand: string;
  /** Canonical model including memory, e.g. "X8e 6/256GB" or "iPhone 17 Pro 256GB". */
  model: string;
  color: string | null;
}

/** Title word -> canonical brand. Sub-brands map to their parent. */
const BRANDS: Record<string, string> = {
  apple: "Apple",
  iphone: "Apple",
  samsung: "Samsung",
  galaxy: "Samsung",
  xiaomi: "Xiaomi",
  redmi: "Xiaomi",
  poco: "Xiaomi",
  honor: "Honor",
  motorola: "Motorola",
  moto: "Motorola",
  infinix: "Infinix",
  tecno: "Tecno",
  vivo: "Vivo",
  oppo: "Oppo",
  realme: "Realme",
  nokia: "Nokia",
  itel: "Itel",
  google: "Google",
  oneplus: "OnePlus",
  nothing: "Nothing",
  huawei: "Huawei",
  zte: "ZTE",
  energizer: "Energizer",
};

/** Brand words that are dropped from the model because the brand already says it. */
const BRAND_ONLY_WORDS = new Set(["apple", "samsung", "xiaomi", "honor", "motorola", "infinix", "tecno", "vivo", "oppo", "realme", "nokia", "itel", "google", "oneplus", "nothing", "huawei", "zte", "energizer"]);

const NOISE_WORDS = new Set(["smartfon", "smartphone", "telefon", "mobil", "telefonu", "смартфон", "dual", "sim", "ds"]);
const KEEP_UPPER = new Set(["nfc", "fe", "se", "gt", "5g", "4g", "lte", "ai", "xl", "xr", "xs"]);

// "8GB/256GB", "8/256GB", "8 GB / 256 GB", "12GB+512GB"
const RAM_STORAGE = /(\d{1,2})\s*(?:gb)?\s*[/+]\s*(\d{2,4}|[12])\s*(gb|tb)/i;
// "256GB", "2 TB" (phones sold without a RAM figure, e.g. iPhone)
const STORAGE_ONLY = /(\d{2,4}|[12])\s*(gb|tb)\b/i;

export function parsePhoneTitle(title: string): ParsedPhone | null {
  // Samsung model codes such as "(SM-A276)" or "SM-A276B/DS" are not part of the name.
  const clean = title.replace(/\(?\bsm-?[a-z]\d{3,4}[a-z]*(?:\/ds)?\)?/gi, " ").replace(/\s+/g, " ").trim();

  const memory = RAM_STORAGE.exec(clean) ?? STORAGE_ONLY.exec(clean);
  if (!memory) return null;

  const before = clean.slice(0, memory.index).trim();
  const after = clean.slice(memory.index + memory[0].length).trim();

  const words = before.split(" ").filter((word) => word && !NOISE_WORDS.has(word.toLowerCase()));
  const brandWord = words.find((word) => BRANDS[word.toLowerCase()]);
  if (!brandWord) return null;
  const brand = BRANDS[brandWord.toLowerCase()];

  const modelWords = words.filter((word) => !BRAND_ONLY_WORDS.has(word.toLowerCase())).map(formatWord);
  if (modelWords.length === 0) return null;

  const memoryLabel =
    memory.length === 4
      ? `${memory[1]}/${memory[2]}${memory[3].toUpperCase()}`
      : `${memory[1]}${memory[2].toUpperCase()}`;

  const color = after.replace(/^[\s,()-]+|[\s,()-]+$/g, "");
  return {
    brand,
    model: `${modelWords.join(" ")} ${memoryLabel}`,
    color: color ? color.split(" ").map(formatWord).join(" ") : null,
  };
}

function formatWord(word: string): string {
  const lower = word.toLowerCase();
  if (lower === "iphone") return "iPhone";
  if (KEEP_UPPER.has(lower)) return word.toUpperCase();
  // Shouted words ("GALAXY") become "Galaxy"; mixed tokens ("X8e", "A27") are kept.
  if (/^[A-ZƏÖÜŞÇĞİ]{3,}$/.test(word)) return word[0] + lower.slice(1);
  return word;
}
