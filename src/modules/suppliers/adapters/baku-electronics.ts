import { toMinor } from "@/lib/money";
import { parseElectronicsTitle } from "@/modules/catalog/normalizers/electronics";
import { PoliteClient } from "../http";
import type { AdapterContext, RawOffer, SupplierAdapter, SupplierDefinition } from "../types";

const ORIGIN = "https://bakuelectronics.az";

/** Catalog sections we collect. Add a line to cover another section. */
const SECTIONS = [
  { path: "/catalog/telefonlar-plansetler/smartfonlar-mobil-telefonlar", productType: "smartphone" },
  { path: "/catalog/telefonlar-plansetler/plansetler", productType: "tablet" },
  { path: "/catalog/telefonlar-plansetler/smart-saatlar", productType: "smartwatch" },
  { path: "/catalog/telefonlar-plansetler/qulaqliqlar", productType: "headphones" },
  { path: "/catalog/noutbuklar-komputerler-planshetler/noutbuklar", productType: "laptop" },
  { path: "/catalog/oyun-konsollari-oyunlar/oyun-konsollari", productType: "game console" },
] as const;

const definition: SupplierDefinition = {
  id: "baku-electronics",
  name: "Baku Electronics",
  scope: "local",
  originCountry: "AZ",
  currency: "AZN",
  websiteUrl: ORIGIN,
  trustScore: 88,
  integration: "crawler",
  categories: ["electronics"],
  access: {
    kind: "embedded-json",
    summary:
      "Catalog pages are server-rendered by Next.js and embed the full product list as JSON in a <script id=\"__NEXT_DATA__\"> tag.",
    steps: [
      "GET a catalog section page, e.g. /catalog/telefonlar-plansetler/smartfonlar-mobil-telefonlar",
      "Parse the JSON in <script id=\"__NEXT_DATA__\">; the list is props.pageProps.products.products",
      "Read `total` and `size` to get the page count, then GET ?page=2…N",
      "Each item is one offer; product URL is /mehsul/{slug}",
    ],
    entryPoints: SECTIONS.map((section) => ORIGIN + section.path),
    fields: {
      externalId: "items[].product_code",
      title: "items[].name",
      price: "items[].discounted_price when discount > 0, else items[].price",
      listPrice: "items[].price when discount > 0",
      inStock: "items[].quantity > 0",
      image: "items[].image",
      url: "/mehsul/ + items[].slug",
      "brand, model": "parsed from the title (no separate field in the list)",
    },
    robots: {
      checkedOn: "2026-09-30",
      notes:
        "/catalog/ and /mehsul/ are allowed. Disallowed and not used: /axtaris-neticesi (search), /sebet, /istifadeci, /kampaniyalar.",
    },
    politeness: { delayMs: 700, maxRequestsPerRun: 160 },
    liveSearch: { supported: false, reason: "The store's search page is disallowed by robots.txt." },
    assumptions: [
      "Delivery is taken as free, 1–3 days; the list does not state delivery cost.",
      "Product pages also carry schema.org JSON-LD and richer detail (itemCode, attributes) if ever needed.",
    ],
  },
};

interface ListItem {
  product_code: number;
  name: string;
  slug: string;
  price: number;
  discount: string | number | null;
  discounted_price: number | null;
  quantity: number;
  image: string | null;
}

interface ListPage {
  items: ListItem[];
  total: number;
  size: number;
}

export function parseListPage(html: string): ListPage {
  const match = /<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s.exec(html);
  if (!match) throw new Error("Baku Electronics: __NEXT_DATA__ not found (page layout changed?)");
  const list = JSON.parse(match[1])?.props?.pageProps?.products?.products;
  if (!Array.isArray(list?.items)) throw new Error("Baku Electronics: product list missing in page data");
  return list;
}

export function toRawOffer(item: ListItem, productType: string): RawOffer | null {
  const phone = parseElectronicsTitle(item.name);
  if (!phone) return null;

  const discounted = Number(item.discount) > 0 && item.discounted_price && item.discounted_price < item.price;
  return {
    externalId: String(item.product_code),
    url: `${ORIGIN}/mehsul/${item.slug}`,
    title: item.name,
    brand: phone.brand,
    model: phone.model,
    categorySlug: "electronics",
    productType,
    imageUrl: item.image ?? undefined,
    priceMinor: toMinor(discounted ? item.discounted_price! : item.price),
    currency: "AZN",
    listPriceMinor: discounted ? toMinor(item.price) : undefined,
    shippingMinor: 0,
    inStock: item.quantity > 0,
    deliveryDays: { min: 1, max: 3 },
    attributes: phone.color ? { color: phone.color } : undefined,
  };
}

export const bakuElectronicsAdapter: SupplierAdapter = {
  definition,

  async fetchCatalog(ctx: AdapterContext): Promise<RawOffer[]> {
    const { delayMs, maxRequestsPerRun } = definition.access.politeness;
    const client = new PoliteClient({ delayMs, maxRequests: maxRequestsPerRun, signal: ctx.signal });
    const offers: RawOffer[] = [];

    for (const section of SECTIONS) {
      const first = parseListPage(await client.getText(ORIGIN + section.path));
      const pages = Math.ceil(first.total / first.size);
      const items = [...first.items];
      for (let page = 2; page <= pages && client.budgetLeft > 0; page++) {
        items.push(...parseListPage(await client.getText(`${ORIGIN}${section.path}?page=${page}`)).items);
      }
      for (const item of items) {
        const offer = toRawOffer(item, section.productType);
        if (offer) offers.push(offer);
      }
    }
    return offers;
  },

  async search(): Promise<RawOffer[]> {
    return [];
  },
};
