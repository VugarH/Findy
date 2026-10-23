/**
 * Product photos we can show. Some image servers refuse to be shown on other
 * sites ("hotlink protection") and answer with a "not found" picture instead.
 * We respect that rather than working around it, so their photos count as
 * missing — and a product without a usable photo is left out of deal lists
 * and search (its own page still opens from a direct link).
 */
const HOTLINK_PROTECTED_HOSTS = [
  // Fakir (fakir.com.tr)
  "witcdn.net",
];
/** WitCDN also serves stores from their own subdomain (witcdn.dermoeczanem.com), with the same protection. */
const HOTLINK_PROTECTED_PREFIXES = ["witcdn."];

/** The photo address if it can be shown on our pages, else null. */
export function usableImage(url: string | null | undefined): string | null {
  if (!url) return null;
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }
  const blocked =
    HOTLINK_PROTECTED_HOSTS.some((name) => host === name || host.endsWith(`.${name}`)) ||
    HOTLINK_PROTECTED_PREFIXES.some((prefix) => host.startsWith(prefix));
  return blocked ? null : url;
}

/** Photos shown on a product page (the main one included). Set to 1 to show only the main photo. */
export const GALLERY_MAX = 4;

/**
 * A product page's photos: the main photo first, then the store's other photos
 * in their order — only ones we can show, no repeats, at most GALLERY_MAX.
 */
export function galleryImages(main: string | null | undefined, others: readonly (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of [main, ...others]) {
    const usable = usableImage(url);
    if (!usable || seen.has(usable)) continue;
    seen.add(usable);
    out.push(usable);
    if (out.length === GALLERY_MAX) break;
  }
  return out;
}

/** A sharper copy for the zoom panel, where the store's image server can resize (Shopify "width="); else the same photo. */
export function largeImage(url: string): string {
  return url.replace(/([?&]width=)\d+/, (_, param: string) => `${param}1600`);
}
