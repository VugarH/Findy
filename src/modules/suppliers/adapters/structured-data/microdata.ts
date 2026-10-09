/**
 * schema.org microdata: the older way pages describe a product, written into
 * the HTML itself (itemscope / itemprop attributes) rather than a JSON-LD
 * block. Many Turkish shops on the IdeaSoft platform use it (Pilsan).
 *
 * readMicrodataProduct turns the first Product's markup into the same shape a
 * JSON-LD block has ({ "@type": "Product", name, offers: { price, … } }), so
 * one set of rules reads both. A small scanner, not a full HTML parser: it
 * follows nesting only far enough to know which item a property belongs to.
 */

type Node = Record<string, unknown>;

const VOID_TAGS = new Set(["meta", "link", "img", "br", "hr", "input", "source", "area", "base", "col", "embed", "wbr"]);

function attribute(attrs: string, name: string): string | null {
  const match = new RegExp(`(?:^|\\s)${name}(?:\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+)))?`, "i").exec(attrs);
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3] ?? "";
}

function typeName(itemtype: string | null): string {
  return itemtype?.split(/[/#]/).filter(Boolean).pop() ?? "Thing";
}

/** The first schema.org Product in the page's microdata, in JSON-LD shape, or null. */
export function readMicrodataProduct(html: string): Node | null {
  const start = /<[a-z][^>]*\bitemtype\s*=\s*["']?https?:\/\/schema\.org\/Product(?:Group)?["'\s>]/i.exec(html);
  if (!start) return null;

  const tags = /<(\/?)([a-zA-Z][\w-]*)([^>]*)>/g;
  tags.lastIndex = start.index;

  interface Open {
    tag: string;
    /** The item this element opened, if it has itemscope. */
    scope?: Node;
    /** A property whose value is this element's text. */
    textProp?: { node: Node; prop: string; from: number };
  }
  const elements: Open[] = [];
  const scopes: Node[] = [];
  let product: Node | null = null;

  const set = (node: Node, prop: string, value: unknown) => {
    // The first value wins: a nested item's properties belong to that item, not this one.
    if (node[prop] === undefined) node[prop] = value;
  };

  for (let match = tags.exec(html); match; match = tags.exec(html)) {
    const [whole, closing, rawTag, attrs] = match;
    const tag = rawTag.toLowerCase();

    if (closing) {
      // Close up to the matching element (tolerates unclosed children).
      const index = elements.map((element) => element.tag).lastIndexOf(tag);
      if (index === -1) continue;
      for (const element of elements.splice(index).reverse()) {
        if (element.textProp) {
          const text = html
            .slice(element.textProp.from, match.index)
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          if (text) set(element.textProp.node, element.textProp.prop, text);
        }
        if (element.scope) scopes.pop();
      }
      if (scopes.length === 0 && product) return product;
      continue;
    }

    const props = (attribute(attrs, "itemprop") ?? "").split(/\s+/).filter(Boolean);
    const isScope = attribute(attrs, "itemscope") !== null;
    const parent = scopes.at(-1);
    const selfClosing = VOID_TAGS.has(tag) || whole.endsWith("/>");
    const open: Open = { tag };

    if (isScope) {
      const node: Node = { "@type": typeName(attribute(attrs, "itemtype")) };
      if (parent) for (const prop of props) set(parent, prop, node);
      product ??= node;
      if (!selfClosing) {
        scopes.push(node);
        open.scope = node;
      }
    } else if (parent && props.length > 0) {
      const value = attribute(attrs, "content") ?? attribute(attrs, "href") ?? attribute(attrs, "src");
      if (value !== null) {
        for (const prop of props) set(parent, prop, value);
      } else if (!selfClosing) {
        open.textProp = { node: parent, prop: props[0], from: match.index + whole.length };
      }
    }

    if (!selfClosing) elements.push(open);
  }
  return product;
}

/** The crossed-out price a page marks as schema.org StrikethroughPrice (microdata or JSON-LD). */
export function readStrikethroughPrice(html: string): string | null {
  const microdata =
    /StrikethroughPrice["'][^>]*>(?:\s*<[^>]*>)*?\s*<meta[^>]*itemprop=["']price["'][^>]*content=["']([\d.,]+)/i.exec(html) ??
    /<meta[^>]*itemprop=["']price["'][^>]*content=["']([\d.,]+)["'][^>]*>\s*<meta[^>]*StrikethroughPrice/i.exec(html);
  if (microdata) return microdata[1];
  const json = /"priceType"\s*:\s*"[^"]*StrikethroughPrice"[^{}]*?"price"\s*:\s*"?([\d.,]+)/.exec(html);
  return json?.[1] ?? null;
}
