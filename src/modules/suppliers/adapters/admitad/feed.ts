/**
 * Admitad product feeds (YML / XML): a <categories> list, then one <offer> per
 * product. Big feeds run to hundreds of megabytes, so they are read as a stream
 * — one offer at a time, never the whole file in memory. Pure parsing here; the
 * download is in ./adapter.ts.
 */

export interface FeedCategory {
  id: string;
  name: string;
  parentId: string | null;
}

export interface FeedOffer {
  id: string;
  name: string;
  /** Affiliate link (tracking included). */
  url: string;
  price: number;
  oldPrice: number | null;
  currency: string;
  categoryId: string | null;
  pictures: string[];
  vendor: string | null;
  /** <param name="…"> values, e.g. discount, commissionRate, shopId. */
  params: Record<string, string>;
  /** The offer's available="…" attribute; null when it has none. */
  available: boolean | null;
  /** Store-specific tags asked for by name (e.g. a condition grade). */
  extra: Record<string, string>;
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  // Some feeds escape HTML names twice ("Herm&amp;egrave;s"): the usual accented letters.
  eacute: "é", egrave: "è", ecirc: "ê", euml: "ë", aacute: "á", agrave: "à", acirc: "â", auml: "ä",
  iacute: "í", ouml: "ö", oacute: "ó", uuml: "ü", uacute: "ú", ccedil: "ç", ntilde: "ñ",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", trade: "™", reg: "®", copy: "©",
};

/** XML text as plain text: CDATA unwrapped, entities decoded. */
export function decodeXml(text: string): string {
  const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(text);
  if (cdata) return cdata[1].trim();
  const once = (value: string) => value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
      if (code[0] === "#") {
        const point = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(point) ? String.fromCodePoint(point) : match;
      }
      return ENTITIES[code.toLowerCase()] ?? match;
    });
  const decoded = once(text);
  // A second pass only where the first left an entity ("&amp;egrave;" → "&egrave;" → "è").
  return (/&[a-z#][a-z0-9]*;/i.test(decoded) ? once(decoded) : decoded).trim();
}

const tag = (block: string, name: string): string | null => {
  const match = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(block);
  return match ? decodeXml(match[1]) : null;
};

/** The <category> elements of a feed's head. */
export function parseCategories(head: string): FeedCategory[] {
  return [...head.matchAll(/<category\s([^>]*)>([\s\S]*?)<\/category>/g)].map(([, attrs, name]) => ({
    id: /\bid="([^"]+)"/.exec(attrs)?.[1] ?? "",
    name: decodeXml(name),
    parentId: /\bparentId="([^"]+)"/.exec(attrs)?.[1] ?? null,
  }));
}

/** One <offer>…</offer> block, or null when it lacks what a product needs. `extraTags` are read into `extra`. */
export function parseOffer(block: string, extraTags: readonly string[] = []): FeedOffer | null {
  const id = /<offer\s[^>]*\bid="([^"]+)"/.exec(block)?.[1];
  const name = tag(block, "name");
  const url = tag(block, "url");
  const price = Number(tag(block, "price"));
  if (!id || !name || !url || !Number.isFinite(price) || price <= 0) return null;
  const old = Number(tag(block, "oldprice"));
  const params: Record<string, string> = {};
  for (const [, key, value] of block.matchAll(/<param\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/param>/g)) params[key] = decodeXml(value);
  return {
    id,
    name,
    url,
    price,
    oldPrice: Number.isFinite(old) && old > price ? old : null,
    currency: tag(block, "currencyId") ?? "USD",
    categoryId: tag(block, "categoryId"),
    pictures: [...block.matchAll(/<picture>([\s\S]*?)<\/picture>/g)].map(([, picture]) => decodeXml(picture)),
    vendor: tag(block, "vendor"),
    params,
    available: /<offer\s[^>]*\bavailable="(\w+)"/.exec(block)?.[1] === undefined ? null : /<offer\s[^>]*\bavailable="true"/.test(block),
    extra: Object.fromEntries(extraTags.flatMap((name) => {
      const value = tag(block, name);
      return value === null ? [] : [[name, value]];
    })),
  };
}

/**
 * Reads a feed as it arrives: the categories first (from the head, before the
 * first offer), then every offer. Malformed offers are skipped.
 */
export async function* readFeed(
  chunks: AsyncIterable<string>,
  onCategories: (categories: FeedCategory[]) => void,
  extraTags: readonly string[] = [],
): AsyncGenerator<FeedOffer> {
  let buffer = "";
  let inOffers = false;
  for await (const chunk of chunks) {
    buffer += chunk;
    if (!inOffers) {
      const first = buffer.indexOf("<offer ");
      if (first === -1) {
        // Still in the head; it is small, keep reading.
        continue;
      }
      onCategories(parseCategories(buffer.slice(0, first)));
      buffer = buffer.slice(first);
      inOffers = true;
    }
    let start = buffer.indexOf("<offer ");
    let consumed = 0;
    while (start !== -1) {
      const end = buffer.indexOf("</offer>", start);
      if (end === -1) break;
      const offer = parseOffer(buffer.slice(start, end + "</offer>".length), extraTags);
      if (offer) yield offer;
      consumed = end + "</offer>".length;
      start = buffer.indexOf("<offer ", consumed);
    }
    // Keep only the unfinished offer, or the tail where the next one may begin ("<off" + the next chunk).
    buffer = start !== -1 ? buffer.slice(start) : buffer.slice(Math.max(consumed, buffer.length - "<offer ".length));
  }
  if (!inOffers) onCategories(parseCategories(buffer));
}

/** The top-level category of each category id (AliExpress nests up to four deep). */
export function rootCategories(categories: FeedCategory[]): Map<string, FeedCategory> {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const roots = new Map<string, FeedCategory>();
  for (const category of categories) {
    let current = category;
    for (let depth = 0; depth < 10 && current.parentId && byId.has(current.parentId); depth++) current = byId.get(current.parentId)!;
    roots.set(category.id, current);
  }
  return roots;
}
