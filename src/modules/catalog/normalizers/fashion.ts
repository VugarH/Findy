import { foldForMatching } from "@/lib/text";

/**
 * Brands and article numbers for clothing, shoes, bags, watches and jewelry.
 *
 * Multi-brand stores do not always say who made a product (or name themselves
 * as the brand), so the brand is recognised from the title. The maker's
 * article number is what lets an adidas sneaker at one store match the same
 * sneaker at another: titles differ ("adidas Ultrarun 5 Erkek Beyaz Spor
 * Ayakkabı" vs "Ultrarun 5 Shoes"), the article number "IH2639" does not.
 */

/**
 * Display name of each brand we recognise; matched as whole words, longest
 * first. Leave out brands whose name is an everyday word in titles ("Mavi" is
 * Turkish for blue, "Coach" is a jacket style).
 */
const KNOWN_BRANDS = [
  "adidas", "Puma", "Nike", "Jordan", "New Balance", "Converse", "Vans", "Skechers", "Reebok", "Asics", "Under Armour",
  "The North Face", "Columbia", "Timberland", "Salomon", "Hoka", "Saucony", "Mizuno", "Fila", "Champion", "Ellesse",
  "Kappa", "Umbro", "Hummel", "Kinetix", "Lumberjack", "Crocs", "Birkenstock", "UGG", "Dr. Martens", "Clarks",
  "Lacoste", "Tommy Hilfiger", "Tommy Jeans", "Calvin Klein", "Guess", "Michael Kors", "Hugo Boss", "BOSS", "HUGO",
  "Armani Exchange", "Emporio Armani", "Polo Ralph Lauren", "Ralph Lauren", "Levi's", "Diesel", "Colin's",
  "Gant", "Nautica", "Damat", "Tween", "U.S. Polo Assn.", "Pierre Cardin", "Karl Lagerfeld", "Kate Spade", "Furla", "Herschel",
  "Eastpak", "Samsonite", "Ray-Ban", "Oakley", "Casio", "G-Shock", "Seiko", "Citizen", "Tissot", "Swatch", "Fossil",
  "Daniel Wellington", "Timex", "Orient", "Longines", "Hamilton", "Certina", "Rado", "Swiss Military", "Police",
  "Pandora", "Swarovski", "Thomas Sabo",
  // Home, baby and outdoor brands sold by multi-brand stores.
  "Tefal", "Rowenta", "Moulinex", "Krups", "Philips", "Braun", "Bosch", "Arzum", "Fakir", "De'Longhi", "Dyson", "Smeg",
  "KitchenAid", "Alessi", "WMF", "Zwilling", "Le Creuset", "Nespresso", "Stanley", "Chicco", "Cybex", "Joie",
  "Maxi-Cosi", "Inglesina", "Quiksilver", "Merrell", "Jack Wolfskin", "Helly Hansen", "Mammut", "Thule", "Osprey",
  "Black Diamond",
];

const BRAND_PATTERNS = [...KNOWN_BRANDS]
  .sort((a, b) => b.length - a.length)
  .map((brand) => ({
    brand,
    pattern: new RegExp(`(^|[^a-z0-9])${escape(foldForMatching(brand)).replace(/\\?[ .-]+/g, "[ .-]*")}($|[^a-z0-9])`),
  }));

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The brand named in a title (or URL slug), if we know it. Earliest mention wins. */
export function detectBrand(text: string): string | null {
  const folded = foldForMatching(text);
  let best: { brand: string; at: number } | null = null;
  for (const { brand, pattern } of BRAND_PATTERNS) {
    const match = pattern.exec(folded);
    if (match && (!best || match.index < best.at)) best = { brand, at: match.index };
  }
  return best?.brand ?? null;
}

/** Same brand, different spelling ("ADIDAS", "Adidas Originals")? */
export function sameBrand(a: string, b: string): boolean {
  return foldForMatching(a).replace(/[^a-z0-9]/g, "") === foldForMatching(b).replace(/[^a-z0-9]/g, "");
}

/**
 * Article-number formats, per brand. Each must be specific enough that a
 * random word or size cannot pass for one: a wrong code would merge two
 * different products.
 */
const ARTICLE_FORMATS: Record<string, { pattern: RegExp; format: (m: RegExpExecArray) => string }> = {
  // IH2639, HZ0872 (two letters + four digits) or older B75806.
  adidas: { pattern: /(?:^|[^a-z0-9])([a-z]{2}\d{4}|[a-z]\d{5})(?![a-z0-9])/, format: (m) => m[1].toUpperCase() },
  // 393279-01: style + two-digit colour.
  puma: { pattern: /(?:^|[^a-z0-9])(\d{6})[-_ ]?(\d{2})(?![0-9])/, format: (m) => `${m[1]}-${m[2]}` },
  // FN8797-456: style + three-digit colour.
  nike: { pattern: /(?:^|[^a-z0-9])([a-z]{2}\d{4})[-_ ]?(\d{3})(?![0-9])/, format: (m) => `${m[1].toUpperCase()}-${m[2]}` },
  // 11930-BKW: style + colour letters.
  skechers: { pattern: /(?:^|[^a-z0-9])(\d{5,6})[-_ ]?([a-z]{3,4})(?![a-z])/, format: (m) => `${m[1]}-${m[2].toUpperCase()}` },
  // A16106C, 162050C
  converse: { pattern: /(?:^|[^a-z0-9])([a-z]?\d{5,6}c)(?![a-z0-9])/, format: (m) => m[1].toUpperCase() },
  // U9060EEB, ML574EVG, BB550WT1, M1906RCH: model + colourway letters.
  newbalance: { pattern: /(?:^|[^a-z0-9])([a-z]{1,3}\d{3,4}[a-z]{2,3}\d?)(?![a-z0-9])/, format: (m) => m[1].toUpperCase() },
  // 1011B548-001
  asics: { pattern: /(?:^|[^a-z0-9])(1\d{3}[a-z]\d{3})[-_ ]?(\d{3})(?!\d)/, format: (m) => `${m[1].toUpperCase()}-${m[2]}` },
  // VN000H4ZBLK1
  vans: { pattern: /(?:^|[^a-z0-9])(vn0[a-z0-9]{7,9})(?![a-z0-9])/, format: (m) => m[1].toUpperCase() },
};
ARTICLE_FORMATS.jordan = ARTICLE_FORMATS.nike;

/**
 * Watch reference numbers. Kept apart from ARTICLE_FORMATS because the
 * fashion-licence formats (seven digits) would be ambiguous on clothing.
 */
const SEVEN_DIGIT_REFERENCE = { pattern: /(?<!\d)(1[5-9]\d{5}|2[0-7]\d{5})(?!\d)/, format: (m: RegExpExecArray) => m[1] };
const WATCH_FORMATS: Record<string, { pattern: RegExp; format: (m: RegExpExecArray) => string }> = {
  // GA-2100-1A (the store may add a region suffix: GA-2100-1ADR)
  casio: { pattern: /(?:^|[^a-z0-9])([a-z]{1,4})-?(\d{3,4}[a-z]{0,3})-(\d[a-z]?)/, format: (m) => `${m[1]}-${m[2]}-${m[3]}`.toUpperCase() },
  // T137.410.11.041.00
  tissot: { pattern: /(?:^|[^a-z0-9])t(\d{3})\.?(\d{3})\.?(\d{2})\.?(\d{3})\.?(\d{2})(?!\d)/, format: (m) => `T${m.slice(1, 6).join(".")}` },
  // SRPD55K1 -> SRPD55
  seiko: { pattern: /(?:^|[^a-z0-9])(s[a-z]{2}[a-z0-9]\d{2,3})(?:[kjp]1)?(?![a-z0-9])/, format: (m) => m[1].toUpperCase() },
  // BM7108-81L
  citizen: { pattern: /(?:^|[^a-z0-9])([a-z]{2}\d{4}-\d{2}[a-z])(?![a-z0-9])/, format: (m) => m[1].toUpperCase() },
  // Movado-group licences: Tommy Hilfiger 1782614, Lacoste 2001301 (stores prefix "TH", "LAC"), BOSS 1513xxx.
  tommyhilfiger: SEVEN_DIGIT_REFERENCE,
  lacoste: SEVEN_DIGIT_REFERENCE,
  hugoboss: SEVEN_DIGIT_REFERENCE,
  boss: SEVEN_DIGIT_REFERENCE,
  calvinklein: SEVEN_DIGIT_REFERENCE,
};
WATCH_FORMATS.gshock = WATCH_FORMATS.casio;

/** Season tags ("SS25", "FW2025") look like article numbers but are not. */
const SEASON = /^(ss|fw|aw|sp|su|ho)\d{2,4}$/i;

/**
 * The maker's article number for `brand`, from the first candidate that
 * contains one (pass the most reliable source first: the structured-data
 * mpn/sku, then the URL, then the title). For watches, the reference number.
 */
export function articleNumberOf(
  brand: string | null | undefined,
  candidates: (string | null | undefined)[],
  category?: string,
): string | null {
  const key = brand ? foldForMatching(brand).replace(/[^a-z]/g, "") : "";
  const format = category === "watches" ? WATCH_FORMATS[key] : ARTICLE_FORMATS[key];
  if (!format) return null;
  for (const candidate of candidates) {
    if (!candidate) continue;
    const match = format.pattern.exec(foldForMatching(candidate));
    if (match && !SEASON.test(match[1])) return format.format(match);
  }
  return null;
}

/** The title without the brand in front ("adidas Samba OG" -> "Samba OG"). */
export function stripBrand(title: string, brand: string): string {
  const clean = title.replace(/\s+/g, " ").trim();
  const folded = foldForMatching(clean);
  const brandFolded = foldForMatching(brand);
  const rest = folded.startsWith(brandFolded) ? clean.slice(brand.length) : clean;
  return rest.replace(/^[\s|:–-]+/, "").trim() || clean;
}
