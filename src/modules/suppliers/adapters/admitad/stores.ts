import { detectCategory } from "@/config/categories";
import type { AdmitadFeedStore } from "./adapter";
import type { FeedOffer } from "./feed";

/** "905 USD" → 905. */
const amount = (value: string | undefined): number | null => {
  const number = value ? parseFloat(value.replace(/[^\d.]/g, "")) : NaN;
  return Number.isFinite(number) && number > 0 ? number : null;
};

/** The Luxury Closet's condition grades we take (its best two of Pristine, Excellent, Good, Fair). */
const TOP_CONDITION = new Set(["Pristine", "Excellent"]);

/**
 * A pre-owned item worth showing: in stock, in top condition, with a "was"
 * price — its own earlier price (pre_offer_price) when it was reduced, else
 * the price of the item new (orp), the saving of buying it pre-owned.
 */
function prepareLuxury(offer: FeedOffer): FeedOffer | null {
  if (offer.available !== true || !TOP_CONDITION.has(offer.extra.custom_label_4 ?? "")) return null;
  const was = amount(offer.extra.pre_offer_price) ?? amount(offer.extra.orp);
  return was && was > offer.price ? { ...offer, oldPrice: was } : null;
}

/**
 * Stores joined through Admitad (store.admitad.com, ad space "Findy.az").
 * A new one: join the program, find its feed id under Product Feeds, add an
 * entry here. Research notes: docs/SUPPLIERS.md.
 */
export const ADMITAD_FEED_STORES: AdmitadFeedStore[] = [
  {
    id: "aliexpress",
    name: "AliExpress",
    websiteUrl: "https://www.aliexpress.com",
    originCountry: "CN",
    currency: "USD",
    // "hot products": AliExpress's own best sellers (~480,000 discounted, ~850 MB).
    feedId: "15830",
    onlySale: true,
    categories: ["electronics", "beauty", "home", "bags", "jewelry", "watches", "fashion", "shoes", "toys", "baby", "sports"],
    requireKnownType: true,
    // AliExpress top-level category id → ours (the first is the default when the title says nothing).
    categoryRoots: {
      "44": ["electronics"], // Consumer Electronics
      "509": ["electronics"], // Phones & Telecommunications
      "202192403": ["electronics"], // Phones & Telecommunications Accessories
      "7": ["electronics"], // Computer & Office
      "66": ["beauty"], // Beauty & Health
      "15": ["home"], // Home & Garden
      "6": ["home", "electronics"], // Home Appliances
      "39": ["home"], // Lights & Lighting
      "36": ["jewelry", "watches", "bags"], // Jewelry & Accessories
      "1509": ["jewelry", "watches", "bags"], // Jewelry & Accessories (newer id)
      "1511": ["watches"], // Watches
      "1524": ["bags"], // Luggage & Bags
      "200000297": ["bags", "fashion"], // Apparel Accessories (caps, belts, sunglasses)
      "322": ["shoes"], // Shoes
      "201768104": ["sports", "shoes", "fashion"], // Sports Shoes, Clothing & Accessories
      "200000345": ["fashion"], // Women's Clothing
      "200000343": ["fashion"], // Men's Clothing
      "3": ["fashion", "bags", "shoes"], // Apparel & Accessories
      "200574005": ["fashion"], // Underwear
      "26": ["toys"], // Toys & Hobbies
      "1501": ["baby", "toys", "fashion"], // Mother & Kids
      "18": ["sports"], // Sports & Entertainment
    },
    rules: {
      // 5,000 in all, weighted to what sells in Azerbaijan: gadgets and accessories first.
      quotas: {
        electronics: 1500,
        beauty: 750,
        home: 750,
        bags: 300,
        jewelry: 250,
        watches: 200,
        fashion: 300,
        shoes: 200,
        toys: 300,
        baby: 200,
        sports: 250,
      },
      minPrice: 1,
      maxPrice: 40,
      minDiscountPct: 10,
      maxDiscountPct: 85,
      maxPerShop: 20,
      excludeTitle:
        /\b(spare|replacement|repair) parts?\b|\bfor (rc|1\/\d+)\b|\brc car\b|wholesale|\blot of\b|\b\d{2,} ?pcs\b|treatment|therapy|dental|surgical|medical|tattoo|\bsex\b|erotic|adult toy|lingerie set|walkie|weapon|knife|airsoft|tactical|\bgun\b|e-?cig|vape|cigarette|cooling fan|\bfor (msi|rtx|gpu)\b|\b(para|com|pour|avec|mit)\b/,
      // Titles meant for people: no slogans in tiny letters (ᵃⁿᵈ), mostly Latin letters.
      titleCheck: (title) => !/[\u1d00-\u1dbf\u2070-\u209f]/.test(title) && /^[\x20-\x7e\u00c0-\u024f\u2018-\u201f\u2013\u2014\u2026]+$/.test(title),
    },
    // AliExpress delivers to Azerbaijan itself, mostly free at these prices.
    shippingMinor: 0,
    deliveryDays: { min: 10, max: 25 },
    trustScore: 70,
    reliability: {
      basis: "established-retailer",
      note: "AliExpress marketplace (Alibaba Group); many independent sellers. Joined via Admitad.",
    },
    maxTitleLength: 110,
    notes: [
      "A marketplace: quality varies by seller; at most 20 offers per seller in a category.",
      "Shipping assumed free (AliExpress's usual delivery to Azerbaijan at these prices); the feed has no shipping cost.",
      "The feed has no stock field: listed offers are taken as in stock.",
      "AliExpress's crossed-out prices are often inflated; our own price history decides what is verified.",
    ],
  },
  {
    id: "the-luxury-closet",
    name: "The Luxury Closet",
    websiteUrl: "https://theluxurycloset.com",
    originCountry: "AE",
    currency: "USD",
    // "Products WW": ~63,000 pre-owned designer items, priced in USD. Discounted-only returns nothing here.
    feedId: "25781",
    onlySale: false,
    categories: ["bags", "shoes", "watches", "jewelry", "fashion"],
    // Its <categories> path ("Women, Women's Handbags, Shoulder Bags") plus the title.
    categoryOf: (offer) =>
      /\bkids?\b/i.test(offer.extra.categories ?? "")
        ? null
        : detectCategory(["watches", "jewelry", "bags", "shoes", "fashion"], `${offer.extra.categories ?? ""} ${offer.name}`) ??
          (/clothes/i.test(offer.extra.categories ?? "") ? "fashion" : null),
    extraTags: ["categories", "custom_label_4", "pre_offer_price", "orp"],
    prepare: prepareLuxury,
    requireKnownType: false,
    titlePrefix: "Pre-owned",
    attributesOf: (offer) => ({ condition: "pre-owned", conditionGrade: offer.extra.custom_label_4 ?? "" }),
    rules: {
      quotas: { bags: 800, shoes: 400, watches: 250, jewelry: 250, fashion: 300 },
      minPrice: 100,
      maxPrice: 10_000,
      minDiscountPct: 5,
      // Against the price new, pre-owned savings run high (a $87 pump that was $905).
      maxDiscountPct: 95,
      // Not a marketplace: "seller" is the brand, so one brand cannot fill a category.
      groupBy: "vendor",
      maxPerShop: 150,
      // Dearer items earn more commission; an item that was reduced (pre_offer_price) is a real deal.
      bonus: (offer) => Math.min(offer.price / 250, 20) + (amount(offer.extra.pre_offer_price) ? 10 : 0),
    },
    // Shipping is included in the price for Azerbaijan (its delivery page lists AZ); customs are the buyer's.
    shippingMinor: 0,
    deliveryDays: { min: 10, max: 21 },
    trustScore: 80,
    reliability: {
      basis: "established-retailer",
      note: "Pre-owned luxury retailer in Dubai (since 2012); authenticates every item. Joined via Admitad.",
    },
    maxTitleLength: 120,
    notes: [
      "Pre-owned items only: titles start with \"Pre-owned\", products carry the condition grade.",
      "Only Pristine or Excellent condition, in stock, with a \"was\" price (pre_offer_price, else the price new).",
      "Ships to Azerbaijan with delivery included (theluxurycloset.com delivery page, checked 2026-10-21); customs are paid by the buyer.",
    ],
  },
];
