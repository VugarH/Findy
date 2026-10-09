import type { Audience } from "@/config/audience";
import { foldForMatching } from "@/lib/text";

/**
 * People search in Azerbaijani, Russian or English; most product titles are
 * Turkish or English. Each query word is widened to the words a matching
 * title would contain, so "qadın krossovka" and "женские кроссовки" both find
 * "Kadın Spor Ayakkabı" and "Women's Sneaker".
 *
 * A group lists the words people type (`words`: whole words; `stems`: word
 * beginnings, for languages that inflect) and what titles say (`titles`).
 * Everything is in foldForMatching form: lower case, Turkish/Azerbaijani
 * letters as plain ASCII, Cyrillic as is. A title word with a leading space
 * (" ring") must start a word. To support a new term, add a group.
 */
interface SynonymGroup {
  words?: string[];
  stems?: string[];
  titles: string[];
  /** The word names who the product is for; products tagged with that audience match too. */
  audience?: Audience;
}

const GROUPS: SynonymGroup[] = [
  // Who it is for
  { words: ["qadin", "qadinlar", "kadin", "bayan", "women", "womens", "ladies"], stems: ["женск", "женщин"], titles: ["kadin", "women", "wmns", "ladies", "bayan"], audience: "women" },
  { words: ["kisi", "kisiler", "erkek", "men", "mens"], stems: ["мужск", "мужчин"], titles: ["erkek", "men's", "mens", " men "], audience: "men" },
  { words: ["usaq", "usaqlar", "cocuk", "kids", "kid", "baby", "bebek"], stems: ["детск", "ребен"], titles: ["cocuk", "kids", "kid's", "junior", "bebek", "baby", "toddler"], audience: "kids" },

  // Shoes
  { stems: ["krossovk", "krosovk", "кроссов", "sneaker", "snikers"], words: ["кеды", "кед"], titles: ["sneaker", "spor ayakkab", "trainer", "kosu ayakkab", "running shoe"] },
  { stems: ["ayaqqab", "ayakkab", "обув", "туфл", "shoe"], titles: ["ayakkab", "shoe", "footwear", "sneaker", "loafer", "boot"] },
  { words: ["bot", "botlar", "boots", "boot"], stems: ["ботин", "сапог"], titles: ["bot", "boot", "cizme"] },
  { stems: ["sandal", "босонож", "сандал", "terlik", "шлепан", "slipper"], titles: ["sandal", "terlik", "slipper", "slide"] },

  // Clothing
  { stems: ["futbolk", "футболк", "tisort", "t-shirt", "tshirt"], titles: ["tisort", "t-shirt", "tee"] },
  { stems: ["koynek", "рубаш", "gomlek"], words: ["shirt", "shirts"], titles: ["gomlek", "shirt"] },
  { stems: ["salvar", "брюк", "штан", "pantolon", "trouser"], words: ["pants"], titles: ["pantolon", "trouser", "pants", "jogger"] },
  { words: ["cins", "jean", "jeans"], stems: ["джинс"], titles: ["jean", "denim"] },
  { stems: ["godekce", "куртк", "курток", "ceket", "jacket", "mont"], titles: ["ceket", "mont", "jacket", "coat", "parka"] },
  { stems: ["palto", "пальто", "kaban", "coat"], titles: ["kaban", "coat", "palto", "trenckot", "trench"] },
  { words: ["don", "donlar", "dress", "elbise"], stems: ["плать", "платье"], titles: ["elbise", "dress"] },
  { stems: ["etek", "юбк", "skirt"], titles: ["etek", "skirt"] },
  { stems: ["sviter", "свитер", "худи", "толстовк", "hoodie", "kazak", "sweat"], titles: ["kazak", "sweater", "sweatshirt", "hoodie", "triko"] },
  { words: ["sort", "sortlar", "shorts"], stems: ["шорт"], titles: ["sort", "short"] },
  { stems: ["kostyum", "костюм"], words: ["suit", "suits"], titles: ["takim elbise", "suit", "blazer", "esofman"] },
  { stems: ["corab", "corap", "носк", "носок", "sock"], titles: ["corap", "sock"] },
  { stems: ["idman", "спортив", "tracksuit", "esofman"], titles: ["esofman", "tracksuit", "training", "antrenman", "sport"] },

  // Accessories (bags, wallets, belts, caps, sunglasses)
  { stems: ["canta", "сумк", "сумоч", "bag"], titles: ["canta", "bag", "tote", "clutch"] },
  { stems: ["рюкзак", "ryukzak", "backpack"], titles: ["sirt canta", "backpack"] },
  { stems: ["кошел", "бумажн", "wallet", "cuzdan", "pulqab"], titles: ["cuzdan", "wallet", "kartlik", "card holder"] },
  { stems: ["kemer", "ремен", "ремн", "belt"], titles: ["kemer", "belt"] },
  { stems: ["eynek", "очк", "gozluk", "sunglass"], titles: ["gozluk", "sunglass", "eyewear"] },
  { stems: ["papaq", "кепк", "шапк", "kepka", "sapka"], words: ["cap", "caps", "hat", "hats"], titles: ["sapka", "cap", "hat", "bere", "beanie"] },

  // Watches & jewelry
  { words: ["saat", "saatlar", "saati", "watch", "watches"], stems: ["часы", "часов"], titles: ["saat", "watch"] },
  { stems: ["boyunbag", "ожерел", "колье", "цепоч", "kolye", "necklace", "zencir"], titles: ["kolye", "necklace", "chain", "zincir"] },
  { stems: ["sirga", "серьг", "kupe", "earring"], titles: ["kupe", "earring", "hoop"] },
  { stems: ["uzuk", "кольц", "yuzuk"], words: ["ring", "rings"], titles: ["yuzuk", " ring", "alyans"] },
  { stems: ["qolbaq", "браслет", "bileklik", "bracelet"], titles: ["bileklik", "bilezik", "bracelet", "bangle"] },
  { stems: ["qizil", "золот", "altin"], words: ["gold"], titles: ["altin", "gold"] },
  { stems: ["gumus", "серебр", "silver"], titles: ["gumus", "silver", "925"] },

  // Beauty
  { stems: ["etir", "духи", "парфюм", "parfum", "perfume"], titles: ["parfum", "perfume", "eau de", "edt", "edp"] },
  { stems: ["pomad", "помад", "lipstick"], words: ["ruj"], titles: ["ruj", "lipstick", "lip"] },
  { stems: ["krem", "крем", "cream"], titles: ["krem", "cream"] },
  { stems: ["sampun", "шампун", "sampuan", "shampoo"], titles: ["sampuan", "shampoo"] },
  { stems: ["тушь", "maskara", "mascara"], titles: ["maskara", "mascara"] },

  // Electronics
  { stems: ["telefon", "телефон", "smartfon", "смартфон", "smartphone"], words: ["phone"], titles: ["telefon", "phone", "smartfon", "smartphone"] },
  { stems: ["noutbuk", "ноутбук", "laptop", "notebook"], titles: ["noutbuk", "laptop", "notebook", "macbook"] },
  { stems: ["qulaqliq", "наушник", "kulaklik", "headphone", "earbud"], titles: ["qulaqliq", "kulaklik", "headphone", "earbud", "airpods"] },
  { stems: ["planset", "планшет", "tablet"], titles: ["planset", "tablet", "ipad"] },

  // Brands as people spell them in Russian or Azerbaijani
  { stems: ["адидас"], titles: ["adidas"] },
  { stems: ["найк"], titles: ["nike"] },
  { words: ["пума"], titles: ["puma"] },
  { stems: ["конверс"], titles: ["converse"] },
  { stems: ["касио"], titles: ["casio"] },
  { stems: ["лакост"], titles: ["lacoste"] },
  { stems: ["айфон", "ayfon"], titles: ["iphone"] },
  { stems: ["самсунг"], titles: ["samsung"] },
  { stems: ["сяоми", "ксиоми", "ksiaomi"], titles: ["xiaomi"] },
];

/** Stems shorter than this would match unrelated words. */
const MIN_STEM_MATCH = 3;

export interface QueryTerm {
  /** The title must contain one of these (folded) strings. */
  alternatives: string[];
  /** …or the product must be tagged with this audience. */
  audience?: Audience;
}

/** One term per query word, each widened by its synonym group. Every term must match. */
export function expandQuery(query: string): QueryTerm[] {
  const words = foldForMatching(query).split(/\s+/).filter(Boolean);
  return words.map((word) => {
    const group = GROUPS.find(
      (g) =>
        g.words?.includes(word) ||
        g.stems?.some((stem) => word.length >= MIN_STEM_MATCH && word.startsWith(stem)),
    );
    if (!group) return { alternatives: [word] };
    return { alternatives: [...new Set([word, ...group.titles])], audience: group.audience };
  });
}
