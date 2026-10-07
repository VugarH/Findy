import { foldForMatching } from "@/lib/text";

/**
 * Product categories. To launch a new category: add it here, add its name to
 * each dictionary in src/i18n/dictionaries, give it subcategory rules in
 * ./subcategories.ts, a colour token in globals.css, and point stores at it.
 */
export const CATEGORIES = [
  { slug: "electronics", icon: "smartphone", defaultWeightKg: 0.8 },
  { slug: "fashion", icon: "shirt", defaultWeightKg: 0.6 },
  { slug: "shoes", icon: "footprints", defaultWeightKg: 1.2 },
  { slug: "bags", icon: "shopping-bag", defaultWeightKg: 0.7 },
  { slug: "watches", icon: "watch", defaultWeightKg: 0.4 },
  { slug: "jewelry", icon: "gem", defaultWeightKg: 0.1 },
  { slug: "home", icon: "cooking-pot", defaultWeightKg: 3 },
  { slug: "baby", icon: "baby", defaultWeightKg: 4 },
  { slug: "sports", icon: "dumbbell", defaultWeightKg: 2 },
  { slug: "beauty", icon: "sparkles", defaultWeightKg: 0.3 },
  { slug: "toys", icon: "blocks", defaultWeightKg: 1.5 },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];
export type CategoryIcon = (typeof CATEGORIES)[number]["icon"];

export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug) as CategorySlug[];

export function isCategorySlug(value: string): value is CategorySlug {
  return (CATEGORY_SLUGS as string[]).includes(value);
}

/** Categories bought by size: their deal lists get a size filter. */
export const SIZED_CATEGORIES: readonly CategorySlug[] = ["fashion", "shoes", "sports", "baby"];

export const isSizedCategory = (slug: CategorySlug | undefined): boolean =>
  slug !== undefined && SIZED_CATEGORIES.includes(slug);

export function getCategory(slug: CategorySlug) {
  return CATEGORIES.find((c) => c.slug === slug)!;
}

/**
 * Words that put a product into a category, for stores that sell several
 * (a sneaker shop also sells T-shirts and bags). Checked in this order, so the
 * more specific categories come first: a "chain bag" is a bag, not jewelry,
 * and a "watch strap" belongs with watches. Titles are English or Turkish,
 * matched after foldForMatching, so they are written in plain ASCII.
 */
const CATEGORY_HINTS: [CategorySlug, RegExp][] = [
  ["shoes", /ayakkab|sneaker|\bshoes?\b|\bboots?\b|\bbot\b|cizme|terlik|sandalet|\bsandals?\b|slipper|loafer|makosen|babet|\bheels?\b|topuklu|espadril|footwear|\btrainers?\b|krampon|\bclogs?\b|\bslides?\b|flip.?flops?|\bmules?\b|\bpumps?\b|\b(lows|mids|highs)\b|(low|high|mid)[ -]top|\bsneaks\b/],
  ["bags", /canta|\bbags?\b|backpack|\btote\b|clutch|cuzdan|\bwallets?\b|kartlik|card ?holder|\bkemer\b|\bbelts?\b|sapka|\bcaps?\b|\bhats?\b|snapback|strapback|headwear|trucker|59fifty|9forty|\bbere\b|beanie|gozlu[kg]|sunglass|eyewear|\batki|\bscarf|eldiven|\bgloves?\b|valiz|bavul|luggage|suitcase|duffel|anahtarlik|keychain/],
  ["watches", /kol saati|\bsaat(i|ler|leri)?\b|\bwatch(es)?\b|chronograph|kronograf|smartwatch|akilli saat|\bclocks?\b/],
  ["jewelry", /kolye|kupe|yuzuk|bileklik|bilezik|halhal|necklace|earring|\brings?\b|bracelet|bangle|anklet|pendant|\bcharms?\b|piercing|brooch|bros|\btaki(\b|lar)|jewel|mucevher|pirlanta|diamond|\bpearls?\b|\binci\b|cufflink|kol dugme|\bzincir\b|\bchains?\b/],
  ["baby", /bebek arabasi|puset|stroller|\bprams?\b|travel system|oto koltugu|car ?seat|isofix|mama sandalyesi|high ?chair|biberon|bottle warmer|emzik|pacifier|bebek telsizi|baby monitor|besik|\bcribs?\b|bassinet|park yatak|playard|kanguru|baby carrier|nursery|diaper|\bbez\b|emzirme|breast ?pump|gogus pompasi|sterili[sz]/],
  ["home", /kahve makine|coffee|espresso|french press|grinder|ogutucu|blender|mikser|\bmixer|air ?fryer|airfryer|fritoz|tost makine|toaster|kettle|su isitici|cay makine|caydanlik|tencere|\btava\b|\bpans?\b|cookware|skillet|dutch oven|\bwok\b|bicak|knife|knives|supurge|vacuum|\butu\b|\biron\b|steamer|buharli|air purifier|hava temizle|nemlendirici|humidifier|nem alma|\bfan\b|vantilator|heater|isitici|radiator|\bfirin|\boven\b|pizza|mutfak|kitchen|tabak|\bplates?\b|bardak|\bglass(es)?\b|\bmugs?\b|fincan|\bcups?\b|termos|tumbler|thermos|saklama kab|food storage|dograyici|food processor|rondo|sikacak|juicer|sac kurutma|hair dryer|duzlestirici|straightener|airwrap|tiras makine|shaver|trimmer|epilat|elektrikli dis|electric toothbrush|frother|sut kopur|waffle|izgara|grill|dehydrator|mutfak tartisi|kitchen scale|multicooker|pressure cooker|duduklu/],
  ["beauty", /parfum|perfume|\bedt\b|\bedp\b|eau de|kolonya|cologne|deodorant|\bdeo\b|roll-on|\bruj\b|lipstick|maskara|mascara|fondoten|foundation|kapatici|concealer|allik|blush|eyeliner|\boje\b|nail polish|makyaj|makeup|\bkrem|cream|serum|tonik|toner|losyon|lotion|sampuan|shampoo|sac (spreyi|boyasi|bakim|kremi|maskesi)|hair|cilt|skin|\byuz\b|dudak|\blip|\bgoz\b|\beye|gunes|\bspf\b|nemlendir|moistur|temizle|cleans|peeling|maske|\bmask\b|vucut|\bbody\b|\bdus\b|shower|sabun|soap|tiras|shav|epilasyon|\bwax\b|dis macunu|toothpaste|\bfirca|brush|\bpudra|powder|primer|bronzer|highlighter|\bfar\b|kas kalemi|kirpik|lash|kalem|balm|tinted|tirnak|\bnails?\b|base coat|top coat|\bface\b/],
  ["fashion", /t-?shirt|tisort|gomlek|shirt|elbise|dress|\betek\b|skirt|pantolon|trousers|\bpants\b|\bjeans?\b|denim|\bsort|shorts|bermuda|ceket|jacket|\bmont\b|\bcoat|kaban|parka|blazer|yelek|\bvest\b|kazak|sweater|hirka|cardigan|sweatshirt|hoodie|hoody|esofman|tracksuit|\btayt|legging|bluz|blouse|\bpolo\b|atlet|\btank\b|\bbody\b|tulum|jumpsuit|pijama|pyjama|ic giyim|underwear|boxer|kulot|sutyen|\bbra\b|corap|\bsocks?\b|mayo|bikini|swim|triko|knit|takim|\bsuit\b|\btops?\b|crop|forma|jersey|kimono|trenckot|trench|fleece|polar|overshirt|\btee\b|joggers?|\bcrew\b/],
  // After clothing, so a "ski jacket" or "yoga leggings" stays clothing.
  ["sports", /dumbbell|dambil|kettlebell|barbell|halter|agirlik plak|\bweights?\b|\byoga\b|pilates|\bmat\b|kosu bandi|treadmill|bisiklet|bicycle|cycling|\bbikes?\b|\bkask|helmet|cadir|\btents?\b|uyku tulumu|sleeping bag|\bkamp|camping|trekking|hiking|baston|trekking pole|kayak|\bskis?\b|snowboard|raket|racket|padel|badminton|\btopu\b|\bballs?\b|boks|boxing|protein|shaker|matara|water bottle|termos|thermos|tumbler|massage gun|masaj tabancasi|percussive|foam roller|recovery|resistance band|direnc lastigi|jump rope|atlama ipi|squat|bench|power rack|home gym|fitness|\bgym\b|headlamp|kafa lambasi|lantern|fener|\bstove|hammock|hamak|kamp sandalye|camp chair|sleeping pad|\bdalis|diving|surf|yuzme|swim goggles/],
];

/**
 * The category of a product from a store that sells several: the first of
 * `allowed` (in CATEGORY_HINTS order) whose words appear in `text`, else null.
 */
export function detectCategory(allowed: readonly CategorySlug[], text: string): CategorySlug | null {
  const folded = foldForMatching(text);
  for (const [slug, hint] of CATEGORY_HINTS) {
    if (allowed.includes(slug) && hint.test(folded)) return slug;
  }
  return null;
}
