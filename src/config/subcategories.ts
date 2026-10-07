import { foldForMatching } from "@/lib/text";
import type { CategorySlug } from "./categories";

/**
 * Subcategories and the rules that sort products into them.
 *
 * Stores describe products in free text, so a product's subcategory is decided
 * from its title (plus the store's own product type when it gives one). Rules
 * are checked top to bottom and the first match wins, so put the specific ones
 * ("phone case") above the general ones ("phone"). Anything unmatched lands in
 * "other". Titles are folded to plain ASCII first (see foldForMatching), so the
 * patterns are written without Turkish letters. Keep the list short — at most 10 per category including "other"
 * (a test enforces it) — so the filter stays scannable. To add a subcategory: add a rule here and its name to each
 * dictionary under `subcategories`, then run `npm run deals:rebuild`.
 */
interface Rule {
  slug: string;
  match: RegExp;
}

const RULES = {
  electronics: [
    { slug: "cases-protection", match: /\bcases?\b|cover|screen protector|tempered glass|lens protector|\bskin\b|sleeve|bumper|folio|wallet|\bstraps?\b|\bbands?\b|kilif|qoruyucu/ },
    { slug: "charging-power", match: /charger|charging|power ?bank|\bcables?\b|adapter|\bhub\b|\bdock|magsafe|battery pack|\bgan\b|\bpower\b|powerstation/ },
    { slug: "smart-home", match: /vacuum|robot|\bmop\b|doorbell|purifier|humidifier|thermostat|curtain|smart (plug|lock|bulb|home)|floor clean|roller brush|tozsoran/ },
    { slug: "mounts-photo", match: /\bmounts?\b|holder|\bstands?\b|\bgrip\b|tripod|gimbal|\blens(es)?\b|\bfilter|backpack|\bbags?\b|sling|light\b/ },
    { slug: "keyboards-gaming", match: /keyboard|keycap|\bswitch(es)?\b|\bmouse\b|\bmice\b|mousepad|palm rest|trackpad|deskmat|desk mat/ },
    { slug: "audio", match: /headphone|earbud|earphone|headset|speaker|\biems?\b|in-ear|\bdac\b|\bamp\b|amplifier|soundbar|microphone|\bmic\b|turntable|audio|in-ear monitor|eartips?|\bplayer\b|hearing|qulaqliq/ },
    { slug: "wearables", match: /watch|fitness|tracker|\bring\b/ },
    { slug: "tablets-computers", match: /tablet|\bipad\b|\bpad\b|e-?reader|e-?ink|kindle|planset/ },
    { slug: "tablets-computers", match: /laptop|notebook|noutbuk|mini pc|\bpc\b|desktop|monitor|\bnas\b|\bssd\b|macbook/ },
    { slug: "keyboards-gaming", match: /controller|gamepad|handheld|console|gaming|joystick|arcade|playstation|xbox|nintendo|konsol|游戏机/ },
    { slug: "phones", match: /smartfon|smartphone|\bphone\b|rugged phon|\bmobile\b|telefon|\biphone\b|\d{1,2}\s?(gb)?\s?[/+]\s?\d{2,4}\s?gb/ },
    { slug: "smart-home", match: /camera|sensor|security|\bscale\b/ },
  ],
  fashion: [
    { slug: "underwear-socks", match: /ic giyim|underwear|boxer|kulot|sutyen|\bbras?\b|bralette|corap|\bsocks?\b|pijama|pyjama|pajama|loungewear|mayo|bikini|swim|\bbriefs?\b|\btrunks?\b|bodysuit|atlet/ },
    { slug: "suits-formal", match: /takim elbise|\bsuits?\b|smokin|tuxedo|blazer|kumas ceket|kumas pantolon|\bkravat|necktie|\bbow tie|papyon/ },
    { slug: "knitwear-sweatshirts", match: /sweatshirt|hoodie|kapuson|kazak|sweater|hirka|cardigan|triko|knit|fleece|polar|esofman ust|crewneck|\bcrew\b|\bpullover|half.?zip|quarter.?zip/ },
    { slug: "jackets-coats", match: /ceket|jacket|\bmont\b|\bcoats?\b|kaban|parka|yelek|\bvests?\b|gilet|trenckot|trench|anorak|ruzgarlik|windbreaker|puffer|sisme|overshirt|bomber/ },
    { slug: "dresses-skirts", match: /elbise|\bdress|\betek\b|skirt|tulum|jumpsuit|playsuit|romper|kimono/ },
    { slug: "trousers-jeans", match: /pantolon|trousers|\bpants\b|\bjeans?\b|denim|\bsort|shorts|\btayt|legging|jogger|esofman alt|sweatpants|chino|cargo|kapri|\bbermuda/ },
    { slug: "shirts", match: /gomlek|(?<!t-?|polo )shirt/ },
    { slug: "tops-tshirts", match: /t-?shirt|tisort|\btee\b|\btops?\b|bluz|blouse|\bpolo\b|\btank\b|crop|bustiyer|bustier|body|forma|jersey|singlet/ },
    { slug: "sportswear", match: /esofman|tracksuit|antrenman|training|running|kosu|\bgym\b|\byoga\b|sporcu|\bsport/ },
  ],
  shoes: [
    { slug: "care-accessories", match: /bakim|temizle|cleaner|\blaces?\b|\bbagcik(lari)?\b|tabanlik|insole|\bspray\b|shoe tree|kalip/ },
    { slug: "sandals-slippers", match: /terlik|sandalet|\bsandals?\b|slipper|\bslides?\b|flip.?flops?|\bclogs?\b|\bmules?\b|espadril|plaj|\bpool\b|crocs/ },
    { slug: "boots", match: /\bboots?\b|\bbot\b|botu\b|bootie|cizme|chelsea|postal|\bkar\b|\bsnow\b/ },
    { slug: "heels-flats", match: /topuklu|\bheels?\b|stiletto|\bpumps?\b|babet|ballerina|\bflats?\b|mary jane|dolgu topuk|salon ayakkab/ },
    { slug: "formal", match: /klasik|oxford|derby|brogue|loafer|makosen|monk|deri ayakkab|dress shoe|\bresmi\b/ },
    { slug: "running-sports", match: /kosu|running|\brun\b|trail|basketbol|basketball|futbol|football|krampon|halisaha|tenis|tennis|antrenman|training|outdoor|hiking|yuruyus|\bgolf\b|voleybol|volleyball/ },
    { slug: "sneakers", match: /sneaker|spor ayakkab|gunluk ayakkab|\btrainers?\b|\b(lows|mids|highs)\b|(low|high|mid)[ -]top|\bsneaks\b|samba|gazelle|campus|superstar|stan smith|forum|air force|air max|dunk|\bjordan\b|suede|palermo|speedcat|chuck|old skool/ },
    // Stores that say only "shoes": everyday shoes of no stated type.
    { slug: "casual", match: /ayakkab|\bshoes?\b|footwear|casual|lifestyle|gunluk|\bkids\b|cocuk/ },
  ],
  bags: [
    { slug: "luggage-travel", match: /valiz|bavul|luggage|suitcase|kabin boy|\btrolley|duffel|seyahat canta|travel bag|weekender/ },
    { slug: "backpacks", match: /sirt canta|backpack|rucksack|\bdaypack/ },
    { slug: "wallets-cardholders", match: /cuzdan|\bwallets?\b|kartlik|card ?holder|card ?case|coin purse|para kesesi|anahtarlik|keychain|key ?ring/ },
    { slug: "belts", match: /(?<!bel )\bkemer\b|\bbelts?\b(?! bag)/ },
    { slug: "sunglasses", match: /gozlu[kg]|sunglass|eyewear|\bglasses\b|optik/ },
    { slug: "hats-caps", match: /sapka|\bcaps?\b|\bhats?\b|snapback|strapback|headwear|\bfitted\b|trucker|59fifty|9forty|\bbere\b|beanie|bucket hat|\bvisor|kasket/ },
    { slug: "scarves-gloves", match: /\batki|\bscarf|scarves|eldiven|\bgloves?\b|\bsal\b|fular|bandana|boyunluk|snood/ },
    { slug: "handbags", match: /canta|\bbags?\b|\btote\b|clutch|crossbody|shoulder|handbag|\bpouch|\bpurse|bel canta|bum bag|sling|shopper|\bhobo\b/ },
  ],
  watches: [
    { slug: "smartwatches", match: /smartwatch|smart watch|akilli saat|hybrid hr|\bgps\b/ },
    { slug: "straps-accessories", match: /\bkordon|kayis|\bstraps?\b|\bbands?\b|watch box|saat kutusu|winder|tool kit/ },
    { slug: "clocks", match: /duvar saati|masa saati|\bclocks?\b|calar saat|alarm clock/ },
    { slug: "chronograph", match: /chronograph|kronograf|\bchrono\b|multifunction|multi-function|cok fonksiyon/ },
    { slug: "automatic", match: /otomatik|automatic|mekanik|mechanical|kurmali|\bauto\b/ },
    // Men's / women's is the audience filter, not a type.
    { slug: "classic", match: /kol saati|\bsaat|\bwatch|\bdial\b|\d\d ?mm\b|quartz|analog/ },
  ],
  jewelry: [
    { slug: "sets", match: /\bsets?\b|seti\b|takim\b|\bduo\b|\btrio\b|stack|gift box|hediye kutu/ },
    { slug: "mens-jewelry", match: /erkek|\bmen\b|\bmens\b|\bmen's|cufflink|kol dugme|tesbih|\bprayer beads/ },
    { slug: "earrings", match: /kupe|earring|\bhoops?\b|\bstuds?\b|ear cuff|kulak|huggie|piercing/ },
    { slug: "pendants-charms", match: /kolye ucu|pendant|\bcharms?\b|madalyon|medallion|locket|\bnazar/ },
    { slug: "bracelets", match: /bileklik|bilezik|bracelet|bangle|kelepce|\bcuff\b|halhal|anklet|\bankle/ },
    { slug: "rings", match: /yuzuk|\brings?\b|tektas|alyans|\bband\b/ },
    { slug: "necklaces", match: /kolye|necklace|\bchains?\b|\bzincir|choker|gerdanlik|\blariat/ },
  ],
  home: [
    { slug: "coffee-tea", match: /kahve|coffee|espresso|cappuccino|latte|french press|pour.?over|grinder|ogutucu|frother|sut kopur|moka|nespresso|cay makine|caydanlik|\btea\b|descal|kirec/ },
    { slug: "personal-care", match: /sac kurutma|hair ?dryer|duzlestirici|straightener|airwrap|\bcurl|masa?j|tiras|shaver|trimmer|epilat|dis fircasi|toothbrush/ },
    { slug: "kitchen-appliances", match: /blender|mikser|\bmixer|air ?fryer|airfryer|fritoz|tost|toaster|kettle|su isitici|dograyici|food processor|rondo|sikacak|juicer|waffle|izgara|grill|dehydrator|pizza|\boven\b|\bfirin|multicooker|pressure cooker|duduklu|mutfak robotu|mutfak tartisi|kitchen scale/ },
    { slug: "cookware-knives", match: /tencere|\btava\b|\bpans?\b|\bpots?\b|cookware|skillet|dutch oven|\bwok\b|sahan|guvec|bicak|knife|knives|kesme tahtasi|cutting board/ },
    { slug: "tableware-drinkware", match: /tabak|\bplates?\b|bardak|\bglass(es)?\b|\bmugs?\b|kupa|fincan|\bcups?\b|termos|tumbler|thermos|matara|bottle|catal|kasik|cutlery|surahi|pitcher|servis|kadeh|\bbowls?\b|kase/ },
    { slug: "floor-care", match: /supurge|vacuum|\bmop\b|paspas|steam cleaner|buharli temizle/ },
    { slug: "irons-garment", match: /\butu\b|\biron\b|garment steamer|buharli utu|buhar kazanli/ },
    { slug: "climate-air", match: /air purifier|hava temizle|nemlendirici|humidifier|nem alma|dehumidifier|\bfan\b|vantilator|heater|isitici|radiator|klima/ },
    { slug: "storage", match: /saklama|storage|kavanoz|\bjars?\b|organizer|lunch ?box|beslenme|\bcontainer/ },
  ],
  baby: [
    { slug: "car-seats", match: /oto koltugu|car ?seat|isofix|araba koltugu/ },
    { slug: "strollers", match: /bebek arabasi|puset|stroller|\bprams?\b|travel system|pushchair|buggy|carrycot|port bebe|raincover|rain cover|footmuff|cosy toes|mosquito net|cibinlik|\bhood\b|chassis/ },
    { slug: "monitors-safety", match: /monitor|telsiz|kamera|camera|\bsock\b|smart sock|guvenlik|safety|kapi bariyer|gate/ },
    { slug: "nursery-sleep", match: /besik|\bcribs?\b|bassinet|park yatak|playard|yatak|uyku|sleep|swaddle|kundak|nursery/ },
    { slug: "feeding", match: /mama sandalyesi|high ?chair|biberon|bottle|emzik|pacifier|steril|breast ?pump|gogus pompasi|emzirme|\bmama\b|\bbib\b|onluk|feeding|nipple|\bnursing/ },
    { slug: "carriers", match: /kanguru|carrier|\bsling|wrap/ },
    { slug: "bath-care", match: /banyo|\bbath|kuvet|diaper|\bbez\b|islak mendil|wipes|sampuan|shampoo|krem|cream|nasal|aspirat|termometre|thermometer|\bnail|tirnak/ },
    { slug: "play-activity", match: /oyun halisi|play ?mat|activity|jumper|walker|yurutec|rocker|bouncer|ana kucagi|swing/ },
  ],
  sports: [
    { slug: "fitness-strength", match: /dumbbell|dambil|kettlebell|barbell|halter|agirlik|\bweights?\b|\bplates?\b|bench|squat|power rack|\brack\b|home gym|pull.?up|resistance band|direnc|jump rope|atlama ipi|treadmill|kosu bandi|rower|kurek|exercise bike|kondisyon|cable|landmine|\bbar\b|climber|elliptical|\bsled\b|\bpins?\b|attachment/ },
    { slug: "yoga-pilates", match: /yoga|pilates|\bmat\b|\bblocks?\b/ },
    { slug: "recovery", match: /massage|masaj|theragun|percussive|foam roller|recovery|compression|\bwave\b/ },
    { slug: "cycling", match: /bisiklet|bicycle|cycling|\bbikes?\b/ },
    { slug: "winter-sports", match: /kayak|\bskis?\b|snowboard|goggles?|\bski /},
    { slug: "camping-hiking", match: /cadir|\btents?\b|uyku tulumu|sleeping (bag|pad)|\bkamp|camping|trekking|hiking|baston|\bpoles?\b|lantern|fener|headlamp|kafa lambasi|\bstove|hammock|hamak|\bchairs?\b|sandalye|cot\b|shelter|tarp|climbing|tirmanis|harness|carabiner|\brope\b|\btables?\b|\bmasa\b|gaiters?|stuff sack|dry bag/ },
    { slug: "ball-racket", match: /\btopu\b|\bballs?\b|raket|racket|padel|tenis|tennis|badminton|basketbol|basketball|futbol|football|soccer|voleybol|volleyball|masa tenisi|kaleci|boks|boxing/ },
    { slug: "water-sports", match: /yuzme|\bswim|dalis|diving|surf|snorkel|kayak kurek|paddle/ },
    { slug: "bottles-nutrition", match: /matara|water bottle|bottle|termos|thermos|tumbler|flask|shaker|protein|\bcups?\b|\bmugs?\b/ },
  ],
  beauty: [
    { slug: "fragrance", match: /parfum|perfume|eau de|fragrance|cologne|\bedt\b|\bedp\b|body mist|etir/ },
    { slug: "tools-brushes", match: /brush|sponge|applicator|\btools?\b|\bbags?\b|pouch|mirror|sharpener|curler|tweezer/ },
    { slug: "sets-gifts", match: /\bsets?\b|\bkits?\b|bundle|\bduo\b|\btrio\b|vault|collection|gift/ },
    { slug: "hair", match: /hair|shampoo|sampuan|conditioner|scalp|\bsac\b|sac (spreyi|boyasi|kremi|maskesi|bakim)/ },
    { slug: "makeup", match: /\blips?\b|lipstick|lippie|gloss|\bbalm\b|dudak|\bruj\b/ },
    { slug: "makeup", match: /\beyes?\b|shadow|eyeliner|mascara|lash|brow|liner|goz|kas|kirpik/ },
    { slug: "makeup", match: /foundation|concealer|blush|bronzer|highlighter|powder|primer|contour|setting spray|\btint\b|complexion/ },
    { slug: "skincare", match: /serum|cream|moistur|cleanser|toner|\bspf\b|sunscreen|\bmasks?\b|essence|exfoli|peel|retinol|\bacid\b|\boil\b|lotion|\bmist\b|patch|\bgel\b|krem|temizle|tonik|\bskin\b|\bface\b|\bcilt|\byuz\b|\bjeli?\b|nemlendir|gunes|\buv\b|leke|sun stick/ },
    { slug: "body", match: /\bbody\b|\bhand\b|bath|soap|sabun|deodorant|\bdeo\b|roll-on|vucut|\bdus\b|\bnails?\b|tirnak|\boje\b/ },
  ],
  toys: [
    { slug: "building", match: /lego|brick|building|\bblocks?\b|magna|\btiles?\b|construction|model kit/ },
    { slug: "figures-dolls", match: /plush|stuffed|squish|soft toy/ },
    { slug: "figures-dolls", match: /figure|figma|nendoroid|\bdolls?\b|barbie|statue|collectible/ },
    { slug: "vehicles", match: /\bcars?\b|truck|vehicle|hot wheels|\btrains?\b|plane|matchbox|\brc\b/ },
    { slug: "audio-music", match: /tonie|audio|music|instrument|piano|drum/ },
    { slug: "games-puzzles", match: /puzzle|\bgames?\b|\bcards?\b|\buno\b|board/ },
    { slug: "creative", match: /putty|slime|craft|\bart\b|paint|colou?r|sticker|crayon|drawing/ },
    { slug: "outdoor", match: /outdoor|\bbike|scooter|ride-?on|slide|swing|\bballs?\b|wagon/ },
    { slug: "learning-play", match: /\bplay|pretend|kitchen|learning|wooden|sensory|activity|stacking|sorter|toddler|baby/ },
  ],
} as const satisfies Record<CategorySlug, readonly Rule[]>;

export const OTHER_SUBCATEGORY = "other";
export const MAX_SUBCATEGORIES = 10;

type RuleSlug<C extends CategorySlug> = (typeof RULES)[C][number]["slug"];
export type SubcategorySlug = { [C in CategorySlug]: RuleSlug<C> }[CategorySlug] | typeof OTHER_SUBCATEGORY;

/** Subcategories of a category, in display order ("other" last). */
export function subcategoriesOf(category: CategorySlug): SubcategorySlug[] {
  // A subcategory may have several rules (a specific one early, a loose one late).
  return [...new Set(RULES[category].map((rule) => rule.slug)), OTHER_SUBCATEGORY];
}

export function isSubcategoryOf(category: CategorySlug, value: string): value is SubcategorySlug {
  return (subcategoriesOf(category) as string[]).includes(value);
}

/**
 * Product types our own store adapters assign from the section they read.
 * They are exact, so they win over anything the title might suggest: an
 * "Apple Watch … Aluminium Case with Sport Band" is a watch, not a case.
 */
const TRUSTED_TYPES: Partial<Record<CategorySlug, Record<string, SubcategorySlug>>> = {
  electronics: {
    smartphone: "phones",
    tablet: "tablets-computers",
    laptop: "tablets-computers",
    smartwatch: "wearables",
    headphones: "audio",
    "game console": "keyboards-gaming",
  },
};

export function classifyProduct(category: CategorySlug, title: string, sourceType?: string | null): SubcategorySlug {
  const trusted = sourceType ? TRUSTED_TYPES[category]?.[sourceType.toLowerCase()] : undefined;
  if (trusted) return trusted;

  const text = foldForMatching(`${title} ${sourceType ?? ""}`);
  return RULES[category].find((rule) => rule.match.test(text))?.slug ?? OTHER_SUBCATEGORY;
}
