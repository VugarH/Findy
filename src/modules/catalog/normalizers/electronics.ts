import { parsePhoneTitle } from "./phones";

/**
 * Brand + model for any electronics title. Phones and tablets go through the
 * phone parser (memory identifies the model); everything else is cleaned of
 * the product-type words stores put in front ("Noutbuk", "Qulaqlıq"…), so
 * "Noutbuk Apple MacBook Air 13 M3" and "Apple MacBook Air 13 M3" become the
 * same product.
 */
export interface ParsedElectronics {
  brand: string;
  model: string;
  color: string | null;
}

/** Product-type words (Azerbaijani, Russian, English) that are not part of a product's name. */
const TYPE_WORDS =
  /^(?:smartfon|smartphone|telefon|mobil telefon|noutbuk|notbuk|laptop|ultrabuk|planşet|planset|tablet|qulaqlıq|qulaqliq|qulaqcıq|simsiz qulaqlıq|smart saat|ağıllı saat|saat|oyun konsolu|konsol|televizor|tv|monoblok|monitor|robot tozsoran|tozsoran|fitnes qolbaq|qolbaq|dinamik|portativ dinamik|powerbank)\s+/i;

const KNOWN_BRANDS = [
  "Apple", "Samsung", "Xiaomi", "Honor", "Huawei", "Motorola", "Infinix", "Tecno", "Vivo", "Oppo", "Realme", "Nokia",
  "Google", "OnePlus", "Nothing", "Lenovo", "HP", "Asus", "Acer", "Dell", "MSI", "Microsoft", "Sony", "JBL", "LG", "TCL",
  "Hisense", "Philips", "Bosch", "Dyson", "Garmin", "Amazfit", "Nintendo", "Marshall", "Bose", "Beats", "Anker",
  "Logitech", "Razer", "Roborock", "Dreame", "Canon", "Nikon", "GoPro", "DJI", "Haylou", "QCY", "Baseus", "Hoco",
];
const BRAND_BY_WORD = new Map(KNOWN_BRANDS.map((brand) => [brand.toLowerCase(), brand]));
/** Product lines that imply their brand when a store leaves the brand out. */
const LINE_BRANDS: Record<string, string> = {
  iphone: "Apple", ipad: "Apple", macbook: "Apple", airpods: "Apple", imac: "Apple",
  galaxy: "Samsung", redmi: "Xiaomi", poco: "Xiaomi", playstation: "Sony", ps5: "Sony", xbox: "Microsoft",
  thinkpad: "Lenovo", ideapad: "Lenovo", vivobook: "Asus", zenbook: "Asus",
};

export function parseElectronicsTitle(title: string): ParsedElectronics | null {
  const phone = parsePhoneTitle(title);
  // The phone parser can be fooled by specs in long titles; trust it only for clean names.
  if (phone && /^[\p{L}\d\s+./-]+$/u.test(phone.model)) return phone;

  let clean = title.replace(/\s+/g, " ").trim();
  // A title may start with two type words ("Simsiz qulaqlıq").
  for (let i = 0; i < 2; i++) clean = clean.replace(TYPE_WORDS, "");
  const words = clean.split(" ").filter(Boolean);
  if (words.length < 2) return null;

  const brandIndex = words.findIndex((word) => BRAND_BY_WORD.has(word.toLowerCase()));
  const lineWord = words.find((word) => LINE_BRANDS[word.toLowerCase()]);
  const brand =
    brandIndex >= 0 ? BRAND_BY_WORD.get(words[brandIndex].toLowerCase())! : lineWord ? LINE_BRANDS[lineWord.toLowerCase()] : null;
  if (!brand) return null;

  const model = words.filter((_, index) => index !== brandIndex).join(" ");
  return model ? { brand, model, color: null } : null;
}
